import { type ActionDeps, type StreamRunConfig, runStreamWithPersistence } from './base.action'

export async function runResendAction(
  deps: ActionDeps,
  config: StreamRunConfig,
  messageId: string
): Promise<boolean> {
  const repo = deps.realSessionRepo as {
    getMessageById(id: string): Promise<{ orderIndex: number } | null>
    getMessagesBySession(
      sessionId: string,
      limit: number
    ): Promise<Array<{ id: string; parts?: Array<{ type: string; data?: { text?: string } }> }>>
    deleteMessagesAfter(sessionId: string, orderIndex: number): Promise<void>
  }

  const targetMsg = await repo.getMessageById(messageId)
  if (!targetMsg) {
    deps.emitter.sendFinish(deps.sessionId, { error: '消息不存在' })
    return false
  }

  const messages = await repo.getMessagesBySession(deps.sessionId, 1000)
  const targetWithParts = messages.find((m) => m.id === messageId)
  if (!targetWithParts) {
    deps.emitter.sendFinish(deps.sessionId, { error: '无法获取消息内容' })
    return false
  }

  const textParts = targetWithParts.parts?.filter((p) => p.type === 'text') || []
  const userText = textParts.map((p) => p.data?.text || '').join('\n')
  if (!userText) {
    deps.emitter.sendFinish(deps.sessionId, { error: '消息内容为空' })
    return false
  }

  await repo.deleteMessagesAfter(deps.sessionId, targetMsg.orderIndex)

  return runStreamWithPersistence(deps, {
    ...config,
    userText,
    skipUserMessageRecording: true
  })
}
