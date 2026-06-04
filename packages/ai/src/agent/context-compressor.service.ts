import { streamText } from 'ai'
import type { ModelMessage } from 'ai'
import { IAIProvider } from '../providers/provider.interface'
import { SessionRepository } from '@baishou/database'
// @ts-ignore
import { SnapshotRepository } from '@baishou/database'
import {
  CompressionErrorCode,
  compressionError,
  getDefaultCompressionSystemPrompt,
  buildCompressionPreviousSummaryBlock
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
import { emitCompressionLifecycle } from './compression-lifecycle'
import { writeCompactionMarker, messageHasCompactionMarker, resolveLatestUserMessageId, finalizeCompressionForStorage } from './compaction-marker'
import { consumeCompressionModelStream } from './compression-stream.utils'
import { wrapLanguageModelWithMiddlewares } from '../middleware/middleware-factory'

export type { SessionCompressionConfig } from './context-compression.utils'

export type CompressionRunOptions = {
  /** 方案 A：触发发送前压缩的用户消息 ID */
  triggerUserMessageId?: string
}

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
    providerType?: string,
    runOptions?: CompressionRunOptions
  ): Promise<boolean> {
    return runCompressionWithSessionLock(sessionId, () =>
      ContextCompressorService.compress(
        provider,
        modelId,
        sessionRepo,
        snapshotRepo,
        sessionId,
        config,
        providerType,
        runOptions
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
    providerType = '',
    runOptions?: CompressionRunOptions
  ): Promise<boolean> {
    const explicitTriggerUserMessageId = runOptions?.triggerUserMessageId
    let compressionStarted = false

    try {
      const compressionConfig =
        config ?? (await resolveSessionCompressionConfig(sessionId, sessionRepo))

      const usableWindow = usableContextTokens(
        compressionConfig.modelContextWindow ?? 0,
        compressionConfig.reservedTokens
      )
      if (compressionConfig.threshold <= 0 && usableWindow <= 0 && !compressionConfig.force) {
        return false
      }

      const allMessages = (await sessionRepo.getMessagesBySession(
        sessionId,
        COMPRESSION_MESSAGE_FETCH_LIMIT
      )) as MessageWithParts[]

      if (allMessages.length < 4) {
        return false
      }

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

      const markerMessageId =
        explicitTriggerUserMessageId ?? resolveLatestUserMessageId(allMessages)

      if (markerMessageId) {
        const alreadyCompressed = await messageHasCompactionMarker(
          sessionRepo,
          markerMessageId
        )
        if (alreadyCompressed) {
          logger.info(
            `[ContextCompressor] Session(${sessionId}) skip: trigger message ${markerMessageId} already has compaction marker.`
          )
          return false
        }
      }

      emitCompressionLifecycle({
        type: 'start',
        sessionId,
        phase: 'auto',
        triggerUserMessageId: markerMessageId
      })
      compressionStarted = true

      const generated = await ContextCompressorService.generateSummaryText(
        provider,
        modelId,
        sessionId,
        toCompress,
        compressionConfig,
        latestSnapshot?.summaryText ?? null,
        providerType
      )
      if (!generated) {
        emitCompressionLifecycle({ type: 'finish', sessionId, phase: 'auto', ok: false })
        return false
      }

      const coveredLastMsg = toCompress[toCompress.length - 1]!
      const tailStartMessageId =
        splitTailStart ?? computeTailStartMessageId(allMessages, coveredLastMsg.id)

      const prevTokenCount = latestSnapshot?.tokenCount ?? 0
      const stored = finalizeCompressionForStorage(generated.text, generated.reasoning)

      await snapshotRepo.appendSnapshot({
        sessionId: sessionId as string,
        summaryText: stored.summaryText,
        coveredUpToMessageId: coveredLastMsg.id,
        tailStartMessageId,
        messageCount: latestSnapshot
          ? latestSnapshot.messageCount + toCompress.length
          : toCompress.length,
        tokenCount: prevTokenCount + generated.completionTokens
      })

      const newSnapshot = await snapshotRepo.getLatestSnapshot(sessionId)
      const markerTargetId = markerMessageId ?? coveredLastMsg.id
      await writeCompactionMarker(sessionRepo, sessionId, markerTargetId, {
        snapshotId: newSnapshot?.id,
        compressedAt: Date.now(),
        coveredUpToMessageId: coveredLastMsg.id,
        streamTranscript: stored.summaryText,
        streamReasoning: stored.reasoningText,
        phase: 'auto',
        status: 'completed',
        thoughtDurationMs: generated.thoughtDurationMs,
        summaryDurationMs: generated.summaryDurationMs
      })

      logger.info(
        `[ContextCompressor] Snapshot Session(${sessionId}); context ~${contextTokens} tokens.`
      )
      emitCompressionLifecycle({
        type: 'finish',
        sessionId,
        phase: 'auto',
        ok: true,
        triggerUserMessageId: markerMessageId,
        coveredUpToMessageId: coveredLastMsg.id,
        snapshotId: newSnapshot?.id
      })
      return true
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      logger.error('[ContextCompressor] Compression failed:', message)
      if (compressionStarted) {
        emitCompressionLifecycle({ type: 'finish', sessionId, phase: 'auto', ok: false })
      }
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
    emitCompressionLifecycle({ type: 'start', sessionId, phase: 'manual' })
    const locked = await runRecompressWithSessionLock(sessionId, async () => {
      let coveredUpToMessageId: string | undefined
      let snapshotId: number | undefined
      let succeeded = false
      try {
        const compressionConfig =
          config ?? (await resolveSessionCompressionConfig(sessionId, sessionRepo))

        const snapshots = await snapshotRepo.listSnapshotsBySession(sessionId)
        const latestSnapshot = snapshots[snapshots.length - 1]
        if (!latestSnapshot?.summaryText?.trim()) {
          return compressionError(CompressionErrorCode.NO_SNAPSHOT)
        }

        snapshotId = latestSnapshot.id
        const previousSnapshot = snapshots.length >= 2 ? snapshots[snapshots.length - 2]! : null

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
          sessionId,
          toCompress,
          compressionConfig,
          previousSnapshot?.summaryText ?? null,
          providerType
        )

        if (!generated?.text.trim()) {
          return compressionError(CompressionErrorCode.EMPTY_SUMMARY)
        }

        const stored = finalizeCompressionForStorage(generated.text, generated.reasoning)
        const normalizedSummary = stored.summaryText
        const lastAssistant = [...toCompress].reverse().find((m) => m.role === 'assistant')
        const lastAssistantText = lastAssistant ? extractMessageText(lastAssistant).trim() : ''
        if (lastAssistantText.length > 40 && normalizedSummary === lastAssistantText) {
          return compressionError(CompressionErrorCode.VERBATIM_SUMMARY)
        }

        const coveredLastMsg = toCompress[toCompress.length - 1]!
        coveredUpToMessageId = coveredLastMsg.id
        const tailStartMessageId =
          splitTailStart ?? computeTailStartMessageId(allMessages, coveredLastMsg.id)

        await snapshotRepo.updateSnapshot(latestSnapshot.id, {
          summaryText: normalizedSummary,
          coveredUpToMessageId: coveredLastMsg.id,
          tailStartMessageId,
          messageCount: latestSnapshot.messageCount,
          tokenCount: generated.completionTokens
        })

        await writeCompactionMarker(
          sessionRepo,
          sessionId,
          ContextCompressorService.resolveRecompressMarkerMessageId(
            allMessages,
            latestSnapshot.id,
            coveredLastMsg.id
          ),
          {
            snapshotId: latestSnapshot.id,
            compressedAt: Date.now(),
            coveredUpToMessageId: coveredLastMsg.id,
            streamTranscript: stored.summaryText,
            streamReasoning: stored.reasoningText,
            phase: 'manual',
            status: 'completed',
            thoughtDurationMs: generated.thoughtDurationMs,
            summaryDurationMs: generated.summaryDurationMs
          }
        )

        logger.info(
          `[ContextCompressor] Recompress updated snapshot #${latestSnapshot.id} Session(${sessionId}).`
        )

        succeeded = true
        return { ok: true, summaryText: normalizedSummary }
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        logger.error('[ContextCompressor] Manual recompress failed:', message)
        return { ...compressionError(CompressionErrorCode.GENERIC, message), ok: false }
      } finally {
        emitCompressionLifecycle({
          type: 'finish',
          sessionId,
          phase: 'manual',
          ok: succeeded,
          coveredUpToMessageId,
          snapshotId
        })
      }
    })

    if (locked === undefined) {
      emitCompressionLifecycle({ type: 'finish', sessionId, phase: 'manual', ok: false })
      return compressionError(CompressionErrorCode.ALREADY_RUNNING)
    }
    return locked
  }

  private static async generateSummaryText(
    provider: IAIProvider,
    modelId: string,
    sessionId: string,
    toCompress: MessageWithParts[],
    compressionConfig: SessionCompressionConfig,
    priorSummaryText: string | null,
    providerType: string
  ): Promise<{ text: string; reasoning?: string; completionTokens: number; thoughtDurationMs: number; summaryDurationMs: number } | null> {
    const baseModel = provider.getLanguageModel(modelId)
    const model = wrapLanguageModelWithMiddlewares(baseModel, providerType)
    const systemBase =
      compressionConfig.systemPrompt?.trim() || getDefaultCompressionSystemPrompt()

    const headForModel = cloneMessagesForCompressionModel(toCompress)
    const headMessages = await MessageAdapter.toVercelMessages(headForModel, modelId, providerType)

    const messages: ModelMessage[] = [...headMessages]
    const previousSummaryBlock = buildCompressionPreviousSummaryBlock(
      priorSummaryText?.trim() || undefined
    )
    if (previousSummaryBlock) {
      messages.push({ role: 'user', content: previousSummaryBlock })
    }

    const streamResult = streamText({
      model,
      system: systemBase,
      messages,
      temperature: 0.1
    })

    const streamed = await consumeCompressionModelStream(streamResult, sessionId)

    if (!streamed.summaryText) return null
    const lastAssistant = [...toCompress].reverse().find((m) => m.role === 'assistant')
    const lastAssistantText = lastAssistant ? extractMessageText(lastAssistant).trim() : ''
    if (lastAssistantText.length > 40 && streamed.summaryText === lastAssistantText) {
      return null
    }

    return {
      text: streamed.summaryText,
      reasoning: streamed.reasoningText || undefined,
      completionTokens: streamed.completionTokens,
      thoughtDurationMs: streamed.thoughtDurationMs,
      summaryDurationMs: streamed.summaryDurationMs
    }
  }


  /** 重新压缩时优先更新已有触发用户消息上的 compaction 标记 */
  private static resolveRecompressMarkerMessageId(
    allMessages: MessageWithParts[],
    snapshotId: number,
    fallbackMessageId: string
  ): string {
    for (const msg of allMessages) {
      const part = msg.parts?.find((p) => p.type === 'compaction')
      const data = part?.data as { snapshotId?: number } | undefined
      if (data?.snapshotId === snapshotId) {
        return msg.id
      }
    }
    return fallbackMessageId
  }
}
