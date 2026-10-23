import type { WorkspaceChatMessage } from '../hooks/useWorkspaceChatMessages'

export type WorkspaceBubbleActions = {
  onResend?: (userMessageId: string) => void
  onRegenerate?: (assistantMessageId: string) => void
  onDelete?: (messageId: string) => void
  onShowContext?: (message: WorkspaceChatMessage) => void
  onSaveAssistantEdit?: (messageId: string, text: string) => boolean | Promise<boolean>
}
