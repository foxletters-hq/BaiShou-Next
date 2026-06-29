import { SessionRepository } from '@baishou/database'
import { logger } from '@baishou/shared'
import type { MessageWithParts } from './message.adapter'
import { PRUNE_PROTECT_USER_TURNS, TOOL_PAYLOAD_MAX_BYTES } from './compression.constants'
import {
  estimateToolPayloadSize,
  isPrunedToolPayload,
  sanitizeToolPayloadForPrune
} from './session-tool-payload-sanitizer'

function payloadEquals(a: unknown, b: unknown): boolean {
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return a === b
  }
}

/**
 * 从后往前保留最近 N 个用户回合的完整 tool payload；更早内容按工具类型瘦身。
 */
export class CompressionPruneService {
  static async pruneSession(
    sessionRepo: SessionRepository,
    sessionId: string,
    allMessages?: MessageWithParts[]
  ): Promise<number> {
    try {
      const messages =
        allMessages ??
        ((await sessionRepo.getMessagesBySession(sessionId, 2000)) as MessageWithParts[])

      const updates: Array<{ id: string; data: unknown }> = []
      let userTurnsFromEnd = 0

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]!
        if (msg.role === 'user') userTurnsFromEnd++
        if (!msg.parts?.length) continue

        for (const part of msg.parts) {
          if (part.type !== 'tool') continue
          if (isPrunedToolPayload(part.data)) continue

          const payloadSize = estimateToolPayloadSize(part.data)
          if (payloadSize === 0) continue

          const inProtectedWindow = userTurnsFromEnd < PRUNE_PROTECT_USER_TURNS
          const oversized = payloadSize >= TOOL_PAYLOAD_MAX_BYTES
          if (inProtectedWindow && !oversized) continue

          const sanitized = sanitizeToolPayloadForPrune(part.data)
          if (payloadEquals(sanitized, part.data)) continue

          updates.push({ id: part.id, data: sanitized })
        }
      }

      if (updates.length === 0) return 0

      await sessionRepo.updatePartsDataById(updates)

      logger.info(
        `[CompressionPrune] Session(${sessionId}) pruned ${updates.length} tool parts (protectWindow=${PRUNE_PROTECT_USER_TURNS} user turns).`
      )
      return updates.length
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[CompressionPrune] prune failed:', message)
      return 0
    }
  }
}
