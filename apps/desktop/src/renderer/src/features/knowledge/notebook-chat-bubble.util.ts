import type { MockChatMessage, NotebookChatMessageRecord } from '@baishou/shared'

export function toNotebookChatBubbleMessage(
  message: NotebookChatMessageRecord
): MockChatMessage {
  return {
    id: message.id,
    sessionId: message.sessionId,
    role: message.role,
    content: message.text,
    reasoning: message.reasoning,
    timestamp: new Date(message.createdAt)
  }
}
