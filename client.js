/**
 * Client half of “Permanently delete conversation”.
 *
 * One structured Session menu action opens a themed confirmation dialog. The
 * dialog posts to the Host endpoint; the Host is the only side that touches
 * persistence.
 */

window.__ModuleLoader__.load({
  id: 'dsh-session-delete',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const NS = 'sessionDelete'
    const ENDPOINT = '/api/session-delete'
    const WORKSPACE_ENDPOINT = '/api/workspace-delete'

    const DICTS = {
      zh: {
        'menu.delete': '彻底删除会话',
        'menu.deleteWorkspaceFolder': '删除工作区及文件夹',
        'dialog.workspaceTitle': '删除工作区并删除文件夹？',
        'dialog.workspaceDescription': '即将永久删除工作区「{title}」及其项目文件夹。',
        'dialog.workspaceWarning': '文件夹及其中的所有文件会被递归删除，无法恢复；工作区中的会话记录不会自动删除。',
        'dialog.workspacePath': '将删除以下文件夹：',
        'dialog.workspaceNote': '只删除这个文件夹和 DSH 中的工作区记录，不会影响其他工作区。',
        'dialog.confirmWorkspace': '删除工作区及文件夹',
        'notice.workspaceDeleted': '工作区及文件夹已删除',
        'error.workspaceNotFound': '这个工作区已经不存在，请刷新后重试。',
        'error.folderNotFound': '工作区对应的文件夹不存在，注册记录没有被删除。请检查路径；如果只想移除注册，请使用“删除工作区”。',
        'error.unsafePath': '这个工作区路径受保护，不能删除。',
        'dialog.title': '彻底删除这条会话？',
        'dialog.description': '即将删除「{title}」的整条对话记录，以及 DSH 在本机为它保存的会话文件。',
        'dialog.warning': '此操作不可恢复。正在运行的会话会被强制结束；附件缓存和其他会话不会受到影响。',
        'dialog.activeNote': '如果这个会话仍在 DSH 中打开，删除会先强制结束它的运行，再清除会话记录。',
        'dialog.cancel': '取消',
        'dialog.confirm': '彻底删除',
        'dialog.deleting': '正在删除…',
        'dialog.untitled': '未命名会话',
        'error.live': '无法结束这个会话的进程占用，请重试；如果仍然失败，请重启 DSH 后再删除。',
        'error.invalid': '会话标识无效，无法删除。',
        'error.unknown': '未知错误',
        'error.generic': '删除失败：{message}',
        'error.forbidden': '请求被拒绝，请重试。',
        'error.io': '会话文件暂时无法删除，可能有程序正在占用它。请重试。',
        'error.network': '无法连接到 DSH，请重试。',
        'notice.deleted': '会话记录已清除',
      },
      en: {
        'menu.delete': 'Delete permanently',
        'menu.deleteWorkspaceFolder': 'Delete workspace and folder',
        'dialog.workspaceTitle': 'Delete the workspace and its folder?',
        'dialog.workspaceDescription': 'This permanently deletes the workspace “{title}” and its project folder.',
        'dialog.workspaceWarning': 'The folder and every file inside it will be deleted recursively and cannot be recovered. Conversations in the workspace are not deleted automatically.',
        'dialog.workspacePath': 'Folder to be deleted:',
        'dialog.workspaceNote': 'Only this folder and the DSH workspace registration are removed. Other workspaces are unaffected.',
        'dialog.confirmWorkspace': 'Delete workspace and folder',
        'notice.workspaceDeleted': 'Workspace and folder deleted',
        'error.workspaceNotFound': 'This workspace no longer exists. Refresh and try again.',
        'error.folderNotFound': 'The workspace folder does not exist, so its registration was kept. Check the path; to remove only the registration, use “Delete workspace”.',
        'error.unsafePath': 'This workspace path is protected and cannot be deleted.',
        'dialog.title': 'Delete this conversation permanently?',
        'dialog.description': 'This will permanently delete “{title}” and the session files DSH stored for it on this computer.',
        'dialog.warning': 'This cannot be undone. A running conversation will be forcibly stopped; attachment cache and other conversations are not affected.',
        'dialog.activeNote': 'If this conversation is still open in DSH, deletion first force-stops its run, then removes the conversation.',
        'dialog.cancel': 'Cancel',
        'dialog.confirm': 'Delete permanently',
        'dialog.deleting': 'Deleting…',
        'dialog.untitled': 'Untitled conversation',
        'error.live': 'Could not release this conversation from the DSH process. Please try again; if it still fails, restart DSH and delete it.',
        'error.invalid': 'The session ID is invalid.',
        'error.unknown': 'Unknown error',
        'error.generic': 'Delete failed: {message}',
        'error.forbidden': 'The request was refused. Please try again.',
        'error.io': 'The session file could not be deleted, possibly because another program is using it. Please try again.',
        'error.network': 'Could not reach DSH. Please try again.',
        'notice.deleted': 'Conversation cleared',
      },
      ja: {
        'menu.delete': '完全に削除',
        'dialog.title': 'この会話を完全に削除しますか？',
        'dialog.description': '「{title}」の会話全体と、DSH がこのコンピューターに保存したセッションファイルを完全に削除します。',
        'dialog.warning': 'この操作は元に戻せません。添付ファイルのキャッシュと他の会話には影響しません。',
        'dialog.cancel': 'キャンセル',
        'dialog.confirm': '完全に削除',
        'dialog.deleting': '削除中…',
        'dialog.untitled': '無題の会話',
        'error.live': 'この会話はローカルの DSH プロセスでまだ開いているため、削除できません。DSH を完全に終了して再起動し、この会話を開かずに削除してください。',
        'error.invalid': 'セッション ID が無効です。',
        'error.unknown': '不明なエラー',
        'error.generic': '削除に失敗しました：{message}',
        'notice.deleted': '会話を完全に削除しました',
      },
      es: {
        'menu.delete': 'Eliminar definitivamente',
        'dialog.title': '¿Eliminar esta conversación definitivamente?',
        'dialog.description': 'Se eliminarán definitivamente «{title}» y los archivos de sesión que DSH guardó en este equipo.',
        'dialog.warning': 'Esta acción no se puede deshacer. La caché de adjuntos y las demás conversaciones no se verán afectadas.',
        'dialog.cancel': 'Cancelar',
        'dialog.confirm': 'Eliminar definitivamente',
        'dialog.deleting': 'Eliminando…',
        'dialog.untitled': 'Conversación sin título',
        'error.live': 'Esta conversación sigue abierta en el proceso local de DSH y aún no se puede eliminar. Cierra DSH por completo, vuelve a abrirlo, no abras esta conversación y elimínala entonces.',
        'error.invalid': 'El identificador de sesión no es válido.',
        'error.unknown': 'Error desconocido',
        'error.generic': 'No se pudo eliminar: {message}',
        'notice.deleted': 'Conversación eliminada definitivamente',
      },
      fr: {
        'menu.delete': 'Supprimer définitivement',
        'dialog.title': 'Supprimer définitivement cette conversation ?',
        'dialog.description': '« {title} » et les fichiers de session que DSH a enregistrés sur cet ordinateur seront définitivement supprimés.',
        'dialog.warning': 'Cette action est irréversible. Le cache des pièces jointes et les autres conversations ne sont pas concernés.',
        'dialog.cancel': 'Annuler',
        'dialog.confirm': 'Supprimer définitivement',
        'dialog.deleting': 'Suppression…',
        'dialog.untitled': 'Conversation sans titre',
        'error.live': 'Cette conversation est encore ouverte dans le processus DSH local et ne peut pas être supprimée. Quittez complètement DSH, redémarrez-le, n’ouvrez pas cette conversation, puis supprimez-la.',
        'error.invalid': 'L’identifiant de session n’est pas valide.',
        'error.unknown': 'Erreur inconnue',
        'error.generic': 'Échec de la suppression : {message}',
        'notice.deleted': 'Conversation supprimée définitivement',
      },
      de: {
        'menu.delete': 'Endgültig löschen',
        'dialog.title': 'Diese Unterhaltung endgültig löschen?',
        'dialog.description': '„{title}“ und die zugehörigen, von DSH auf diesem Computer gespeicherten Sitzungsdateien werden endgültig gelöscht.',
        'dialog.warning': 'Dies kann nicht rückgängig gemacht werden. Anhang-Cache und andere Unterhaltungen sind nicht betroffen.',
        'dialog.cancel': 'Abbrechen',
        'dialog.confirm': 'Endgültig löschen',
        'dialog.deleting': 'Wird gelöscht…',
        'dialog.untitled': 'Unbenannte Unterhaltung',
        'error.live': 'Diese Unterhaltung ist noch im lokalen DSH-Prozess geöffnet und kann derzeit nicht gelöscht werden. Beenden Sie DSH vollständig, starten Sie es neu, öffnen Sie diese Unterhaltung nicht und löschen Sie sie dann.',
        'error.invalid': 'Die Sitzungs-ID ist ungültig.',
        'error.unknown': 'Unbekannter Fehler',
        'error.generic': 'Löschen fehlgeschlagen: {message}',
        'notice.deleted': 'Unterhaltung endgültig gelöscht',
      },
      ru: {
        'menu.delete': 'Удалить навсегда',
        'dialog.title': 'Удалить этот диалог навсегда?',
        'dialog.description': 'Диалог «{title}» и файлы сеанса, сохранённые DSH на этом компьютере, будут удалены безвозвратно.',
        'dialog.warning': 'Это действие нельзя отменить. Кэш вложений и другие диалоги не пострадают.',
        'dialog.cancel': 'Отмена',
        'dialog.confirm': 'Удалить навсегда',
        'dialog.deleting': 'Удаление…',
        'dialog.untitled': 'Диалог без названия',
        'error.live': 'Этот диалог всё ещё открыт в локальном процессе DSH, поэтому его нельзя удалить. Полностью закройте и перезапустите DSH, не открывайте этот диалог и повторите удаление.',
        'error.invalid': 'Недопустимый идентификатор сеанса.',
        'error.unknown': 'Неизвестная ошибка',
        'error.generic': 'Не удалось удалить: {message}',
        'notice.deleted': 'Диалог удалён навсегда',
      },
      pt: {
        'menu.delete': 'Excluir permanentemente',
        'dialog.title': 'Excluir esta conversa permanentemente?',
        'dialog.description': 'A conversa “{title}” e os arquivos de sessão que o DSH salvou neste computador serão excluídos permanentemente.',
        'dialog.warning': 'Esta ação não pode ser desfeita. O cache de anexos e as outras conversas não serão afetados.',
        'dialog.cancel': 'Cancelar',
        'dialog.confirm': 'Excluir permanentemente',
        'dialog.deleting': 'Excluindo…',
        'dialog.untitled': 'Conversa sem título',
        'error.live': 'Esta conversa ainda está aberta no processo local do DSH e não pode ser excluída agora. Feche completamente o DSH, reinicie-o, não abra esta conversa e tente excluí-la novamente.',
        'error.invalid': 'O identificador da sessão é inválido.',
        'error.unknown': 'Erro desconhecido',
        'error.generic': 'Falha ao excluir: {message}',
        'notice.deleted': 'Conversa excluída permanentemente',
      },
    }

    // New keys are authored in zh/en first; keep every other locale complete
    // with the English copy until a translation is added.
    for (const dict of Object.values(DICTS)) {
      for (const [key, value] of Object.entries(DICTS.en)) {
        if (!(key in dict)) dict[key] = value
      }
    }

    let pending = null
    const listeners = new Set()

    function emit() {
      for (const listener of listeners) listener(pending)
    }

    function update(mutator) {
      if (pending === null) return
      pending = mutator(pending)
      emit()
    }

    function openDialog(target) {
      pending = {
        kind: 'session',
        key: target.sessionId,
        sessionId: target.sessionId,
        title: target.displayTitle || '',
        busy: false,
        error: '',
      }
      emit()
    }

    function openWorkspaceDialog(target) {
      pending = {
        kind: 'workspace',
        key: target.workspaceId,
        workspaceId: target.workspaceId,
        path: target.path,
        title: target.displayTitle || target.path,
        busy: false,
        error: '',
      }
      emit()
    }

    function closeDialog() {
      pending = null
      emit()
    }

    function usePending() {
      const [value, setValue] = React.useState(pending)
      React.useEffect(() => {
        listeners.add(setValue)
        setValue(pending)
        return () => { listeners.delete(setValue) }
      }, [])
      return value
    }

    function TrashIcon({ size = 20 }) {
      return h('svg', {
        viewBox: '0 0 64 64',
        width: size,
        height: size,
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 4,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        style: { display: 'block', flex: 'none' },
      },
        h('path', { d: 'M12 18h40' }),
        h('path', { d: 'M26 18v-6h12v6' }),
        h('path', { d: 'M18 18l3 34h22l3-34' }),
        h('path', { d: 'M27 28v16M37 28v16' }),
      )
    }

    function DeleteDialog({ t }) {
      const state = usePending()
      const cancelRef = React.useRef(null)
      const panelRef = React.useRef(null)

      React.useEffect(() => {
        if (state === null) return undefined
        const previous = document.activeElement
        const timer = setTimeout(() => { cancelRef.current?.focus() }, 0)
        return () => {
          clearTimeout(timer)
          if (previous && typeof previous.focus === 'function') previous.focus()
        }
      }, [state?.key])

      React.useEffect(() => {
        if (state === null) return undefined
        const onKey = (event) => {
          if (event.key === 'Escape' && !state.busy) {
            event.preventDefault()
            event.stopPropagation()
            closeDialog()
            return
          }
          if (event.key !== 'Tab') return
          const root = panelRef.current
          if (root === null) return
          const nodes = Array.from(root.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'))
          if (nodes.length === 0) {
            event.preventDefault()
            root.focus()
            return
          }
          const first = nodes[0]
          const last = nodes[nodes.length - 1]
          if (event.shiftKey && (document.activeElement === first || !root.contains(document.activeElement))) {
            event.preventDefault()
            last.focus()
          } else if (!event.shiftKey && (document.activeElement === last || !root.contains(document.activeElement))) {
            event.preventDefault()
            first.focus()
          }
        }
        window.addEventListener('keydown', onKey, true)
        return () => { window.removeEventListener('keydown', onKey, true) }
      }, [state?.key, state?.busy])

      React.useEffect(() => {
        if (state === null) return
        if (state.busy) panelRef.current?.focus()
        else if (state.error !== '') cancelRef.current?.focus()
      }, [state?.busy, state?.error])

      if (state === null) return null

      const title = state.title || t('dialog.untitled')
      const workspace = state.kind === 'workspace'

      async function confirm() {
        if (state.busy) return
        update(current => ({ ...current, busy: true, error: '' }))
        let reached = false
        try {
          const workspace = state.kind === 'workspace'
          const response = await fetch(workspace ? WORKSPACE_ENDPOINT : ENDPOINT, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'x-dsh-session-delete': '1',
            },
            body: JSON.stringify(workspace
              ? { workspaceId: state.workspaceId }
              : { sessionId: state.sessionId, force: true }),
          })
          reached = true
          const result = await response.json().catch(() => ({}))
          if (!response.ok || result?.ok !== true) {
            const code = result?.code
            if (code === 'live') throw new Error(t('error.live'))
            if (code === 'invalid-id') throw new Error(t('error.invalid'))
            if (code === 'forbidden') throw new Error(t('error.forbidden'))
            if (code === 'io-error') throw new Error(t('error.io'))
            if (code === 'workspace-not-found') throw new Error(t('error.workspaceNotFound'))
            if (code === 'folder-not-found') throw new Error(t('error.folderNotFound'))
            if (code === 'unsafe-path') throw new Error(t('error.unsafePath'))
            throw new Error(t('error.generic', { message: t('error.unknown') }))
          }
          closeDialog()
          if (workspace) {
            ctx.contextMenus.notify(t('notice.workspaceDeleted'), true)
            return
          }
          try {
            await ctx.sessions.refresh()
          } catch { /* the deleted artifact is authoritative */ }
          ctx.contextMenus.notify(t('notice.deleted'), true)
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          update(current => ({
            ...current,
            busy: false,
            error: reached ? message : t('error.network'),
          }))
        }
      }

      return h('div', {
        style: {
          position: 'fixed',
          inset: 0,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
          background: 'var(--dsw-alias-bg-mask-3)',
        },
        onMouseDown: (event) => {
          if (event.target === event.currentTarget && !state.busy) closeDialog()
        },
      },
        h('div', {
          ref: panelRef,
          role: 'dialog',
          'aria-modal': 'true',
          'aria-busy': state.busy,
          tabIndex: -1,
          'aria-labelledby': 'dsh-session-delete-title',
          'aria-describedby': 'dsh-session-delete-description dsh-session-delete-workspace-path dsh-session-delete-warning dsh-session-delete-active-note',
          style: {
            width: 'min(440px, 100%)',
            boxSizing: 'border-box',
            background: 'var(--dsw-alias-bg-layer-1)',
            color: 'var(--dsw-alias-label-primary)',
            border: '1px solid var(--dsw-alias-border-l2)',
            borderRadius: 14,
            padding: 22,
            boxShadow: '0 18px 50px var(--dsw-alias-bg-mask-3)',
            font: 'inherit',
          },
        },
          h('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 14 } },
            h('div', {
              style: {
                width: 40,
                height: 40,
                borderRadius: 10,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'var(--dsw-alias-interactive-bg-hover-danger)',
                color: 'var(--dsw-alias-state-error-primary)',
              },
            }, h(TrashIcon, { size: 21 })),
            h('div', { style: { minWidth: 0, flex: 1 } },
              h('h2', {
                id: 'dsh-session-delete-title',
                style: { margin: 0, fontSize: 16, lineHeight: 1.45, fontWeight: 600 },
              }, t(workspace ? 'dialog.workspaceTitle' : 'dialog.title')),
              h('p', {
                id: 'dsh-session-delete-description',
                style: {
                  margin: '8px 0 0',
                  color: 'var(--dsw-alias-label-secondary)',
                  fontSize: 13,
                  lineHeight: 1.6,
                  wordBreak: 'break-word',
                },
              }, workspace
                ? t('dialog.workspaceDescription', { title })
                : t('dialog.description', { title })),
            ),
          ),
          workspace ? h('div', {
            id: 'dsh-session-delete-workspace-path',
            style: {
              margin: '14px 0 0',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--dsw-alias-bg-layer-2)',
              color: 'var(--dsw-alias-label-secondary)',
              fontSize: 12,
              lineHeight: 1.6,
            },
          },
            h('div', { style: { marginBottom: 4 } }, t('dialog.workspacePath')),
            h('code', {
              style: {
                display: 'block',
                color: 'var(--dsw-alias-label-primary)',
                fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
                fontSize: 12,
                lineHeight: 1.5,
                wordBreak: 'break-all',
              },
            }, state.path),
          ) : null,
          h('p', {
            id: 'dsh-session-delete-warning',
            style: {
              margin: '14px 0 0',
              padding: '10px 12px',
              borderRadius: 8,
              background: 'var(--dsw-alias-bg-layer-2)',
              color: 'var(--dsw-alias-label-primary)',
              fontSize: 12,
              lineHeight: 1.6,
            },
          }, t(workspace ? 'dialog.workspaceWarning' : 'dialog.warning')),
          h('p', {
            id: 'dsh-session-delete-active-note',
            style: {
              margin: '8px 0 0',
              color: 'var(--dsw-alias-label-secondary)',
              fontSize: 12,
              lineHeight: 1.55,
            },
          }, t(workspace ? 'dialog.workspaceNote' : 'dialog.activeNote')),
          state.error === '' ? null : h('p', {
            role: 'alert',
            style: {
              margin: '10px 0 0',
              padding: '9px 12px',
              borderRadius: 8,
              background: 'var(--dsw-alias-bg-layer-3)',
              color: 'var(--dsw-alias-label-primary)',
              borderLeft: '3px solid var(--dsw-alias-state-error-primary)',
              fontSize: 12,
              lineHeight: 1.55,
              wordBreak: 'break-word',
            },
          }, state.error),
          h('div', {
            style: { marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 },
          },
            h('button', {
              ref: cancelRef,
              type: 'button',
              disabled: state.busy,
              onClick: closeDialog,
              style: {
                appearance: 'none',
                border: '1px solid var(--dsw-alias-border-l2)',
                background: 'transparent',
                color: 'var(--dsw-alias-label-primary)',
                borderRadius: 8,
                padding: '8px 14px',
                font: 'inherit',
                fontSize: 13,
                cursor: state.busy ? 'default' : 'pointer',
                opacity: state.busy ? 0.55 : 1,
              },
            }, t('dialog.cancel')),
            h('button', {
              type: 'button',
              disabled: state.busy,
              onClick: () => { void confirm() },
              style: {
                appearance: 'none',
                border: '1px solid var(--dsw-alias-state-error-primary)',
                background: 'var(--dsw-alias-state-error-primary)',
                color: 'var(--dsw-alias-label-on-color)',
                borderRadius: 8,
                padding: '8px 14px',
                font: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                cursor: state.busy ? 'default' : 'pointer',
                opacity: state.busy ? 0.65 : 1,
              },
            }, state.busy
              ? t('dialog.deleting')
              : t(workspace ? 'dialog.confirmWorkspace' : 'dialog.confirm')),
          ),
        ),
      )
    }

    const inject = ['slots', 'contextMenus', 'locale', 'sessions']

    function apply(ctx) {
      ctx.effect(() => ctx.locale.register(NS, DICTS), 'session-delete: locale')
      const t = ctx.locale.bind(NS)

      ctx.effect(() => ctx.contextMenus.register({
        id: 'session.delete',
        target: 'session',
        order: 700,
        resolve(target) {
          return [{
            id: 'delete',
            label: t('menu.delete'),
            icon: { key: 'session.delete' },
            danger: true,
            afterContent: true,
            run: () => { openDialog(target) },
          }]
        },
      }), 'session-delete: menu')

      ctx.effect(() => ctx.contextMenus.register({
        id: 'workspace.delete-folder',
        target: 'workspace',
        order: 350,
        resolve(target) {
          return [{
            id: 'delete-folder',
            label: t('menu.deleteWorkspaceFolder'),
            icon: { key: 'workspace.deleteFolder' },
            danger: true,
            separatorBefore: true,
            run: () => { openWorkspaceDialog(target) },
          }]
        },
      }), 'session-delete: workspace menu')

      ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
        name: 'contextMenu.icon',
        key: 'session.delete',
      }, TrashIcon))

      ctx.slots.inject('contextMenu.icon', () => ctx.slots.register({
        name: 'contextMenu.icon',
        key: 'workspace.deleteFolder',
      }, TrashIcon))

      ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'session-delete-confirm',
        order: 1200,
        locale: NS,
      }, DeleteDialog))
    }

    return { inject, apply }
  },
})
