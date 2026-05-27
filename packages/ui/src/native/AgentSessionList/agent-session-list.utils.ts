import type { AgentSession } from './agent-session-list.types'

export type TimeGroup = 'pinned' | 'today' | 'yesterday' | 'thisWeek' | 'earlier'

export const groupOrder: TimeGroup[] = ['pinned', 'today', 'yesterday', 'thisWeek', 'earlier']

export const groupLabels: Record<TimeGroup, string> = {
  pinned: '置顶',
  today: '今天',
  yesterday: '昨天',
  thisWeek: '本周',
  earlier: '更早'
}

export const getTimeGroup = (timestamp: number, isPinned: boolean): TimeGroup => {
  if (isPinned) return 'pinned'
  const now = new Date()
  const date = new Date(timestamp)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000)
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000)

  if (date >= startOfToday) return 'today'
  if (date >= startOfYesterday) return 'yesterday'
  if (date >= startOfWeek) return 'thisWeek'
  return 'earlier'
}

export const formatSessionTime = (timestamp: number): string => {
  const date = new Date(timestamp)
  const hours = date.getHours().toString().padStart(2, '0')
  const minutes = date.getMinutes().toString().padStart(2, '0')
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

export function groupSessionsByTime(sessions: AgentSession[]) {
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
    .map((g) => ({ group: g, label: groupLabels[g], items: groups[g]! }))
}
