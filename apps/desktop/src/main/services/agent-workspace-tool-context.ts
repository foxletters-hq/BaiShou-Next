import type { AgentSessionKind } from '@baishou/shared'
import { getWorkspaceSessionBinding } from './agent-workspace-session.store'

const activeWorkspaceStreamSessionIds: string[] = []

export function setActiveWorkspaceStreamSessionId(sessionId: string | null): void {
  activeWorkspaceStreamSessionIds.length = 0
  if (sessionId) activeWorkspaceStreamSessionIds.push(sessionId)
}

export function pushActiveWorkspaceStreamSessionId(sessionId: string): void {
  activeWorkspaceStreamSessionIds.push(sessionId)
}

export function removeActiveWorkspaceStreamSessionId(sessionId: string): void {
  const index = activeWorkspaceStreamSessionIds.lastIndexOf(sessionId)
  if (index >= 0) activeWorkspaceStreamSessionIds.splice(index, 1)
}

export function getActiveWorkspaceStreamSessionId(): string | null {
  return activeWorkspaceStreamSessionIds[activeWorkspaceStreamSessionIds.length - 1] ?? null
}

export function isWorkspaceSessionStreaming(sessionId: string): boolean {
  return activeWorkspaceStreamSessionIds.includes(sessionId)
}

/** MCP / shared tool context: bind folder when a workspace stream is active. */
export async function resolveActiveWorkspaceToolContext(): Promise<
  | {
      folderRoot: string
      sessionKind: AgentSessionKind
      notebookIds?: string[]
    }
  | undefined
> {
  const activeWorkspaceStreamSessionId = getActiveWorkspaceStreamSessionId()
  if (!activeWorkspaceStreamSessionId) return undefined
  const binding = await getWorkspaceSessionBinding(activeWorkspaceStreamSessionId)
  if (!binding?.folderRoot) return undefined
  const { readSessionMountedNotebookIds } = await import('./session-mounted-notebooks')
  return {
    folderRoot: binding.folderRoot,
    sessionKind: 'workspace',
    notebookIds: await readSessionMountedNotebookIds(activeWorkspaceStreamSessionId)
  }
}
