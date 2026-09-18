import type { AgentWorkspaceEntry } from '@baishou/shared'
import { isEmbeddingModel, isTtsModel } from '@baishou/shared'
import { workspaceEntryMatchesFolder } from './workspace-display.util'

export const WORKSPACE_SESSIONS_CHANGED_EVENT = 'baishou:workspace-sessions-changed'

export function notifyWorkspaceSessionsChanged(): void {
  window.dispatchEvent(new CustomEvent(WORKSPACE_SESSIONS_CHANGED_EVENT))
}

export function openWorkspacePath(workspaceId: string): string {
  return `/agent-workspace/open/${workspaceId}`
}

export function isPersistedWorkspaceSessionId(sessionId?: string): boolean {
  return Boolean(sessionId && sessionId !== 'new-session')
}

export function resolveActiveWorkspace(params: {
  activeWorkspace?: AgentWorkspaceEntry | null
  routeWorkspaceId?: string
  workspaces: AgentWorkspaceEntry[]
  folderRoot: string | null
}): AgentWorkspaceEntry | null {
  return (
    params.activeWorkspace ??
    (params.routeWorkspaceId
      ? params.workspaces.find((entry) => entry.id === params.routeWorkspaceId)
      : undefined) ??
    (params.folderRoot
      ? params.workspaces.find((entry) => workspaceEntryMatchesFolder(entry, params.folderRoot))
      : undefined) ??
    null
  )
}

export function nextBoundStreamSessionId(params: {
  sessionId?: string
  routeWorkspaceId?: string
}): { next: string | undefined; replace: boolean } {
  if (isPersistedWorkspaceSessionId(params.sessionId)) {
    return { next: params.sessionId, replace: true }
  }
  // /open/:workspaceId 为空白新对话：必须解绑上一会话，否则会继续展示旧消息
  if (params.routeWorkspaceId) {
    return { next: undefined, replace: true }
  }
  return { next: undefined, replace: false }
}

export function folderRegistryKey(folderRoot: string): string {
  return folderRoot.replace(/\\/g, '/').toLowerCase()
}

export function shouldRegisterLooseFolder(params: {
  loadingWorkspaces: boolean
  folderRoot: string | null
  alreadyInList: boolean
  alreadySynced: boolean
}): boolean {
  if (params.loadingWorkspaces || !params.folderRoot) return false
  if (params.alreadyInList || params.alreadySynced) return false
  return true
}

export function resolveLayoutScopeKey(params: {
  routeWorkspaceId?: string
  workspaceId?: string
  folderRoot: string | null
}): string | undefined {
  return params.routeWorkspaceId ?? params.workspaceId ?? params.folderRoot ?? undefined
}

export interface SessionModelMenuProvider {
  id: string
  name: string
  type: string
  models: string[]
  enabledModels: string[]
}

export function toSessionModelMenuProviders(
  providers: Array<{
    id: string
    name?: string
    type?: string
    models?: string[]
    enabledModels?: string[]
  }>
): SessionModelMenuProvider[] {
  return providers
    .map((provider) => {
      const modelList =
        provider.enabledModels && provider.enabledModels.length > 0
          ? provider.enabledModels
          : provider.models || []
      const filteredModels = modelList.filter(
        (model) => !isEmbeddingModel(model) && !isTtsModel(model)
      )
      return {
        id: provider.id,
        name: provider.name || provider.id,
        type: provider.type || 'custom',
        models: provider.models || [],
        enabledModels: filteredModels
      }
    })
    .filter((provider) => provider.enabledModels.length > 0)
}
