import { streamText, smoothStream, stepCountIs } from 'ai'
import {
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
import { isVisionModel, logger, prefixTextWithMessageTimestamp, type ISqlExecutor } from '@baishou/shared'

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
  SqliteHybridSearchRepository
} from '@baishou/database'
import { DatabaseAdapter } from '../tools/adapters/database.adapter'
import { EmbeddingAdapter } from '../tools/adapters/embedding.adapter'
import { MemoryDeduplicationServiceImpl } from '../rag/memory-deduplication.service'

import { StreamChatOptions, StreamChatCallbacks } from './agent-session.types'
import { persistResult } from './agent-session-persist'
import {
  appendFileAttachmentToContentParts,
  appendImagePartToContentParts,
  finalizeUserContentParts,
  inferAttachmentFlags,
  messageHasImageAttachments
} from './attachment-content.builder'

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
      userMessageId,
      skipUserMessageRecording
    } = options

    try {
      // 1. 获取基础模型，然后用 Vercel 原生 middleware 包装
      const baseModel = provider.getLanguageModel(modelId)
      const model = wrapLanguageModelWithMiddlewares(baseModel, provider.config?.type || '')

      // 2. 若上下文 token 超过阈值或逼近模型窗口，先同步压缩再构建窗口
      const compressionConfig = await resolveSessionCompressionConfig(sessionId, sessionRepo)
      {
        const rawForEstimate = (await sessionRepo.getMessagesBySession(
          sessionId,
          COMPRESSION_MESSAGE_FETCH_LIMIT
        )) as import('./message.adapter').MessageWithParts[]
        // 重发/编辑截断后 token 可能低于阈值，但仍需强制重压缩（内容可能已变）
        const canForceRecompress = skipUserMessageRecording === true && rawForEstimate.length >= 4
        const compressionConfigForRun = canForceRecompress
          ? { ...compressionConfig, force: true }
          : compressionConfig
        const latestSnap = await snapshotRepo.getLatestSnapshot(sessionId)
        const afterSnap = getMessagesAfterSnapshot(rawForEstimate, latestSnap)
        const contextTokens = estimateContextTokensForTrigger(rawForEstimate, afterSnap, latestSnap)
        if (resolveCompressionTrigger(contextTokens, compressionConfigForRun)) {
          logger.info(
            `[AgentSessionService] Context ~${contextTokens} tokens hit compression trigger (threshold=${compressionConfigForRun.threshold}, window=${compressionConfigForRun.modelContextWindow ?? 0}, force=${Boolean(compressionConfigForRun.force)}), compressing before request.`
          )
          const compressed = await ContextCompressorService.tryCompress(
            provider,
            modelId,
            sessionRepo,
            snapshotRepo,
            sessionId,
            compressionConfigForRun,
            provider.config?.type ?? '',
            userMessageId ? { triggerUserMessageId: userMessageId } : undefined
          )
          if (compressed) {
            const allForPrune = (await sessionRepo.getMessagesBySession(
              sessionId,
              COMPRESSION_MESSAGE_FETCH_LIMIT
            )) as import('./message.adapter').MessageWithParts[]
            ContextCompressorService.schedulePrune(sessionRepo, sessionId, allForPrune)
          }
        }
      }

      // 3. 加载历史并使用 Builder+Adapter 进行超长截断和压缩感知注入
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

      // 将当前用户消息追加到上下文窗口，供 AI 推理使用（不再落盘，仅在内存中追加）
      const lastCoreMsg = coreMessages.length > 0 ? coreMessages[coreMessages.length - 1]! : null
      const userContentAlreadyInContext =
        lastCoreMsg &&
        lastCoreMsg.role === 'user' &&
        (typeof lastCoreMsg.content === 'string' ? lastCoreMsg.content === userText : true)

      if (!userContentAlreadyInContext) {
        if (attachments && attachments.length > 0) {
          const contentParts: unknown[] = []
          if (userText.trim()) {
            contentParts.push({
              type: 'text',
              text: prefixTextWithMessageTimestamp(userText)
            })
          }
          for (const att of attachments) {
            const flags = inferAttachmentFlags(att)
            if (flags.isImage) {
              await appendImagePartToContentParts(contentParts, att, { modelId })
            } else {
              await appendFileAttachmentToContentParts(contentParts, att, {
                modelId,
                providerType: provider.config?.type
              })
            }
          }
          coreMessages.push({
            role: 'user',
            content: finalizeUserContentParts(contentParts)
          })
        } else {
          coreMessages.push({
            role: 'user',
            content: prefixTextWithMessageTimestamp(userText)
          })
        }
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
      const rawClient = (drizzleDb?.session?.client || drizzleDb) as any
      const clientExecutor: ISqlExecutor =
        typeof rawClient.execute === 'function'
          ? rawClient
          : {
              execute: async (statement: string | { sql: string; args?: any[] }, args?: any[]) => {
                let sqlStr = ''
                let sqlArgs: any[] = []
                if (typeof statement === 'string') {
                  sqlStr = statement
                  sqlArgs = args || []
                } else {
                  sqlStr = statement.sql
                  sqlArgs = statement.args || []
                }

                if (typeof rawClient.prepare !== 'function') {
                  throw new Error('Database client lacks both execute and prepare methods')
                }

                const stmt = rawClient.prepare(sqlStr)
                if (
                  sqlStr.trim().toUpperCase().startsWith('SELECT') ||
                  sqlStr.trim().toUpperCase().startsWith('PRAGMA')
                ) {
                  const rows = stmt.all(...sqlArgs)
                  return { rows }
                } else {
                  const res = stmt.run(...sqlArgs)
                  return { rows: [], ...res }
                }
              }
            }

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

      const enabledTools = toolRegistry.getEnabledToolsAsVercel({
        userConfig: userConfig || {},
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

      // --- 灵魂注入 (如果有 Assistant 绑定) ---
      let effectiveSystemPrompt = systemPrompt
      if (sessionObj?.assistantId) {
        const astRepo = new AssistantRepository(
          (sessionRepo as any).db || (sessionRepo as any).database
        )
        const ast = await astRepo.findById(sessionObj.assistantId)
        if (ast && ast.systemPrompt) {
          effectiveSystemPrompt = ast.systemPrompt
        }
      }

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

      const streamResult = await streamText({
        model,
        messages: messagesForModel,
        system: builtSystemPrompt,
        tools: enabledTools,
        stopWhen: stepCountIs(10),
        abortSignal,
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

      // 6. 落盘
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
        systemPrompt: builtSystemPrompt
      })

      // 7. 向外抛出完成/错误回调（仅一次，避免覆盖真实 API 错误）
      if (streamError) {
        callbacks?.onError?.(streamError)
      } else if (callbacks?.onFinish) {
        callbacks.onFinish({
          inputTokens: usageResult.inputTokens,
          outputTokens: usageResult.outputTokens,
          costMicros: usageResult.costMicros
        })
      }
    } catch (e: any) {
      logger.error('[AgentSessionService] Error in streamChat:', e?.stack || e?.message || e)
      if (e?.cause) {
        logger.error('[AgentSessionService] Cause:', e.cause)
      }
      if (e?.url) {
        logger.error('[AgentSessionService] Failing URL:', e.url)
      }
      if (e?.statusCode) {
        logger.error('[AgentSessionService] HTTP status:', e.statusCode)
      }
      if (e?.responseHeaders) {
        logger.error('[AgentSessionService] Response headers:', JSON.stringify(e.responseHeaders))
      }
      callbacks?.onError?.(e)
      throw e
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
