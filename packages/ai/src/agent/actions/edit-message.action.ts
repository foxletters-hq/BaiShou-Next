import { type ActionDeps, type StreamRunConfig, runStreamWithPersistence } from './base.action'

export async function runEditMessageAction(
  deps: ActionDeps,
  config: StreamRunConfig,
  messageId: string,
  newText: string
): Promise<boolean> {
  const repo = deps.realSessionRepo as {
    getMessageById(id: string): Promise<{ role: string; orderIndex: number } | null>
    updateMessageTextPart(messageId: string, text: string): Promise<void>
    deleteMessagesAfter(sessionId: string, orderIndex: number): Promise<void>
  }

  const targetMsg = await repo.getMessageById(messageId)
  if (!targetMsg) return false

  await repo.updateMessageTextPart(messageId, newText)

  if (targetMsg.role === 'assistant') {
    deps.emitter.sendFinish(deps.sessionId, { success: true })
    return true
  }

  await repo.deleteMessagesAfter(deps.sessionId, targetMsg.orderIndex)

  return runStreamWithPersistence(deps, {
    ...config,
    userText: newText,
    skipUserMessageRecording: true
  })
}
