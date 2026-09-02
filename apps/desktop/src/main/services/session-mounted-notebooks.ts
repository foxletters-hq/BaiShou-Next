import { parseMountedNotebookIds } from '@baishou/shared'
import { getWorkspaceSessionBinding } from './agent-workspace-session.store'

export async function readSessionMountedNotebookIds(sessionId: string): Promise<string[]> {
  const { getAgentManagers } = await import('../ipc/agent-helpers')
  const { realSessionRepo } = getAgentManagers()
  const session = await realSessionRepo.getSessionById(sessionId)
  const fromColumn = parseMountedNotebookIds(session?.mountedNotebookIds)
  if (fromColumn.length > 0) return fromColumn

  const binding = await getWorkspaceSessionBinding(sessionId)
  const legacy = parseMountedNotebookIds(binding?.notebookId)
  if (legacy.length === 0) return []

  const { sessionManager } = getAgentManagers()
  await sessionManager.updateMountedNotebookIds(sessionId, legacy)
  return legacy
}

export async function writeSessionMountedNotebookIds(
  sessionId: string,
  notebookIds: string[]
): Promise<string[]> {
  const ids = parseMountedNotebookIds(notebookIds)
  const { getAgentManagers } = await import('../ipc/agent-helpers')
  const { sessionManager } = getAgentManagers()
  await sessionManager.updateMountedNotebookIds(sessionId, ids)
  return ids
}
