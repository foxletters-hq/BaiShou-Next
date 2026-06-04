import { SessionRepository } from '@baishou/database'
import { logger } from '@baishou/shared'
import type { MessageWithParts } from './message.adapter'
import { estimateTextTokens } from './call-chain-view-model.builder'
import { PRUNE_MINIMUM_TOKENS, PRUNE_PROTECT_TOKENS } from './compression.constants'

const PRUNED_PLACEHOLDER = '[工具输出已剪枝，详见对话摘要]'

/**
 * 独立异步 prune：从后往前保留最近 tool 输出，擦除更早的大块 tool 文本（不走 LLM）。
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

      let protectedToolTokens = 0
      let prunedTokens = 0
      const partIds: string[] = []
      let userTurnsFromEnd = 0

      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i]!
        if (msg.role === 'user') userTurnsFromEnd++
        if (userTurnsFromEnd < 2) continue

        if (!msg.parts?.length) continue

        for (const p of msg.parts) {
          if (p.type !== 'tool') continue
          const data = p.data as { result?: unknown; text?: string }
          const raw =
            typeof data?.result === 'string'
              ? data.result
              : data?.result !== undefined
                ? JSON.stringify(data.result)
                : typeof data?.text === 'string'
                  ? data.text
                  : ''
          if (!raw || raw === PRUNED_PLACEHOLDER) continue

          const tokens = estimateTextTokens(raw)
          if (protectedToolTokens + tokens <= PRUNE_PROTECT_TOKENS) {
            protectedToolTokens += tokens
            continue
          }

          prunedTokens += tokens
          partIds.push(p.id)
        }
      }

      if (prunedTokens < PRUNE_MINIMUM_TOKENS || partIds.length === 0) {
        return 0
      }

      await (
        sessionRepo as {
          updatePartsDataFallback?: (ids: string[], data: object) => Promise<void>
        }
      ).updatePartsDataFallback?.(partIds, { result: PRUNED_PLACEHOLDER })

      logger.info(
        `[CompressionPrune] Session(${sessionId}) pruned ${partIds.length} tool parts (~${prunedTokens} tokens).`
      )
      return partIds.length
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.warn('[CompressionPrune] prune failed:', message)
      return 0
    }
  }
}
