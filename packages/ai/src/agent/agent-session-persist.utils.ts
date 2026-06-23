import type { SessionRepository } from '@baishou/database'

/** 计算新 assistant 消息应挂载的父级 orderIndex（重发/编辑时优先锚定用户消息） */
export async function resolveAssistantParentOrderIndex(
  sessionRepo: SessionRepository,
  sessionId: string,
  options: { skipUserMessageRecording?: boolean; userMessageId?: string }
): Promise<number> {
  if (options.skipUserMessageRecording && options.userMessageId) {
    const userMsg = await sessionRepo.getMessageById(options.userMessageId)
    if (userMsg && typeof userMsg.orderIndex === 'number') {
      return userMsg.orderIndex
    }
  }

  const history = await sessionRepo.getMessagesBySession(sessionId, 1)
  return history.length > 0 && history[0] ? history[0].orderIndex : 0
}
