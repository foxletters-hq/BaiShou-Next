export interface AgentSession {
  id: string
  title: string
  lastMessageAt: number
  isPinned: boolean
  messageCount: number
}

export interface AgentSessionListProps {
  sessions: AgentSession[]
  onSelect: (id: string) => void
  onPin?: (id: string) => void
  onDelete?: (id: string) => void
  onRename?: (id: string, name: string) => void
}
