import type { AgentSession } from './agent-session-list.types'

export type TimeGroup = 'pinned' | 'today' | 'yesterday' | 'thisWeek' | 'earlier'

export const groupOrder: TimeGroup[] = ['pinned', 'today', 'yesterday', 'thisWeek', 'earlier']

export const getTimeGroup = (timestamp: number, isPinned: boolean): TimeGroup => {
  if (isPinned) return 'pinned'
  const now = new Date()
  const date = new Date(timestamp)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOfWeek = new Date(startOfToday.getTime() - 7 * 86400000)

  if (date >= startOfToday) return 'today'
  if (date >= startOfYesterday) return 'yesterday'
  if (date >= startOfWeek) return 'thisWeek'
  return 'earlier'
}

export type FlatSessionListRow =
  | { type: 'header'; key: string; group: TimeGroup; label: string }
  | { type: 'session'; key: string; session: AgentSession }

export function groupSessionsByTime(
  sessions: AgentSession[],
  getGroupLabel: (group: TimeGroup) => string
) {
  const groups: Record<TimeGroup, AgentSession[]> = {
    pinned: [],
    today: [],
    yesterday: [],
    thisWeek: [],
    earlier: []
  }
  for (const session of sessions) {
    groups[getTimeGroup(session.lastMessageAt, session.isPinned)].push(session)
  }
  return groupOrder
    .filter((g) => groups[g].length > 0)
    .map((g) => ({ group: g, label: getGroupLabel(g), items: groups[g]! }))
}

export function flattenGroupedSessions(
  groups: Array<{ group: TimeGroup; label: string; items: AgentSession[] }>
): FlatSessionListRow[] {
  const rows: FlatSessionListRow[] = []
  for (const g of groups) {
    rows.push({
      type: 'header',
      key: `header:${g.group}`,
      group: g.group,
      label: g.label
    })
    for (const session of g.items) {
      rows.push({
        type: 'session',
        key: `session:${session.id}`,
        session
      })
    }
  }
  return rows
}

export const formatSessionTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}
