import {
  type ActionDeps,
  type StreamRunConfig,
  extractTextFromUserMessage,
  runStreamWithPersistence
} from './base.action'

export async function runRegenerateAction(
  deps: ActionDeps,
  config: StreamRunConfig,
  messageId?: string
): Promise<boolean> {
  const repo = deps.realSessionRepo as {
    getMessageById(id: string): Promise<{ role: string; orderIndex: number } | null>
    getMessagesBySession(
      sessionId: string,
      limit: number
    ): Promise<Array<{ id: string; role: string; orderIndex: number; parts?: unknown[] }>>
    deleteMessagesAfter(sessionId: string, orderIndex: number): Promise<void>
  }

  let targetMessage
  if (messageId) {
    targetMessage = await repo.getMessageById(messageId)
  }

  let userMessage
  if (targetMessage && targetMessage.role === 'assistant') {
    const messages = await repo.getMessagesBySession(deps.sessionId, 100)
    const idx = messages.findIndex((m) => m.id === messageId)
    for (let i = idx - 1; i >= 0; i--) {
      const msg = messages[i]
      if (msg?.role === 'user') {
        userMessage = msg
        break
      }
    }
  } else if (targetMessage && targetMessage.role === 'user') {
    userMessage = targetMessage
  }

  if (!userMessage) {
    const messages = await repo.getMessagesBySession(deps.sessionId, 5)
    userMessage = messages.find((m) => m.role === 'user')
  }

  if (!userMessage) return false

  await repo.deleteMessagesAfter(deps.sessionId, userMessage.orderIndex)

  return runStreamWithPersistence(deps, {
    ...config,
    userText: extractTextFromUserMessage(
      userMessage as Parameters<typeof extractTextFromUserMessage>[0]
    ),
    skipUserMessageRecording: true
  })
}
