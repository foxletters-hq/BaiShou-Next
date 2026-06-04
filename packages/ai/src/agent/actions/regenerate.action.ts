import {
  type ActionDeps,
  type StreamRunConfig,
  extractTextFromUserMessage,
  runStreamWithPersistence
} from './base.action'
import type { SessionRepository, SnapshotRepository } from '@baishou/database'
import { truncateSessionAfterOrderIndex } from '../session-truncate.utils'

export async function runRegenerateAction(
  deps: ActionDeps,
  config: StreamRunConfig,
  messageId?: string
): Promise<boolean> {
  const sessionRepo = deps.realSessionRepo as SessionRepository
  const snapshotRepo = deps.realSnapshotRepo as SnapshotRepository

  let targetMessage
  if (messageId) {
    targetMessage = await sessionRepo.getMessageById(messageId)
  }

  let userMessage
  if (targetMessage && targetMessage.role === 'assistant') {
    const messages = await sessionRepo.getMessagesBySession(deps.sessionId, 100)
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
    const messages = await sessionRepo.getMessagesBySession(deps.sessionId, 5)
    userMessage = messages.find((m) => m.role === 'user')
  }

  if (!userMessage) return false

  await truncateSessionAfterOrderIndex(
    sessionRepo,
    snapshotRepo,
    deps.sessionId,
    userMessage.orderIndex
  )

  return runStreamWithPersistence(deps, {
    ...config,
    userText: extractTextFromUserMessage(
      userMessage as Parameters<typeof extractTextFromUserMessage>[0]
    ),
    skipUserMessageRecording: true,
    userMessageId: userMessage.id
  })
}
