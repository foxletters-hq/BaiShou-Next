export interface SessionInfo {
  id: string
  title: string
  assistantName: string
  assistantEmoji: string
  messageCount: number
  isPinned: boolean
  updatedAt: Date
}

export interface SessionManagementPageProps {
  sessions: SessionInfo[]
  onSessionTap: (session: SessionInfo) => void
  onDeleteSession: (sessionId: string) => void
  onDeleteMultiple: (sessionIds: string[]) => void
  onPinToggle: (sessionId: string) => void
  onRename: (sessionId: string, newTitle: string) => void
}

export interface DeleteTarget {
  type: 'single' | 'multiple'
  id?: string
}
