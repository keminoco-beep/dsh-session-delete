import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, stat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { handle, handleWorkspace, workspaceFolder } from '../index.js'

function request(sessionId, force = false) {
  const req = Readable.from([Buffer.from(JSON.stringify({ sessionId, force }))])
  req.method = 'POST'
  req.headers = { 'x-dsh-session-delete': '1' }
  return req
}

function workspaceRequest(workspaceId) {
  const req = Readable.from([Buffer.from(JSON.stringify({ workspaceId }))])
  req.method = 'POST'
  req.headers = { 'x-dsh-session-delete': '1' }
  return req
}

function response() {
  return {
    headersSent: false,
    status: 0,
    payload: undefined,
    writeHead(status) { this.status = status },
    end(body) { this.payload = JSON.parse(body) },
  }
}

function context(sessionId, file, { live = false } = {}) {
  const calls = {
    archive: 0, pin: 0, detach: 0,
    cancel: 0, idle: 0, scope: 0, close: 0, agentDetach: 0, sessionDetach: 0,
  }
  const agent = {
    cancel() { calls.cancel += 1 },
    async whenIdle() { calls.idle += 1 },
    scope: { async dispose() { calls.scope += 1 } },
  }
  const agentEntry = { id: sessionId, agent }
  const sessionEntry = { id: sessionId }
  const handle = {
    id: sessionId,
    access: 'write',
    async close() { calls.close += 1 },
  }
  return {
    calls,
    ctx: {
      agents: {
        get: () => live ? agent : undefined,
        store: new Map(live ? [[sessionId, agentEntry]] : []),
        detachEntered(entry) {
          calls.agentDetach += 1
          this.store.delete(entry.id)
        },
      },
      sessions: {
        get: () => live ? { id: sessionId } : undefined,
        store: new Map(live ? [[sessionId, sessionEntry]] : []),
        detachEntered(entry) {
          calls.sessionDetach += 1
          this.store.delete(entry.id)
        },
      },
      sessionPersistence: {
        stat: async id => id === sessionId ? { location: { path: file } } : undefined,
        tracker: { openHandles: new Set(live ? [handle] : []) },
      },
      workspaceRegistry: {
        list: () => [{
          id: 'workspace-test',
          sessionIds: [sessionId],
          detachSession: async () => { calls.detach += 1 },
        }],
        unarchiveSession: async () => { calls.archive += 1 },
        unpinSession: async () => { calls.pin += 1 },
      },
      logger: { warn: () => {} },
    },
  }
}

const root = await mkdtemp(join(tmpdir(), 'dsh-delete-handler-'))
try {
  const id = 'session-handler-test'
  const dir = join(root, id)
  const file = join(dir, 'session.v4.jsonl.zstd')

  async function seed() {
    await mkdir(dir)
    await writeFile(file, 'log')
  }

  await seed()
  const success = context(id, file)
  const ok = response()
  await handle(success.ctx, request(id), ok)
  assert.equal(ok.status, 200)
  assert.deepEqual(ok.payload, { ok: true, deleted: true, forced: false, sessionId: id })
  assert.deepEqual(success.calls, {
    archive: 1, pin: 1, detach: 1,
    cancel: 0, idle: 0, scope: 0, close: 0, agentDetach: 0, sessionDetach: 0,
  })
  await assert.rejects(stat(dir), { code: 'ENOENT' })

  await seed()
  const safe = context(id, file, { live: true })
  const refused = response()
  await handle(safe.ctx, request(id), refused)
  assert.equal(refused.status, 409)
  assert.equal(refused.payload.code, 'live')
  assert.equal((await stat(file)).isFile(), true)
  assert.deepEqual(safe.calls, {
    archive: 0, pin: 0, detach: 0,
    cancel: 0, idle: 0, scope: 0, close: 0, agentDetach: 0, sessionDetach: 0,
  })

  const forced = context(id, file, { live: true })
  const forcedResponse = response()
  await handle(forced.ctx, request(id, true), forcedResponse)
  assert.equal(forcedResponse.status, 200)
  assert.deepEqual(forcedResponse.payload, { ok: true, deleted: true, forced: true, sessionId: id })
  assert.deepEqual(forced.calls, {
    archive: 1, pin: 1, detach: 1,
    cancel: 1, idle: 1, scope: 1, close: 1, agentDetach: 1, sessionDetach: 1,
  })
  await assert.rejects(stat(dir), { code: 'ENOENT' })

  const project = join(root, 'workspace-project')
  await mkdir(join(project, 'src'), { recursive: true })
  await writeFile(join(project, 'src', 'index.js'), 'user file')
  let workspaceDeleted = 0
  const workspaceResponse = response()
  await handleWorkspace({
    workspaceRegistry: {
      list: () => [{ id: 'workspace-test', path: project }],
      delete: async () => { workspaceDeleted += 1; return true },
    },
    logger: { warn: () => {} },
  }, workspaceRequest('workspace-test'), workspaceResponse)
  assert.equal(workspaceResponse.status, 200)
  assert.deepEqual(workspaceResponse.payload, {
    ok: true, deleted: true, removedFolder: true,
    workspaceId: 'workspace-test', path: workspaceFolder(project),
  })
  assert.equal(workspaceDeleted, 1)
  await assert.rejects(stat(project), { code: 'ENOENT' })
  assert.throws(() => workspaceFolder('relative/path'))
  assert.throws(() => workspaceFolder('C:\\'))

  console.log('handler success + safe refusal + forced live deletion + workspace folder tests ok')
} finally {
  await rm(root, { recursive: true, force: true })
}
