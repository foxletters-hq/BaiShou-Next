import type { AgentWorkspaceSessionListItem } from '@baishou/shared'

export type SessionTimeGroupKey = 'pinned' | 'today' | 'yesterday' | 'previous7days' | 'older'

export interface SessionTimeGroup {
  key: SessionTimeGroupKey
  sessions: AgentWorkspaceSessionListItem[]
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function sortWorkspaceSessions(
  sessions: AgentWorkspaceSessionListItem[]
): AgentWorkspaceSessionListItem[] {
  return [...sessions].sort((a, b) => {
    const aPinned = Boolean(a.isPinned)
    const bPinned = Boolean(b.isPinned)
    if (aPinned !== bPinned) return aPinned ? -1 : 1
    return b.updatedAt.localeCompare(a.updatedAt)
  })
}

/** 置顶会话全部保留，其余按最近活跃补到 limit。 */
export function previewWorkspaceSessions(
  sessions: AgentWorkspaceSessionListItem[],
  limit: number
): { preview: AgentWorkspaceSessionListItem[]; hasMore: boolean } {
  const sorted = sortWorkspaceSessions(sessions)
  const pinned = sorted.filter((session) => session.isPinned)
  const unpinned = sorted.filter((session) => !session.isPinned)
  const unpinnedPreview = unpinned.slice(0, Math.max(0, limit - pinned.length))
  return {
    preview: [...pinned, ...unpinnedPreview],
    hasMore: unpinned.length > unpinnedPreview.length
  }
}

export function groupSessionsByTime(sessions: AgentWorkspaceSessionListItem[]): SessionTimeGroup[] {
  const now = new Date()
  const todayStart = startOfDay(now).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - 7 * 86_400_000

  const buckets: Record<SessionTimeGroupKey, AgentWorkspaceSessionListItem[]> = {
    pinned: [],
    today: [],
    yesterday: [],
    previous7days: [],
    older: []
  }

  for (const session of sortWorkspaceSessions(sessions)) {
    if (session.isPinned) {
      buckets.pinned.push(session)
      continue
    }
    const updatedAt = new Date(session.updatedAt).getTime()
    if (Number.isNaN(updatedAt)) {
      buckets.older.push(session)
      continue
    }
    if (updatedAt >= todayStart) buckets.today.push(session)
    else if (updatedAt >= yesterdayStart) buckets.yesterday.push(session)
    else if (updatedAt >= weekStart) buckets.previous7days.push(session)
    else buckets.older.push(session)
  }

  const order: SessionTimeGroupKey[] = ['pinned', 'today', 'yesterday', 'previous7days', 'older']
  return order
    .map((key) => ({ key, sessions: buckets[key] }))
    .filter((group) => group.sessions.length > 0)
}
