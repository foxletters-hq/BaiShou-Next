import { streamText, smoothStream, stepCountIs } from 'ai'
import {
  buildCachedSystemForStream,
  buildMiddlewareChain,
  wrapLanguageModelWithMiddlewares,
  type ProviderType
} from '../middleware/middleware-factory'
import { MessageAdapter } from './message.adapter'
import { StreamAccumulator } from './stream-accumulator'
import { StreamChunkAdapter } from './stream-chunk.adapter'
import { ChunkType } from './stream-chunk.types'
import type { StreamChunk } from './stream-chunk.types'
import { SystemPromptBuilder } from './system-prompt.builder'
import {
  isVisionModel,
  logger,
  mergeDisabledToolIds,
  normalizeAssistantKind
} from '@baishou/shared'

// --- 新挂载的智慧引擎组件 ---
import { ContextWindowBuilder } from './context-window.builder'
import { ContextCompressorService } from './context-compressor.service'
import {
  estimateContextTokensForTrigger,
  getMessagesAfterSnapshot,
  resolveSessionCompressionConfig,
  resolveCompressionTrigger,
  usableContextTokens
} from './context-compression.utils'
import { COMPRESSION_MESSAGE_FETCH_LIMIT } from './compression.constants'
import {
  AssistantRepository,
  MessageRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database'
import { DatabaseAdapter } from '../tools/adapters/database.adapter'
import { EmbeddingAdapter } from '../tools/adapters/embedding.adapter'
import { MemoryDeduplicationServiceImpl } from '../rag/memory-deduplication.service'

import { StreamChatOptions, StreamChatCallbacks } from './agent-session.types'
import { persistResult } from './agent-session-persist'
import { messageHasImageAttachments } from './attachment-content.builder'
import { isAgentStreamSessionClaimActive } from './stream-session-guard'
import { buildToolCallRepairHandler } from './tool-call-repair.util'

export type { StreamChatOptions, StreamChatCallbacks } from './agent-session.types'

export class AgentSessionService {
  /**
   * 开启一个流式聊天会话。
   * 此方法会自动从数据库汇聚历史，并使用 Vercel AI SDK 发起调用。
   * 它的主要职责是拦截状态并驱动 StreamAccumulator，最后完成 Drizzle 事务落盘。
   */
  async streamChat(options: StreamChatOptions, callbacks?: StreamChatCallbacks): Promise<void> {
    const {
      sessionId,
      userText,
      provider,
      modelId,
      toolRegistry,
      sessionRepo,
      snapshotRepo,
      systemPrompt,
      systemModels,
      userConfig,
      attachments,
      webSearchResultFetcher,
      abortSignal,
      streamClaimGeneration,
      userMessageId,
      skipUserMessageRecording
    } = options

    try {
      // 1. 获取基础模型，然后用 Vercel 原生 middleware 包装
      const baseModel = provider.getLanguageModel(modelId)
      const model = wrapLanguageModelWithMiddlewares(baseModel, {
        providerType: provider.config?.type || 'openai',
        providerId: provider.config?.id,
        modelId,
        sessionId,
        baseUrl: provider.config?.baseUrl
      })

      // 2. 若上下文 token 超过阈值或逼近模型窗口，先同步压缩再构建窗口
      const compressionConfig = await resolveSessionCompressionConfig(sessionId, sessionRepo)
      {
        if (abortSignal?.aborted) {
          throw new DOMException('The operation was aborted', 'AbortError')
        }
        const rawForEstimate = (await sessionRepo.getMessagesBySession(
          sessionId,
          COMPRESSION_MESSAGE_FETCH_LIMIT
        )) as import('./message.adapter').MessageWithParts[]
        const latestSnap = await snapshotRepo.getLatestSnapshot(sessionId)
        const afterSnap = getMessagesAfterSnapshot(rawForEstimate, latestSnap)
        const contextTokens = estimateContextTokensForTrigger(rawForEstimate, afterSnap, latestSnap)
        // 重发/编辑截断后仅重新判定阈值；截断流程已清除 marker/无效快照，不再 force 绕过阈值。
        if (resolveCompressionTrigger(contextTokens, compressionConfig)) {
          logger.info(
            `[AgentSessionService] Context ~${contextTokens} tokens hit compression trigger (threshold=${compressionConfig.threshold}, window=${compressionConfig.modelContextWindow ?? 0}, force=${Boolean(compressionConfig.force)}), compressing before request.`
          )
          const compressed = await ContextCompressorService.tryCompress(
            provider,
            modelId,
            sessionRepo,
            snapshotRepo,
            sessionId,
            compressionConfig,
            provider.config?.type ?? '',
            {
              ...(userMessageId ? { triggerUserMessageId: userMessageId } : {}),
              abortSignal
            }
          )
          if (abortSignal?.aborted) {
            throw new DOMException('The operation was aborted', 'AbortError')
          }
          if (compressed) {
            const allForPrune = (await sessionRepo.getMessagesBySession(
              sessionId,
              COMPRESSION_MESSAGE_FETCH_LIMIT
            )) as import('./message.adapter').MessageWithParts[]
            ContextCompressorService.schedulePrune(sessionRepo, sessionId, allForPrune)
          }
        }
      }

      // 3. 从数据库构建模型上下文（用户消息须在 streamChat 之前落库）
      const configRecentCount =
        typeof userConfig?.['recentCount'] === 'number' ? userConfig['recentCount'] : 30

      const dbHistory = await ContextWindowBuilder.build(sessionId, sessionRepo, snapshotRepo, {
        recentCount: configRecentCount
      })
      const coreMessages = await MessageAdapter.toVercelMessages(
        dbHistory,
        modelId,
        provider.config?.type
      )

      if (userMessageId && !dbHistory.some((message) => message.id === userMessageId)) {
        throw new Error('无法发送：用户消息未加载到上下文，请重试')
      }

      const providerType = (provider.config?.type || 'openai') as ProviderType
      const messageMiddlewareChain = buildMiddlewareChain(providerType)
      const messagesForModel = messageMiddlewareChain.isEmpty
        ? coreMessages
        : messageMiddlewareChain.apply(coreMessages)

      // 3. 构建可用的 Tools 及其底层接续支持（静态 import，避免 Android Hermes 运行时动态打包 SyntaxError）
      const drizzleDb = (sessionRepo as any).db || (sessionRepo as any).database
      if (!drizzleDb) {
        throw new Error('Agent database connection is unavailable')
      }
      const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)

      const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
      const msgRepo = new MessageRepository(drizzleDb)

      // memory_embeddings 表由 Drizzle ORM 迁移统一管理，不再在此处建表

      const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb)
      let embAdapter: any = undefined
      if (systemModels?.embeddingProvider && systemModels?.embeddingModelId) {
        embAdapter = new EmbeddingAdapter(
          systemModels.embeddingProvider,
          systemModels.embeddingModelId,
          hsRepo
        )
      } else if (provider && modelId && userConfig?.['hasEmbeddingModel']) {
        embAdapter = new EmbeddingAdapter(provider, modelId, hsRepo)
      }

      // 构建记忆去重服务
      let dedupService: any = undefined
      if (embAdapter && systemModels?.embeddingProvider && systemModels?.embeddingModelId) {
        dedupService = new MemoryDeduplicationServiceImpl(
          embAdapter,
          dbAdapter,
          systemModels.embeddingProvider,
          systemModels.embeddingModelId
        )
      }

      const sessionObj = await sessionRepo.getSessionById?.(sessionId)

      const contextCompressionRunner = {
        run: async (phase: 'upstream' | 'downstream', opts?: { force?: boolean }) => {
          const config = await resolveSessionCompressionConfig(sessionId, sessionRepo)
          const merged = { ...config, force: opts?.force }
          const usableWindow = usableContextTokens(
            merged.modelContextWindow ?? 0,
            merged.reservedTokens
          )
          if (merged.threshold <= 0 && usableWindow <= 0 && !merged.force) {
            return 'Companion auto-compression is disabled (threshold 0). Enable it in Memory settings or use force=true.'
          }
          const ok = await ContextCompressorService.tryCompress(
            provider,
            modelId,
            sessionRepo,
            snapshotRepo,
            sessionId,
            merged,
            provider.config?.type ?? '',
            userMessageId ? { triggerUserMessageId: userMessageId } : undefined
          )
          if (ok) {
            const allForPrune = (await sessionRepo.getMessagesBySession(
              sessionId,
              COMPRESSION_MESSAGE_FETCH_LIMIT
            )) as import('./message.adapter').MessageWithParts[]
            ContextCompressorService.schedulePrune(sessionRepo, sessionId, allForPrune)
          }
          const phaseLabel =
            phase === 'upstream'
              ? 'upstream / before model request'
              : 'downstream / after reply saved'
          return ok
            ? `Context compression (${phaseLabel}) completed. Rolling summary updated.`
            : `No compression (${phaseLabel}): below threshold (use force=true) or not enough history.`
        }
      }

      let mergedUserConfig = userConfig || {}
      let effectiveSystemPrompt = systemPrompt
      if (sessionObj?.assistantId) {
        const astRepo = new AssistantRepository(
          (sessionRepo as any).db || (sessionRepo as any).database
        )
        const ast = await astRepo.findById(sessionObj.assistantId)
        if (ast) {
          const assistantKind = normalizeAssistantKind(ast.assistantKind)
          mergedUserConfig = {
            ...mergedUserConfig,
            disabledToolIds: mergeDisabledToolIds(
              Array.isArray(mergedUserConfig['disabledToolIds'])
                ? (mergedUserConfig['disabledToolIds'] as string[])
                : [],
              assistantKind
            )
          }
          if (ast.systemPrompt) {
            effectiveSystemPrompt = ast.systemPrompt
          }
        }
      }

      const enabledTools = toolRegistry.getEnabledToolsAsVercel({
        userConfig: mergedUserConfig,
        sessionId,
        vaultName: sessionObj?.vaultName || 'default',
        embeddingService: embAdapter,
        vectorStore: dbAdapter,
        messageSearcher: dbAdapter,
        summaryReader: dbAdapter,
        deduplicationService: dedupService,
        diarySearcher: options.diarySearcher,
        webSearchResultFetcher: webSearchResultFetcher,
        fetchSearchPage: options.fetchSearchPage,
        contextCompressionRunner
      })

      const builtSystemPrompt = SystemPromptBuilder.build({
        vaultName: sessionObj?.vaultName || 'default',
        tools: enabledTools as any,
        customPersona: effectiveSystemPrompt,
        userProfileBlock:
          typeof userConfig?.['userCard'] === 'string' ? userConfig['userCard'] : undefined,
        diaryAiWritingPrompt:
          typeof userConfig?.['diaryAiWritingPrompt'] === 'string'
            ? userConfig['diaryAiWritingPrompt']
            : undefined
      })

      // 4. 调用 Vercel streamText
      // 使用 Intl.Segmenter 做 CJK 友好的词级流式分割，替代默认的 /\S+\s+/m
      // 默认的 word 模式对中文按空格切分，会导致大量碎片化的流式输出。
      // 移动端引擎（如 Hermes）中 Intl.Segmenter 可能为 undefined，在此进行兼容性保护。
      const hasSegmenter = typeof Intl !== 'undefined' && typeof Intl.Segmenter !== 'undefined'
      const cjkSegmenter = hasSegmenter
        ? new Intl.Segmenter('zh-CN', { granularity: 'word' })
        : undefined

      if (
        attachments?.length &&
        messageHasImageAttachments(attachments) &&
        !isVisionModel(modelId)
      ) {
        throw new Error('VISION_NOT_SUPPORTED')
      }

      const lastUserMsg = [...messagesForModel].reverse().find((m) => m.role === 'user')
      if (lastUserMsg) {
        const content = lastUserMsg.content
        const isEmptyUserContent =
          content === '' ||
          (Array.isArray(content) && content.length === 0) ||
          (Array.isArray(content) &&
            content.every(
              (part) =>
                typeof part === 'object' &&
                part !== null &&
                'type' in part &&
                (part as { type?: string; text?: string }).type === 'text' &&
                !(part as { text?: string }).text?.trim()
            ))
        if (isEmptyUserContent) {
          throw new Error('无法发送：用户消息内容为空（附件可能未能正确读取）')
        }
      }

      const cachingCtx = {
        providerType: provider.config?.type || 'openai',
        providerId: provider.config?.id,
        modelId,
        sessionId,
        baseUrl: provider.config?.baseUrl
      }

      const streamResult = await streamText({
        model,
        messages: messagesForModel,
        system: buildCachedSystemForStream(builtSystemPrompt, cachingCtx),
        tools: enabledTools,
        stopWhen: stepCountIs(10),
        abortSignal,
        experimental_repairToolCall: buildToolCallRepairHandler(),
        ...(hasSegmenter && cjkSegmenter
          ? { experimental_transform: smoothStream({ chunking: cjkSegmenter }) }
          : {})
      } as any)

      // 5. 使用统一的 StreamChunkAdapter 消费流
      const accumulator = new StreamAccumulator()
      const adapter = new StreamChunkAdapter(accumulator, {
        onChunk: (chunk) => this.dispatchChunkToCallbacks(chunk, callbacks)
      })

      let streamError = (await adapter.consumeStream(streamResult)).error

      // 记录性能指标
      const metrics = adapter.getMetrics()
      logger.info(
        `[AgentSessionService] 性能指标: TTFT=${metrics.timeToFirstToken}ms, 总耗时=${metrics.totalDuration}ms, 速度=${metrics.tokensPerSecond} tok/s`
      )

      const hasModelOutput =
        Boolean(accumulator.text.trim()) ||
        Boolean(accumulator.reasoning.trim()) ||
        accumulator.toolCalls.length > 0

      if (!streamError && !hasModelOutput) {
        streamError = new Error('模型未返回任何内容，请检查附件格式或稍后重试')
      }

      if (streamError) {
        logger.warn('[AgentSessionService] Stream encountered a fatal error:', streamError)
      }

      // 6. 落盘（被更新的重试取代时跳过，避免重复 assistant 消息）
      if (
        streamClaimGeneration !== undefined &&
        !isAgentStreamSessionClaimActive(sessionId, streamClaimGeneration)
      ) {
        logger.info(
          `[AgentSessionService] Skip persist for session ${sessionId}: stream superseded`
        )
        return
      }

      const usageResult = await persistResult({
        sessionId,
        rawUserText: userText,
        streamResult,
        accumulator,
        sessionRepo,
        snapshotRepo,
        provider,
        modelId,
        skipUserMessageRecording,
        userMessageId,
        streamError,
        dbHistory,
        systemPrompt: builtSystemPrompt,
        namingModelConfigured: systemModels?.namingModelConfigured,
        namingProvider: systemModels?.namingProvider,
        namingModelId: systemModels?.namingModelId
      })

      // 7. 向外抛出完成/错误回调（仅一次，避免覆盖真实 API 错误）
      if (streamError) {
        callbacks?.onError?.(streamError)
      } else if (callbacks?.onFinish) {
        callbacks.onFinish({
          messageId: usageResult.assistantMessageId,
          inputTokens: usageResult.inputTokens,
          outputTokens: usageResult.outputTokens,
          cacheReadInputTokens: usageResult.cacheReadInputTokens,
          cacheWriteInputTokens: usageResult.cacheWriteInputTokens,
          costMicros: usageResult.costMicros
        })
      }
    } catch (e: unknown) {
      const err = e instanceof Error ? e : new Error(String(e))
      const aborted = err.name === 'AbortError'
      if (!aborted) {
        logger.error('[AgentSessionService] Error in streamChat:', err.message)
        if (err.stack) {
          logger.error('[AgentSessionService] Stack:', err.stack)
        }
      }
      if (!aborted && (e as { cause?: unknown })?.cause) {
        logger.error('[AgentSessionService] Cause:', {
          cause: String((e as { cause?: unknown }).cause)
        })
      }
      if ((e as { url?: string })?.url) {
        logger.error('[AgentSessionService] Failing URL:', (e as { url?: string }).url)
      }
      if ((e as { statusCode?: number })?.statusCode) {
        logger.error(
          '[AgentSessionService] HTTP status:',
          (e as { statusCode?: number }).statusCode
        )
      }
      if (!aborted && (e as { responseHeaders?: unknown })?.responseHeaders) {
        logger.error(
          '[AgentSessionService] Response headers:',
          JSON.stringify((e as { responseHeaders?: unknown }).responseHeaders)
        )
      }
      if (!aborted) {
        callbacks?.onError?.(err)
      }
      throw err
    }
  }

  // ─── 将标准化 Chunk 分发到旧式回调 ───

  /**
   * 将统一的 StreamChunk 分发到 IPC 层的老式回调接口。
   */
  private dispatchChunkToCallbacks(chunk: StreamChunk, callbacks?: StreamChatCallbacks): void {
    if (!callbacks) return

    switch (chunk.type) {
      case ChunkType.TEXT_DELTA:
        callbacks.onTextDelta?.(chunk.text)
        break
      case ChunkType.REASONING_DELTA:
        callbacks.onReasoningDelta?.(chunk.text)
        break
      case ChunkType.TOOL_CALL:
        callbacks.onToolCallStart?.(chunk.toolName, chunk.input)
        break
      case ChunkType.TOOL_RESULT:
        callbacks.onToolCallResult?.(chunk.toolName, chunk.output)
        break
      case ChunkType.ERROR:
        break
    }
  }
}
