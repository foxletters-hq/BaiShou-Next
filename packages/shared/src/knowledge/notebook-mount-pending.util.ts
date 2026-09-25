import { parseMountedNotebookIds } from './mounted-notebook.util'

const pendingByKey = new Map<string, string[]>()

export type NotebookMountScope = 'companion' | 'workbench'

/** 尚未落库的草稿会话（无 id、/chat/new-session、临时 new-<ts>） */
export function isDraftNotebookMountSessionId(sessionId?: string | null): boolean {
  const id = String(sessionId || '').trim()
  if (!id || id === 'new-session') return true
  return /^new-\d+$/.test(id)
}

export function notebookMountPendingKey(opts?: {
  sessionId?: string | null
  assistantId?: string | null
  scope?: NotebookMountScope
}): string {
  if (!isDraftNotebookMountSessionId(opts?.sessionId) && opts?.sessionId) {
    return `session:${String(opts.sessionId).trim()}`
  }
  const scope = opts?.scope?.trim() || 'companion'
  const assistant = String(opts?.assistantId || 'default').trim() || 'default'
  return `draft:${scope}:${assistant}`
}

export function getPendingMountedNotebookIds(key: string): string[] {
  return parseMountedNotebookIds(pendingByKey.get(key) ?? [])
}

export function setPendingMountedNotebookIds(key: string, ids: unknown): string[] {
  const next = parseMountedNotebookIds(ids)
  pendingByKey.set(key, next)
  return next
}

export function takePendingMountedNotebookIds(key: string): string[] {
  const ids = getPendingMountedNotebookIds(key)
  pendingByKey.delete(key)
  return ids
}

export function shouldShowSessionContextUsageRing(opts: {
  messageCount: number
  hidden?: boolean
}): boolean {
  if (opts.hidden) return false
  return opts.messageCount > 0
}
