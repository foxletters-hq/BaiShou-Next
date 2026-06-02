import { generateText } from 'ai'
import type { ModelMessage } from 'ai'
import { IAIProvider } from '../providers/provider.interface'
import { SessionRepository } from '@baishou/database'
// @ts-ignore
import { SnapshotRepository } from '@baishou/database'
import {
  CompressionErrorCode,
  compressionError,
  getDefaultCompressionSystemPrompt,
  buildAnchoredCompressionUserPrompt
} from '@baishou/shared'
import { logger } from '@baishou/shared'
import { MessageAdapter, MessageWithParts } from './message.adapter'
import {
  estimateContextTokensForTrigger,
  getMessagesAfterSnapshot,
  resolveCompressionBatch,
  hasEnoughMessagesForRecompress,
  hasUserContentInCompressionBatch,
  resolveSessionCompressionConfig,
  resolveCompressionTrigger,
  usableContextTokens,
  computeTailStartMessageId,
  preserveRecentTokenBudget,
  extractMessageText,
  cloneMessagesForCompressionModel,
  type SessionCompressionConfig
} from './context-compression.utils'
import {
  runCompressionWithSessionLock,
  runRecompressWithSessionLock
} from './compression-session-lock'
import { CompressionPruneService } from './compression-prune.service'
import { COMPRESSION_MESSAGE_FETCH_LIMIT } from './compression.constants'

export type { SessionCompressionConfig } from './context-compression.utils'

export type RecompressResult = {
  ok: boolean
  summaryText?: string
  error?: string
  errorCode?: string
}

export class ContextCompressorService {
  /** 带会话锁的压缩入口（请求前 / 消息落库后共用） */
  static async tryCompress(
    provider: IAIProvider,
    modelId: string,
    sessionRepo: SessionRepository,
    snapshotRepo: SnapshotRepository,
    sessionId: string,
    config?: SessionCompressionConfig,
    providerType?: string
  ): Promise<boolean> {
    return runCompressionWithSessionLock(sessionId, () =>
      ContextCompressorService.compress(
        provider,
        modelId,
        sessionRepo,
        snapshotRepo,
        sessionId,
        config,
        providerType
      )
    )
  }

  static schedulePrune(
    sessionRepo: SessionRepository,
    sessionId: string,
    allMessages?: MessageWithParts[]
  ): void {
    void CompressionPruneService.pruneSession(sessionRepo, sessionId, allMessages)
  }

  static async compress(
    provider: IAIProvider,
    modelId: string,
    sessionRepo: SessionRepository,
    snapshotRepo: SnapshotRepository,
    sessionId: string,
    config?: SessionCompressionConfig,
    providerType = ''
  ): Promise<boolean> {
    try {
      const compressionConfig =
        config ?? (await resolveSessionCompressionConfig(sessionId, sessionRepo))

      const usableWindow = usableContextTokens(
        compressionConfig.modelContextWindow ?? 0,
        compressionConfig.reservedTokens
      )
      if (
        compressionConfig.threshold <= 0 &&
        usableWindow <= 0 &&
        !compressionConfig.force
      ) {
        return false
      }

      const allMessages = (await sessionRepo.getMessagesBySession(
        sessionId,
        COMPRESSION_MESSAGE_FETCH_LIMIT
      )) as MessageWithParts[]

      if (allMessages.length < 4) return false

      const latestSnapshot = await snapshotRepo.getLatestSnapshot(sessionId)
      const messagesAfterSnapshot = getMessagesAfterSnapshot(allMessages, latestSnapshot)

      const contextTokens = estimateContextTokensForTrigger(
        allMessages,
        messagesAfterSnapshot,
        latestSnapshot
      )
      if (!resolveCompressionTrigger(contextTokens, compressionConfig)) {
        return false
      }

      const preserveTokens = preserveRecentTokenBudget(compressionConfig)
      const { toCompress, tailStartMessageId: splitTailStart } = resolveCompressionBatch(
        allMessages,
        {
          priorSnapshot: latestSnapshot,
          keepTurns: compressionConfig.keepTurns,
          preserveRecentTokens: preserveTokens
        }
      )

      if (toCompress.length < 2) {
        logger.info(
          `[ContextCompressor] Session(${sessionId}) context ~${contextTokens} but not enough history to compress.`
        )
        return false
      }

      if (!hasUserContentInCompressionBatch(toCompress)) {
        logger.info(`[ContextCompressor] Session(${sessionId}) skip: no user text in batch.`)
        return false
      }

      const generated = await ContextCompressorService.generateSummaryText(
        provider,
        modelId,
        toCompress,
        compressionConfig,
        latestSnapshot?.summaryText ?? null,
        providerType
      )
      if (!generated) return false

      const coveredLastMsg = toCompress[toCompress.length - 1]!
      const tailStartMessageId =
        splitTailStart ?? computeTailStartMessageId(allMessages, coveredLastMsg.id)

      const prevTokenCount = latestSnapshot?.tokenCount ?? 0

      await snapshotRepo.appendSnapshot({
        sessionId: sessionId as string,
        summaryText: generated.text,
        coveredUpToMessageId: coveredLastMsg.id,
        tailStartMessageId,
        messageCount: latestSnapshot
          ? latestSnapshot.messageCount + toCompress.length
          : toCompress.length,
        tokenCount: prevTokenCount + generated.completionTokens
      })

      logger.info(
        `[ContextCompressor] Snapshot Session(${sessionId}); context ~${contextTokens} tokens.`
      )
      return true
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('[ContextCompressor] Compression failed:', message)
      return false
    }
  }

  static async recompressCurrentSnapshot(
    provider: IAIProvider,
    modelId: string,
    sessionRepo: SessionRepository,
    snapshotRepo: SnapshotRepository,
    sessionId: string,
    config?: SessionCompressionConfig,
    providerType = ''
  ): Promise<RecompressResult> {
    const locked = await runRecompressWithSessionLock(sessionId, async () => {
      try {
        const compressionConfig =
          config ?? (await resolveSessionCompressionConfig(sessionId, sessionRepo))

        const snapshots = await snapshotRepo.listSnapshotsBySession(sessionId)
        const latestSnapshot = snapshots[snapshots.length - 1]
        if (!latestSnapshot?.summaryText?.trim()) {
          return compressionError(CompressionErrorCode.NO_SNAPSHOT)
        }

        const previousSnapshot =
          snapshots.length >= 2 ? snapshots[snapshots.length - 2]! : null

        const allMessages = (await sessionRepo.getMessagesBySession(
          sessionId,
          COMPRESSION_MESSAGE_FETCH_LIMIT
        )) as MessageWithParts[]

        const preserveTokens = preserveRecentTokenBudget(compressionConfig)
        const { toCompress, tailStartMessageId: splitTailStart } = resolveCompressionBatch(
          allMessages,
          {
            priorSnapshot: previousSnapshot,
            targetSnapshot: latestSnapshot,
            keepTurns: compressionConfig.keepTurns,
            preserveRecentTokens: preserveTokens
          }
        )

        if (!hasEnoughMessagesForRecompress(toCompress)) {
          return compressionError(CompressionErrorCode.NOT_ENOUGH_MESSAGES)
        }

        if (!hasUserContentInCompressionBatch(toCompress)) {
          return compressionError(CompressionErrorCode.NO_USER_CONTENT)
        }

        const generated = await ContextCompressorService.generateSummaryText(
          provider,
          modelId,
          toCompress,
          compressionConfig,
          previousSnapshot?.summaryText ?? null,
          providerType
        )

        if (!generated?.text.trim()) {
          return compressionError(CompressionErrorCode.EMPTY_SUMMARY)
        }

        const normalizedSummary = generated.text.trim()
        const lastAssistant = [...toCompress].reverse().find((m) => m.role === 'assistant')
        const lastAssistantText = lastAssistant ? extractMessageText(lastAssistant).trim() : ''
        if (
          lastAssistantText.length > 40 &&
          normalizedSummary === lastAssistantText
        ) {
          return compressionError(CompressionErrorCode.VERBATIM_SUMMARY)
        }

        const coveredLastMsg = toCompress[toCompress.length - 1]!
        const tailStartMessageId =
          splitTailStart ?? computeTailStartMessageId(allMessages, coveredLastMsg.id)

        await snapshotRepo.updateSnapshot(latestSnapshot.id, {
          summaryText: normalizedSummary,
          coveredUpToMessageId: coveredLastMsg.id,
          tailStartMessageId,
          messageCount: latestSnapshot.messageCount,
          tokenCount: generated.completionTokens
        })

        logger.info(
          `[ContextCompressor] Recompress updated snapshot #${latestSnapshot.id} Session(${sessionId}).`
        )

        return { ok: true, summaryText: normalizedSummary }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        logger.error('[ContextCompressor] Manual recompress failed:', message)
        return { ...compressionError(CompressionErrorCode.GENERIC, message), ok: false }
      }
    })

    if (locked === undefined) {
      return compressionError(CompressionErrorCode.ALREADY_RUNNING)
    }
    return locked
  }

  private static async generateSummaryText(
    provider: IAIProvider,
    modelId: string,
    toCompress: MessageWithParts[],
    compressionConfig: SessionCompressionConfig,
    priorSummaryText: string | null,
    providerType: string
  ): Promise<{ text: string; completionTokens: number } | null> {
    const model = provider.getLanguageModel(modelId)
    const systemBase =
      compressionConfig.systemPrompt?.trim() || getDefaultCompressionSystemPrompt()

    const headForModel = cloneMessagesForCompressionModel(toCompress)
    const headMessages = await MessageAdapter.toVercelMessages(
      headForModel,
      modelId,
      providerType
    )

    const tailPrompt = buildAnchoredCompressionUserPrompt({
      previousSummary: priorSummaryText?.trim() || undefined
    })

    const messages: ModelMessage[] = [
      ...headMessages,
      { role: 'user', content: tailPrompt }
    ]

    const { text, usage } = await generateText({
      model,
      system: systemBase,
      messages,
      temperature: 0.1
    })

    if (!text?.trim()) return null

    const normalizedSummary = text.trim()
    const lastAssistant = [...toCompress].reverse().find((m) => m.role === 'assistant')
    const lastAssistantText = lastAssistant ? extractMessageText(lastAssistant).trim() : ''
    if (lastAssistantText.length > 40 && normalizedSummary === lastAssistantText) {
      return null
    }

    const completionTokens =
      (usage as { completionTokens?: number } | undefined)?.completionTokens ?? 0

    return { text: normalizedSummary, completionTokens }
  }
}
