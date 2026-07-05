import {
  type ActionDeps,
  type StreamRunConfig,
  extractUserMessagePayload,
  hasUserMessagePayload,
  runStreamWithPersistence
} from './base.action'
import type { SessionRepository, SnapshotRepository } from '@baishou/database'
import {
  truncateSessionAfterOrderIndex,
  truncateOptionsWithDiskFlush
} from '../session-truncate.utils'

export async function runResendAction(
  deps: ActionDeps,
  config: StreamRunConfig,
  messageId: string
): Promise<boolean> {
  const sessionRepo = deps.realSessionRepo as SessionRepository
  const snapshotRepo = deps.realSnapshotRepo as SnapshotRepository

  const targetMsg = await sessionRepo.getMessageById(messageId)
  if (!targetMsg) {
    deps.emitter.sendFinish(deps.sessionId, { error: '消息不存在' })
    return false
  }

  const messages = await sessionRepo.getMessagesBySession(deps.sessionId, 1000)
  const targetWithParts = messages.find((m) => m.id === messageId)
  if (!targetWithParts) {
    deps.emitter.sendFinish(deps.sessionId, { error: '无法获取消息内容' })
    return false
  }

  const { userText, attachments } = extractUserMessagePayload(targetWithParts)
  if (!hasUserMessagePayload({ userText, attachments })) {
    deps.emitter.sendFinish(deps.sessionId, { error: '消息内容为空' })
    return false
  }

  await truncateSessionAfterOrderIndex(
    sessionRepo,
    snapshotRepo,
    deps.sessionId,
    targetMsg.orderIndex,
    truncateOptionsWithDiskFlush(deps.sessionManager)
  )

  return runStreamWithPersistence(deps, {
    ...config,
    userText,
    attachments,
    skipUserMessageRecording: true,
    forceRecompress: true,
    userMessageId: messageId
  })
}
