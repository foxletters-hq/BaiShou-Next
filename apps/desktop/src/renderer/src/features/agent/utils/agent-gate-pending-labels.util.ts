export type AgentGatePendingLookupKeys = {
  workspaceIds: string[]
  sessionIds: string[]
}

export type AgentGatePendingNameMaps = {
  workspaceNames: Record<string, string>
  sessionTitles: Record<string, string>
}

export type AgentGatePendingNameMapDeps = {
  listWorkspaces: () => Promise<Array<{ id: string; displayName: string }>>
  listSessions: () => Promise<Array<{ sessionId: string; title: string }>>
  getSession: (sessionId: string) => Promise<{ title?: string | null } | null>
  untitledSession: string
}

type AgentGatePendingLookupGroup = {
  sessionId: string
  scope?: { kind: string; workspaceId?: string }
}

/** 与抽屉旧展示一致：超过 12 个字符时截到前 10 个加省略号 */
export function truncateAgentGateId(id: string): string {
  if (id.length <= 12) return id
  return `${id.slice(0, 10)}…`
}

export function lookupAgentGatePendingName(
  id: string,
  names: Readonly<Record<string, string>>
): string {
  return names[id] || truncateAgentGateId(id)
}

export function collectAgentGatePendingLookupKeys(
  groups: readonly AgentGatePendingLookupGroup[]
): AgentGatePendingLookupKeys {
  const workspaceIds = new Set<string>()
  const sessionIds = new Set<string>()

  for (const group of groups) {
    sessionIds.add(group.sessionId)
    if (group.scope?.kind === 'workspace' && group.scope.workspaceId) {
      workspaceIds.add(group.scope.workspaceId)
    }
  }

  return {
    workspaceIds: [...workspaceIds],
    sessionIds: [...sessionIds]
  }
}

function rememberSessionTitle(
  sessionTitles: Record<string, string>,
  sessionId: string,
  title: string | null | undefined,
  untitledSession: string
): void {
  const trimmed = title?.trim()
  sessionTitles[sessionId] = trimmed || untitledSession
}

export async function loadAgentGatePendingNameMaps(
  keys: AgentGatePendingLookupKeys,
  deps: AgentGatePendingNameMapDeps
): Promise<AgentGatePendingNameMaps> {
  const workspaceNames: Record<string, string> = {}
  const sessionTitles: Record<string, string> = {}

  if (keys.workspaceIds.length > 0) {
    try {
      const list = await deps.listWorkspaces()
      if (Array.isArray(list)) {
        for (const workspace of list) {
          const name = workspace.displayName?.trim()
          if (name) workspaceNames[workspace.id] = name
        }
      }
    } catch {
      /* 列表失败时回退到截断 id */
    }
  }

  const missingSessionIds = new Set(keys.sessionIds)
  if (keys.sessionIds.length > 0) {
    try {
      const list = await deps.listSessions()
      if (Array.isArray(list)) {
        for (const row of list) {
          if (!missingSessionIds.has(row.sessionId)) continue
          rememberSessionTitle(sessionTitles, row.sessionId, row.title, deps.untitledSession)
          missingSessionIds.delete(row.sessionId)
        }
      }
    } catch {
      /* 工作区会话列表失败时改走单条查询 */
    }
  }

  await Promise.all(
    [...missingSessionIds].map(async (sessionId) => {
      try {
        const doc = await deps.getSession(sessionId)
        if (!doc) return
        rememberSessionTitle(sessionTitles, sessionId, doc.title, deps.untitledSession)
      } catch {
        /* 单条失败保持截断 id */
      }
    })
  )

  return { workspaceNames, sessionTitles }
}
