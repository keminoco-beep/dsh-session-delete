/**
 * Host half of “Permanently delete conversation”.
 *
 * The browser calls one same-origin JSON endpoint. A live Session is either
 * refused (safe mode) or torn down in-process with `force: true`; the endpoint
 * then removes the Workspace references and only the Session artifact
 * directory reported by the configured persistence backend. Shared attachment
 * objects and user files are never touched.
 */

import { lstat, rm, unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path'

const ROUTE = '/api/session-delete'
const WORKSPACE_ROUTE = '/api/workspace-delete'
const SESSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/
const WORKSPACE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/
const MAX_BODY_BYTES = 8192

export const name = 'dsh-session-delete'

export const inject = [
  'webServer',
  'sessionPersistence',
  'workspaceRegistry',
  'sessions',
  'agents',
]

class HttpError extends Error {
  constructor(status, code, message) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}

/**
 * Register the deletion endpoint for the lifetime of this plugin.
 * @param {import('@deepseek-ai/cordis').Context} ctx Host context.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: ROUTE,
    handler: (req, res) => handle(ctx, req, res),
  }), 'session-delete: endpoint')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: WORKSPACE_ROUTE,
    handler: (req, res) => handleWorkspace(ctx, req, res),
  }), 'session-delete: workspace endpoint')
}

/**
 * Delete a registered Workspace's project folder and then its registration.
 * The path is always looked up Host-side by id; the browser never supplies it.
 */
async function handleWorkspace(ctx, req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method', 'POST required')
    requireSameOrigin(req)
    if (req.headers['x-dsh-session-delete'] !== '1') {
      throw new HttpError(403, 'forbidden', 'missing request marker')
    }
    const body = await readJson(req)
    const workspaceId = body?.workspaceId
    if (typeof workspaceId !== 'string' || !WORKSPACE_ID.test(workspaceId) || workspaceId.includes('..')) {
      throw new HttpError(400, 'invalid-id', 'invalid workspace id')
    }

    const workspace = ctx.workspaceRegistry.list().find(item => item.id === workspaceId)
    if (workspace === undefined) {
      throw new HttpError(404, 'workspace-not-found', 'workspace is not registered')
    }

    const folder = workspaceFolder(workspace.path)
    const removedFolder = await removeWorkspaceFolder(folder)
    const deleted = await ctx.workspaceRegistry.delete(workspaceId)
    send(res, 200, { ok: true, deleted, removedFolder, workspaceId, path: folder })
  } catch (error) {
    if (error instanceof HttpError) {
      send(res, error.status, { ok: false, code: error.code, message: error.message })
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    warn(ctx, `workspace delete: ${message}`)
    send(res, 500, { ok: false, code: 'io-error', message })
  }
}

/** Reject roots and DSH/user-data directories; require an ordinary absolute path. */
function workspaceFolder(value) {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('..')) {
    throw new HttpError(500, 'unsafe-path', 'workspace path is not an ordinary absolute path')
  }
  const target = resolve(value)
  const root = parse(target).root
  if (target === root) {
    throw new HttpError(500, 'unsafe-path', 'refusing to remove a drive root')
  }
  const home = resolve(homedir())
  if (target === home) {
    throw new HttpError(500, 'unsafe-path', 'refusing to remove the home directory')
  }
  const dshHome = resolve(process.env.DSH_HOME || join(home, '.dsh'))
  if (target === dshHome || isInside(dshHome, target)) {
    throw new HttpError(500, 'unsafe-path', 'refusing to remove DSH data')
  }
  return target
}

function isInside(parent, child) {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

async function removeWorkspaceFolder(path) {
  let info
  try {
    info = await lstat(path)
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }
  if (info.isSymbolicLink()) {
    throw new HttpError(500, 'unsafe-path', 'workspace folder is a symbolic link')
  }
  if (!info.isDirectory()) {
    throw new HttpError(500, 'unsafe-path', 'workspace path is not a directory')
  }
  await rm(path, { recursive: true, force: false, maxRetries: 3 })
  return true
}

async function handle(ctx, req, res) {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'method', 'POST required')
    requireSameOrigin(req)
    if (req.headers['x-dsh-session-delete'] !== '1') {
      throw new HttpError(403, 'forbidden', 'missing request marker')
    }
    const body = await readJson(req)
    const sessionId = body?.sessionId
    if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId) || sessionId.includes('..')) {
      throw new HttpError(400, 'invalid-id', 'invalid session id')
    }

    const live = ctx.agents.get(sessionId) !== undefined || ctx.sessions.get(sessionId) !== undefined
    if (live && body?.force !== true) {
      throw new HttpError(409, 'live', 'the session is still active in this DSH process')
    }

    const snapshot = await ctx.sessionPersistence.stat(sessionId)
    const artifact = snapshot?.location?.path === undefined
      ? undefined
      : artifactOf(sessionId, snapshot.location.path)

    // Resolve the path before teardown: detaching the Session removes the
    // in-memory index that stat() uses for a created-but-unmaterialized id.
    let forced = false
    if (live) {
      try {
        await forceClose(ctx, sessionId)
        forced = true
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        throw new HttpError(409, 'force-failed', `could not close the live session: ${message}`)
      }
    }

    // Remove the authoritative artifact first. If Windows refuses because a
    // file is still open, leave every Workspace reference intact so the user
    // can retry instead of seeing a half-deleted Session.
    let deleted = false
    if (artifact !== undefined) deleted = await removeArtifact(artifact, sessionId)

    // A created-but-unmaterialized Session can be listed from the backend's
    // pending map without any artifact. Detach any remaining registry entries
    // and drop that pending record, otherwise the row survives as “未分组”.
    await forgetSession(ctx, sessionId)

    // Workspace cleanup is safe for an already missing Session and must not
    // prevent the response after the artifact has gone.
    await scrubWorkspace(ctx, sessionId)
    send(res, 200, { ok: true, deleted, forced, sessionId })
  } catch (error) {
    if (error instanceof HttpError) {
      send(res, error.status, { ok: false, code: error.code, message: error.message })
      return
    }
    const message = error instanceof Error ? error.message : String(error)
    try {
      ctx.logger?.warn?.(`session-delete: ${message}`)
    } catch { /* logging must not hide the response */ }
    send(res, 500, { ok: false, code: 'io-error', message })
  }
}

/**
 * Stop one live Agent and close its persistence handles without unloading the
 * whole agent loop. DSH exposes no public dispose-by-id, so this deliberately
 * uses the runtime's in-process registries and the JSONL backend's open-handle
 * set. Every step is bounded: a stuck turn must not wedge the HTTP request.
 */
async function forceClose(ctx, sessionId) {
  const agent = ctx.agents.get(sessionId)
  if (agent !== undefined) {
    try {
      agent.cancel?.({ kind: 'disposed' }, { keepInbox: false })
    } catch (error) {
      warn(ctx, `cancel ${sessionId}: ${String(error)}`)
    }
    await bounded(ctx, 'agent idle', () => agent.whenIdle?.(), sessionId)
    await bounded(ctx, 'agent scope', () => agent.scope?.dispose?.(), sessionId)
  }

  const closed = await closePersistenceHandles(ctx, sessionId)
  await detachEntry(ctx, ctx.agents, sessionId, 'agent')
  await detachEntry(ctx, ctx.sessions, sessionId, 'session')
  if (closed === 0) {
    warn(ctx, `force delete ${sessionId}: no live persistence handle was found`)
  }
}

async function forgetSession(ctx, sessionId) {
  await detachEntry(ctx, ctx.agents, sessionId, 'agent')
  await detachEntry(ctx, ctx.sessions, sessionId, 'session')
  const tracker = ctx.sessionPersistence?.tracker
  if (tracker?.pending instanceof Map) tracker.pending.delete(sessionId)
  await removeProjectionCache(sessionId)
  // The Client list listens for this event. Emit it even when no live store
  // entry existed, so a stale/deleted row cannot survive as “未分组”.
  ctx.emit?.('api-session/removed', sessionId)
}

async function removeProjectionCache(sessionId) {
  const home = process.env.DSH_HOME || join(homedir(), '.dsh')
  const file = join(home, 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
  try {
    await unlink(file)
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error
  }
}

async function closePersistenceHandles(ctx, sessionId) {
  const handles = ctx.sessionPersistence?.tracker?.openHandles
  if (!(handles instanceof Set)) return 0
  const closing = []
  for (const handle of [...handles]) {
    if (handle?.id !== sessionId || typeof handle.close !== 'function') continue
    closing.push(Promise.resolve()
      .then(() => handle.close())
      .catch((error) => {
        // A concurrent `session/disposed` listener may already have closed it.
        if (error?.name === 'SessionHandleClosedError' || /closed/i.test(String(error?.message))) return
        throw error
      }))
  }
  const results = await Promise.allSettled(closing)
  const failures = results.filter(result => result.status === 'rejected')
  if (failures.length > 0) {
    throw new AggregateError(failures.map(result => result.reason), `session "${sessionId}" close failed`)
  }
  return closing.length
}

async function detachEntry(ctx, registry, sessionId, label) {
  const store = registry?.store
  if (!(store instanceof Map)) return false
  const entry = store.get(sessionId)
  if (entry === undefined) return false
  if (typeof registry.detachEntered === 'function') {
    await registry.detachEntered(entry)
    return true
  }
  // Last-resort fallback for a future runtime that renames the private method.
  store.delete(sessionId)
  warn(ctx, `${label} ${sessionId}: detached without a disposal event`)
  return true
}

function bounded(ctx, label, work, sessionId) {
  if (typeof work !== 'function') return Promise.resolve()
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out`)), 8_000)
    timer.unref?.()
  })
  return Promise.race([Promise.resolve().then(work), timeout])
    .catch((error) => { warn(ctx, `force delete ${sessionId}: ${label}: ${String(error)}`) })
    .finally(() => clearTimeout(timer))
}

/**
 * Resolve the one path this plugin is allowed to remove. A per-session JSONL
 * backend stores `<...>/<sessionId>/session.v4.jsonl.zstd`; a flat backend
 * stores a file whose name carries the Session id.
 */
function artifactOf(sessionId, locationPath) {
  const file = resolve(locationPath)
  if (basename(dirname(file)) === sessionId) {
    return { kind: 'directory', path: dirname(file) }
  }
  if (basename(file).includes(sessionId)) {
    return { kind: 'file', path: file }
  }
  throw new HttpError(500, 'unsafe-path', 'persistence reported an unexpected artifact path')
}

async function removeArtifact(artifact, sessionId) {
  let info
  try {
    info = await lstat(artifact.path)
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    throw error
  }

  if (artifact.kind === 'directory') {
    if (basename(artifact.path) !== sessionId) {
      throw new HttpError(500, 'unsafe-path', 'refusing to remove an unexpected directory')
    }
    if (info.isSymbolicLink()) {
      await unlink(artifact.path)
      return true
    }
    if (!info.isDirectory()) {
      throw new HttpError(500, 'unsafe-path', 'session artifact is not a directory')
    }
    await rm(artifact.path, { recursive: true, force: true, maxRetries: 2 })
    return true
  }

  if (info.isDirectory()) {
    throw new HttpError(500, 'unsafe-path', 'session artifact is unexpectedly a directory')
  }
  await unlink(artifact.path)
  return true
}

async function scrubWorkspace(ctx, sessionId) {
  for (const workspace of ctx.workspaceRegistry.list()) {
    try {
      if (workspace.sessionIds.includes(sessionId)) await workspace.detachSession(sessionId)
    } catch (error) {
      warn(ctx, `detach ${sessionId} from ${workspace.id ?? 'workspace'}: ${String(error)}`)
    }
  }
  for (const method of ['unarchiveSession', 'unpinSession']) {
    try {
      await ctx.workspaceRegistry[method](sessionId)
    } catch (error) {
      warn(ctx, `${method} ${sessionId}: ${String(error)}`)
    }
  }
}

function warn(ctx, message) {
  try {
    ctx.logger?.warn?.(`session-delete: ${message}`)
  } catch { /* best effort */ }
}

function requireSameOrigin(req) {
  const origin = req.headers.origin
  if (origin === undefined) return
  let host
  try {
    host = new URL(origin).host
  } catch {
    throw new HttpError(403, 'forbidden', 'invalid origin')
  }
  if (req.headers.host === undefined || host !== req.headers.host) {
    throw new HttpError(403, 'forbidden', 'cross-origin request refused')
  }
}

async function readJson(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += bytes.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'body-too-large', 'request body too large')
    chunks.push(bytes)
  }
  if (size === 0) throw new HttpError(400, 'bad-request', 'empty request body')
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, 'bad-request', 'invalid JSON')
  }
}

function send(res, status, value) {
  if (res.headersSent) return
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(body),
    'cache-control': 'no-store',
  })
  res.end(body)
}

export { artifactOf, handle, handleWorkspace, removeArtifact, workspaceFolder }
