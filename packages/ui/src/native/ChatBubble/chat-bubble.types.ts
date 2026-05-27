export interface ChatBubbleMessage {
  id?: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  reasoning?: string
  isReasoning?: boolean
  timestamp?: Date
  toolInvocations?: unknown[]
  attachments?: unknown[]
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
  contextMessages?: ChatBubbleMessage[]
}

export interface ChatBubbleProps {
  message: ChatBubbleMessage
  userProfile?: { nickname: string; avatarPath?: string | null }
  aiProfile?: {
    name: string
    avatarPath?: string | null
    emoji?: string | null
  }
  onEdit?: () => void
  onRegenerate?: () => void
  onResend?: () => void
  onCopy?: () => void
  onDelete?: () => void
  onBranch?: () => void
  onSaveEdit?: (newContent: string) => void
  onResendEdit?: (newContent: string) => void
  onShowContext?: (msg: ChatBubbleMessage) => void
  onReadAloud?: (content: string) => void
  isTtsPlaying?: boolean
}
