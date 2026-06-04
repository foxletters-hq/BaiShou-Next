import { type ActionDeps, type StreamRunConfig, runStreamWithPersistence } from './base.action'
import type { SessionRepository, SnapshotRepository } from '@baishou/database'
import { truncateSessionAfterOrderIndex } from '../session-truncate.utils'

export async function runEditMessageAction(
  deps: ActionDeps,
  config: StreamRunConfig,
  messageId: string,
  newText: string
): Promise<boolean> {
  const sessionRepo = deps.realSessionRepo as SessionRepository
  const snapshotRepo = deps.realSnapshotRepo as SnapshotRepository

  const targetMsg = await sessionRepo.getMessageById(messageId)
  if (!targetMsg) return false

  await sessionRepo.updateMessageTextPart(messageId, newText)

  if (targetMsg.role === 'assistant') {
    deps.emitter.sendFinish(deps.sessionId, { success: true })
    return true
  }

  await truncateSessionAfterOrderIndex(
    sessionRepo,
    snapshotRepo,
    deps.sessionId,
    targetMsg.orderIndex
  )

  return runStreamWithPersistence(deps, {
    ...config,
    userText: newText,
    skipUserMessageRecording: true,
    userMessageId: messageId
  })
}
