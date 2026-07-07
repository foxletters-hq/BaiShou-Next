import type { AgentWorkspaceSessionListItem } from '@baishou/shared'

export type SessionTimeGroupKey = 'today' | 'yesterday' | 'previous7days' | 'older'

export interface SessionTimeGroup {
  key: SessionTimeGroupKey
  sessions: AgentWorkspaceSessionListItem[]
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

export function groupSessionsByTime(
  sessions: AgentWorkspaceSessionListItem[]
): SessionTimeGroup[] {
  const now = new Date()
  const todayStart = startOfDay(now).getTime()
  const yesterdayStart = todayStart - 86_400_000
  const weekStart = todayStart - 7 * 86_400_000

  const buckets: Record<SessionTimeGroupKey, AgentWorkspaceSessionListItem[]> = {
    today: [],
    yesterday: [],
    previous7days: [],
    older: []
  }

  for (const session of sessions) {
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

  const order: SessionTimeGroupKey[] = ['today', 'yesterday', 'previous7days', 'older']
  return order
    .map((key) => ({ key, sessions: buckets[key] }))
    .filter((group) => group.sessions.length > 0)
}
