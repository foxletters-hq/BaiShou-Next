import type { MockChatMessage } from '@baishou/shared'

export interface ChatBubbleProps {
  message: MockChatMessage
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
  onShowContext?: (msg: MockChatMessage) => void
  onReadAloud?: (content: string) => void
  isTtsPlaying?: boolean
}

export type { MockChatMessage }
