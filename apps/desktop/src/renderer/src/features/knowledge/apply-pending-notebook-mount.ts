import {
  notebookMountPendingKey,
  takePendingMountedNotebookIds,
  type NotebookMountScope
} from '@baishou/shared'

export async function applyPendingNotebookMountToSession(opts: {
  sessionId: string
  assistantId?: string | null
  scope?: NotebookMountScope
}): Promise<void> {
  const sessionId = opts.sessionId.trim()
  if (!sessionId) return
  const ids = takePendingMountedNotebookIds(
    notebookMountPendingKey({
      sessionId: undefined,
      assistantId: opts.assistantId,
      scope: opts.scope ?? 'companion'
    })
  )
  if (ids.length === 0) return
  if (window.api.setMountedNotebooks) {
    await window.api.setMountedNotebooks(sessionId, ids)
    return
  }
  await window.api.agentWorkspace.attachNotebook({
    sessionId,
    notebookIds: ids
  })
}
