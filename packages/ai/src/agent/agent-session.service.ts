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
  normalizeAssistantKind,
  buildEffectiveAssistantSystemPrompt,
  isAutoInjectCurrentTimeEnabled,
  isAgentStreamAbortError,
  normalizeReasoningEffortSetting,
  type AssistantKind,
  type ReasoningEffortSetting,
  resolveVaultIdentity
} from '@baishou/shared'
import { resolveEffectiveProviderType } from '../providers/opencodego/opencodego.model-protocol'
import { buildDefaultReasoningOptions } from '../providers/reasoning'
import { runWithOpenAiThinkingInjectAsync } from '../providers/reasoning/openai-thinking-inject'

// --- 新挂载的智慧引擎组件 ---
import { ContextWindowBuilder } from './context-window.builder'
import { ContextCompressorService } from './context-compressor.service'
import {
  estimateContextTokensForTrigger,
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
import {
  abortAgentStreamSession,
  isAgentStreamSessionClaimActive
} from './stream-session-guard'
import { buildToolCallRepairHandler } from './tool-call-repair.util'
import { resolveSessionAgentGate } from '../baishou-agent-gate/baishou-agent-gate-session.util'
import { runCompressionSaveDiaryLifecycle } from '../baishou-agent-gate/compression-save-diary.lifecycle'
import { BaishouAgentGateSessionBuffer } from '../baishou-agent-gate/baishou-agent-gate-session-buffer'
import { WorkspaceSessionBuffer } from '../agent-workspace/workspace-session-buffer'
import type { IBaishouAgentGate } from '../baishou-agent-gate/baishou-agent-gate.service'
import type { MessageWithParts } from './message.adapter'
import { onAgentGateLifecycle } from './agent-gate-lifecycle'
import {
  AgentSessionRuntimeRecorder,
  bridgeStreamChunkToRuntimeEvents,
  createSessionRuntimeBridgeState
} from './session-runtime-event'
import {
  prepareSystemPromptWithEpoch,
  replaceEpochBaselineAfterCompression
} from '../session-runtime/context-epoch'
import { attachDoomLoopObserver, resolveSessionRuntimeProfile } from '../session-runtime'
import {
  emitTurnFinished,
  emitTurnStarted,
  needsProviderTurnContinuation
} from '../session-runtime/turn'

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
      skipUserMessageRecording,
      forceRecompress,
      flushSessionToDisk,
      agentGate: injectedAgentGate,
      persistBaishouAgentGateConfig,
      rawDataSourceManager,
      syncGraphPendingIndex,
      graphReader,
      knowledgeReader,
      diarySearcher,
      skillsWriter,
      workspace: workspaceInput,
      resolveVaultDisplayName,
      skillsCatalog,
      maxSteps: maxStepsOption,
      sessionRuntimeV2: sessionRuntimeV2Option
    } = options

    let sessionAgentGate: IBaishouAgentGate | undefined
    const gateSessionBuffer = new BaishouAgentGateSessionBuffer()
    const workspaceSessionBuffer = new WorkspaceSessionBuffer()
    const workspaceOptions = workspaceInput
      ? {
          ...workspaceInput,
          onFileChange: (change: import('@baishou/shared').FileChangePartData) => {
            workspaceSessionBuffer.push(change)
            workspaceInput.onFileChange?.(change)
          }
        }
      : undefined
    const runtimeProfile = resolveSessionRuntimeProfile({
      sessionKind: workspaceOptions?.sessionKind,
      userConfig,
      options: {
        sessionRuntimeV2: sessionRuntimeV2Option,
        maxSteps: maxStepsOption
      }
    })
    const enableRuntimeV2 = runtimeProfile.sessionRuntimeV2 === true
    const effectiveMaxSteps = runtimeProfile.maxSteps ?? 10
    const interruptOnGateReject = runtimeProfile.interruptOnGateReject === true
    const doomLoopThreshold = runtimeProfile.doomLoopThreshold ?? 3
    const unsubGateBuffer = onAgentGateLifecycle((event) => {
      if (event.type === 'agent_gate.allowlist_changed') return
      if (event.type === 'agent_gate.asked' && event.request.sessionId !== sessionId) return
      if (event.type === 'agent_gate.replied' && event.sessionId !== sessionId) return
      gateSessionBuffer.handleEvent(event)
    })
    const onAbortCancelGate = () => {
      sessionAgentGate?.cancelSession(sessionId, 'stream aborted')
    }
    abortSignal?.addEventListener('abort', onAbortCancelGate, { once: true })

    const runtimeRecorder = new AgentSessionRuntimeRecorder()
    const runtimeBridgeState = createSessionRuntimeBridgeState()
    let runtimeInterruptedRecorded = false
    const recordRuntimeInterrupted = (reason: string) => {
      if (runtimeInterruptedRecorded) return
      runtimeInterruptedRecorded = true
      runtimeRecorder.record({
        type: 'session.interrupted',
        sessionId,
        reason,
        timestamp: Date.now()
      })
    }
    const onAbortRuntime = () => recordRuntimeInterrupted('aborted')
    abortSignal?.addEventListener('abort', onAbortRuntime, { once: true })

    try {
      const { gate: sessionAgentGateResolved } = resolveSessionAgentGate({
        agentGate: injectedAgentGate,
        userConfig,
        persistBaishouAgentGateConfig
      })
      sessionAgentGate = sessionAgentGateResolved

      // 1. 获取基础模型，然后用 Vercel 原生 middleware 包装
      const baseModel = provider.getLanguageModel(modelId)
      const effectiveProviderType = resolveEffectiveProviderType(
        provider.config?.type || 'openai',
        modelId
      )
      const model = wrapLanguageModelWithMiddlewares(baseModel, {
        providerType: effectiveProviderType,
        providerId: provider.config?.id,
        modelId,
        sessionId,
        baseUrl: provider.config?.baseUrl
      })

      const sessionObj = await sessionRepo.getSessionById?.(sessionId)

      let mergedUserConfig = userConfig || {}
      let effectiveSystemPrompt = systemPrompt
      let assistantKind: AssistantKind = 'companion'
      if (sessionObj?.assistantId) {
        const vaultId = String(sessionObj?.vaultId ?? '').trim() || null
        const astRepo = new AssistantRepository(
          (sessionRepo as any).db || (sessionRepo as any).database,
          () => vaultId
        )
        const ast = await astRepo.findById(sessionObj.assistantId, vaultId)
        if (ast) {
          assistantKind = normalizeAssistantKind(ast.assistantKind)
          mergedUserConfig = {
            ...mergedUserConfig,
            disabledToolIds: mergeDisabledToolIds(
              Array.isArray(mergedUserConfig['disabledToolIds'])
                ? (mergedUserConfig['disabledToolIds'] as string[])
                : [],
              assistantKind
            )
          }
          const combined = buildEffectiveAssistantSystemPrompt(
            ast.systemPrompt,
            ast.customSystemPrompt
          )
          if (combined) {
            effectiveSystemPrompt = combined
          }
        }
      }

      const injectMessageTime = isAutoInjectCurrentTimeEnabled(
        Array.isArray(mergedUserConfig['disabledToolIds'])
          ? (mergedUserConfig['disabledToolIds'] as string[])
          : undefined
      )

      const configRecentCount =
        typeof mergedUserConfig['recentCount'] === 'number' ? mergedUserConfig['recentCount'] : 30

      const vaultIdentity = resolveVaultIdentity({
        vaultId: sessionObj?.vaultId,
        vaultName: sessionObj?.vaultName,
        resolveNameById: resolveVaultDisplayName,
        defaultName: 'Personal'
      })
      const vaultId = vaultIdentity.id
      const vaultName = vaultIdentity.name
      const saveDiaryBeforeCompression = async (messages: MessageWithParts[]) => {
        await runCompressionSaveDiaryLifecycle({
          agentGate: sessionAgentGate,
          diarySearcher,
          sessionId,
          vaultName,
          messages
        })
      }

      // 2. 若上下文 token 超过阈值或逼近模型窗口，先同步压缩再构建窗口
      let compressionConfig = await resolveSessionCompressionConfig(sessionId, sessionRepo)
      const loadSessionMessages = async () =>
        (await sessionRepo.getMessagesBySession(
          sessionId,
          COMPRESSION_MESSAGE_FETCH_LIMIT
        )) as import('./message.adapter').MessageWithParts[]

      let sessionMessages = await loadSessionMessages()
      let snapshotForWindow = await snapshotRepo.getLatestSnapshot(sessionId)
      if (forceRecompress === true && sessionMessages.length >= 4) {
        compressionConfig = { ...compressionConfig, force: true }
      }

      {
        if (abortSignal?.aborted) {
          throw new DOMException('The operation was aborted', 'AbortError')
        }

        const usableWindow = usableContextTokens(
          compressionConfig.modelContextWindow ?? 0,
          compressionConfig.reservedTokens
        )
        const shouldEvaluateCompression =
          compressionConfig.force || compressionConfig.threshold > 0 || usableWindow > 0

        if (shouldEvaluateCompression) {
          const contextTokens = estimateContextTokensForTrigger(
            sessionMessages,
            snapshotForWindow,
            {
              recentCount: configRecentCount,
              systemPrompt: effectiveSystemPrompt
            }
          )
          if (resolveCompressionTrigger(contextTokens, compressionConfig)) {
            logger.info(
              `[AgentSessionService] Context ~${contextTokens} tokens hit compression trigger (threshold=${compressionConfig.threshold}, window=${compressionConfig.modelContextWindow ?? 0}, force=${Boolean(compressionConfig.force)}), compressing before request.`
            )
            await saveDiaryBeforeCompression(sessionMessages)
            const compressed = await ContextCompressorService.tryCompress(
              provider,
              modelId,
              sessionRepo,
              snapshotRepo,
              sessionId,
              compressionConfig,
              resolveEffectiveProviderType(provider.config?.type ?? '', modelId),
              {
                ...(userMessageId ? { triggerUserMessageId: userMessageId } : {}),
                abortSignal,
                wrapMessageTime: injectMessageTime,
                prefetchedMessages: sessionMessages,
                recentCount: configRecentCount,
                systemPrompt: effectiveSystemPrompt
              }
            )
            if (abortSignal?.aborted) {
              throw new DOMException('The operation was aborted', 'AbortError')
            }
            if (compressed) {
              sessionMessages = await loadSessionMessages()
              await ContextCompressorService.runPrune(sessionRepo, sessionId, sessionMessages, {
                flushSessionToDisk
              })
              sessionMessages = await loadSessionMessages()
              snapshotForWindow = await snapshotRepo.getLatestSnapshot(sessionId)
              // 压缩发生在 full system builder 之前：replace('') 清空 baseline/sources 并 bump
              // baselineSeq；下次 prepare 因 baseline 空而 strip(full) 重建，并已发 epoch_replaced
              replaceEpochBaselineAfterCompression(sessionId, '')
            }
          }
        }
      }

      // 3. 从数据库构建模型上下文（用户消息须在 streamChat 之前落库）
      if (userMessageId && !sessionMessages.some((message) => message.id === userMessageId)) {
        sessionMessages = await loadSessionMessages()
      }

      const dbHistory = await ContextWindowBuilder.buildFromMessages(
        sessionId,
        snapshotRepo,
        sessionMessages,
        {
          recentCount: configRecentCount,
          ...(userMessageId ? { requiredMessageId: userMessageId } : {})
        },
        snapshotForWindow
      )
      const coreMessages = await MessageAdapter.toVercelMessages(
        dbHistory,
        modelId,
        effectiveProviderType,
        { wrapMessageTime: injectMessageTime }
      )

      if (userMessageId && !dbHistory.some((message) => message.id === userMessageId)) {
        throw new Error('无法发送：用户消息未加载到上下文，请重试')
      }

      const providerType = effectiveProviderType as ProviderType
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

      const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb, () => vaultId)
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
          const messagesForLifecycle = (await sessionRepo.getMessagesBySession(
            sessionId,
            COMPRESSION_MESSAGE_FETCH_LIMIT
          )) as MessageWithParts[]
          await saveDiaryBeforeCompression(messagesForLifecycle)
          const ok = await ContextCompressorService.tryCompress(
            provider,
            modelId,
            sessionRepo,
            snapshotRepo,
            sessionId,
            merged,
            resolveEffectiveProviderType(provider.config?.type ?? '', modelId),
            {
              ...(userMessageId ? { triggerUserMessageId: userMessageId } : {}),
              wrapMessageTime: injectMessageTime,
              recentCount: configRecentCount,
              systemPrompt: effectiveSystemPrompt
            }
          )
          if (ok) {
            const allForPrune = (await sessionRepo.getMessagesBySession(
              sessionId,
              COMPRESSION_MESSAGE_FETCH_LIMIT
            )) as import('./message.adapter').MessageWithParts[]
            await ContextCompressorService.runPrune(sessionRepo, sessionId, allForPrune, {
              flushSessionToDisk
            })
            // 工具触发压缩后同样 replace，保证下次 prepare 重建完整 baseline
            replaceEpochBaselineAfterCompression(sessionId, '')
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

      const gateProfile = workspaceOptions?.sessionKind === 'workspace' ? 'workspace' : 'companion'

      const enabledTools = toolRegistry.getEnabledToolsAsVercel({
        userConfig: mergedUserConfig,
        sessionId,
        vaultId,
        vaultName,
        embeddingService: embAdapter,
        vectorStore: dbAdapter,
        messageSearcher: dbAdapter,
        summaryReader: dbAdapter,
        deduplicationService: dedupService,
        diarySearcher,
        webSearchResultFetcher: webSearchResultFetcher,
        fetchSearchPage: options.fetchSearchPage,
        contextCompressionRunner,
        agentGate: sessionAgentGate,
        gateProfile,
        rawDataSourceManager,
        syncGraphPendingIndex,
        graphReader,
        knowledgeReader,
        skillsWriter,
        workspace: workspaceOptions,
        interruptOnGateReject
      } as Parameters<typeof toolRegistry.getEnabledToolsAsVercel>[0])

      const builtSystemPrompt = SystemPromptBuilder.build({
        vaultName,
        tools: enabledTools as any,
        customPersona: effectiveSystemPrompt,
        assistantKind,
        userProfileBlock:
          typeof userConfig?.['userCard'] === 'string' ? userConfig['userCard'] : undefined,
        diaryAiWritingPrompt:
          typeof userConfig?.['diaryAiWritingPrompt'] === 'string'
            ? userConfig['diaryAiWritingPrompt']
            : undefined,
        injectCurrentTime: injectMessageTime,
        customGuidelines:
          typeof userConfig?.['agentGuidelines'] === 'string'
            ? userConfig['agentGuidelines'].trim() || undefined
            : undefined,
        locale:
          typeof mergedUserConfig?.['locale'] === 'string'
            ? (mergedUserConfig['locale'] as string)
            : typeof userConfig?.['locale'] === 'string'
              ? (userConfig['locale'] as string)
              : undefined,
        workspaceEnv:
          workspaceOptions?.sessionKind === 'workspace' && workspaceOptions.folderRoot
            ? {
                folderRoot: workspaceOptions.folderRoot,
                platform: workspaceOptions.env?.platform ?? process.platform,
                isGitRepo: workspaceOptions.env?.isGitRepo,
                gitBranch: workspaceOptions.env?.gitBranch,
                gitChangesCount: workspaceOptions.env?.gitChangesCount,
                notebookId: workspaceOptions.notebookId
              }
            : undefined,
        skillsCatalog
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
        !isVisionModel(modelId, provider.config?.id ?? provider.config?.type)
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

      // v2：仅在各 turn 内 prepare（命中 epoch 缓存近零成本）；非 v2：此处准备一次
      let systemForModel = ''
      if (!enableRuntimeV2) {
        systemForModel = prepareSystemPromptWithEpoch({
          sessionId,
          fullSystemPrompt: builtSystemPrompt
        }).systemPrompt
      }

      runtimeRecorder.record({
        type: 'session.prompt_admitted',
        sessionId,
        userMessageId,
        sessionKind: workspaceOptions?.sessionKind,
        timestamp: Date.now()
      })

      const cachingCtx = {
        providerType: effectiveProviderType,
        providerId: provider.config?.id,
        modelId,
        sessionId,
        baseUrl: provider.config?.baseUrl
      }

      const reasoningEffortSetting = normalizeReasoningEffortSetting(
        mergedUserConfig?.['reasoningEffort'] ?? mergedUserConfig?.['reasoningEffortDefault']
      ) as ReasoningEffortSetting
      const budgetRaw = mergedUserConfig?.['reasoningBudgetTokens']
      const budgetTokens =
        typeof budgetRaw === 'number'
          ? budgetRaw
          : typeof budgetRaw === 'string' && budgetRaw.trim()
            ? Number(budgetRaw)
            : undefined
      const builtReasoning = buildDefaultReasoningOptions({
        modelId,
        providerType: effectiveProviderType,
        baseUrl: provider.config?.baseUrl,
        effort: reasoningEffortSetting,
        budgetTokens,
        hasTools: Boolean(enabledTools && Object.keys(enabledTools).length > 0)
      })

      const accumulator = new StreamAccumulator()
      let doomTripped = false
      const doomObserver = attachDoomLoopObserver({
        sessionId,
        threshold: doomLoopThreshold,
        onTripped: () => {
          doomTripped = true
          // 尽快打断当前 claim 流，避免本 turn 继续跑完工具循环
          abortAgentStreamSession(sessionId)
        }
      })
      let lastFinishReason = 'unknown'
      let turnToolCalls = 0

      const adapter = new StreamChunkAdapter(accumulator, {
        onChunk: (chunk) => {
          if (chunk.type === ChunkType.TOOL_CALL) {
            turnToolCalls += 1
            doomObserver.observe(chunk.toolName, chunk.input)
          }
          if (chunk.type === ChunkType.STEP_FINISH) {
            lastFinishReason = chunk.finishReason || lastFinishReason
          }
          this.dispatchChunkToCallbacks(chunk, callbacks)
          const runtimeEvents = bridgeStreamChunkToRuntimeEvents(
            sessionId,
            chunk,
            runtimeBridgeState
          )
          for (const event of runtimeEvents) {
            if (event.type === 'session.interrupted') {
              recordRuntimeInterrupted(event.reason)
            } else {
              runtimeRecorder.record(event)
            }
          }
        }
      })

      const runOneStream = async (
        messages: typeof messagesForModel,
        maxStepsThisTurn: number,
        systemPromptThisTurn: string
      ) =>
        runWithOpenAiThinkingInjectAsync(builtReasoning.openAiThinkingInject, async () =>
          streamText({
            model,
            messages,
            system: buildCachedSystemForStream(systemPromptThisTurn, cachingCtx),
            tools: enabledTools,
            stopWhen: stepCountIs(maxStepsThisTurn),
            abortSignal,
            experimental_repairToolCall: buildToolCallRepairHandler(),
            ...(builtReasoning.providerOptions
              ? { providerOptions: builtReasoning.providerOptions }
              : {}),
            ...(hasSegmenter && cjkSegmenter
              ? { experimental_transform: smoothStream({ chunking: cjkSegmenter }) }
              : {})
          } as any)
        )

      let streamResult: Awaited<ReturnType<typeof runOneStream>>
      let streamError: unknown = null

      if (enableRuntimeV2) {
        // 起始浅拷贝一次；后续 turn 就地 push，避免每 turn 全量拷贝
        let turnMessages = [...messagesForModel] as any[]
        streamResult = undefined as any
        for (let turnIndex = 0; turnIndex < effectiveMaxSteps; turnIndex++) {
          if (abortSignal?.aborted || doomTripped) break
          // turn 边界再 reconcile（压缩后 / 环境变更），本 turn 必须用 prepare 返回的 systemPrompt
          const turned = prepareSystemPromptWithEpoch({
            sessionId,
            fullSystemPrompt: builtSystemPrompt
          })
          systemForModel = turned.systemPrompt
          emitTurnStarted(sessionId, turnIndex)
          turnToolCalls = 0
          lastFinishReason = 'unknown'
          const turnStream = await runOneStream(turnMessages, 1, turned.systemPrompt)
          streamResult = turnStream
          const consumed = await adapter.consumeStream(turnStream)
          if (consumed.error) streamError = consumed.error
          const continueNeeded = needsProviderTurnContinuation({
            finishReason: lastFinishReason,
            hadToolCalls: turnToolCalls > 0,
            turnIndex,
            maxSteps: effectiveMaxSteps,
            aborted: Boolean(abortSignal?.aborted) || isAgentStreamAbortError(streamError),
            doomLoopTripped: doomTripped
          })
          emitTurnFinished(sessionId, turnIndex, {
            finishReason: lastFinishReason,
            needsContinuation: continueNeeded
          })
          if (!continueNeeded || doomTripped || abortSignal?.aborted || streamError) break
          try {
            const response = await turnStream.response
            const nextMessages = (response as { messages?: unknown[] } | undefined)?.messages
            if (Array.isArray(nextMessages) && nextMessages.length > 0) {
              // 续跑可就地追加，避免每 turn 全量拷贝
              turnMessages.push(...(nextMessages as any[]))
            } else {
              break
            }
          } catch {
            break
          }
        }
        if (!streamResult) {
          if (!systemForModel) {
            systemForModel = prepareSystemPromptWithEpoch({
              sessionId,
              fullSystemPrompt: builtSystemPrompt
            }).systemPrompt
          }
          streamResult = await runOneStream(messagesForModel, 1, systemForModel)
          streamError = (await adapter.consumeStream(streamResult)).error
        }
      } else {
        streamResult = await runOneStream(messagesForModel, effectiveMaxSteps, systemForModel)
        streamError = (await adapter.consumeStream(streamResult)).error
      }

      // doom-loop 自触发 abort 时 abortSignal 也会 aborted，不可伪装成普通用户取消
      const streamAborted =
        Boolean(abortSignal?.aborted) || isAgentStreamAbortError(streamError)
      const userAborted = streamAborted && !doomTripped

      // 记录性能指标
      const metrics = adapter.getMetrics()
      logger.info(
        `[AgentSessionService] 性能指标: TTFT=${metrics.timeToFirstToken}ms, 总耗时=${metrics.totalDuration}ms, 速度=${metrics.tokensPerSecond} tok/s`
      )

      const hasModelOutput =
        Boolean(accumulator.sanitizedText.trim()) ||
        Boolean(accumulator.reasoning.trim()) ||
        accumulator.toolCalls.length > 0

      // 用户主动取消 / doom-loop：不要误报「模型未返回任何内容」
      if (doomTripped) {
        streamError = new Error('检测到工具调用死循环，已中断本轮')
      } else if (userAborted) {
        streamError = isAgentStreamAbortError(streamError)
          ? streamError
          : new DOMException('The operation was aborted', 'AbortError')
      } else if (!streamError && !hasModelOutput) {
        streamError = new Error('模型未返回任何内容，请检查附件格式或稍后重试')
      }

      if (streamError && !userAborted && !doomTripped) {
        logger.warn(
          '[AgentSessionService] Stream encountered a fatal error:',
          streamError instanceof Error ? streamError.message : String(streamError)
        )
      }

      // 6. 落盘（被更新的重试取代时跳过，避免重复 assistant 消息）
      if (
        streamClaimGeneration !== undefined &&
        !isAgentStreamSessionClaimActive(sessionId, streamClaimGeneration)
      ) {
        logger.info(
          `[AgentSessionService] Skip persist for session ${sessionId}: stream superseded`
        )
        recordRuntimeInterrupted('superseded')
        return
      }

      // 用户主动取消 / doom-loop：不落盘 partial assistant
      if (userAborted || doomTripped) {
        logger.info(
          `[AgentSessionService] Skip persist for session ${sessionId}: ${
            doomTripped ? 'doom-loop' : 'user aborted'
          }`
        )
        if (doomTripped) {
          const doomErr =
            streamError instanceof Error
              ? streamError
              : new Error('检测到工具调用死循环，已中断本轮')
          runtimeRecorder.record({
            type: 'session.stream_finished',
            sessionId,
            success: false,
            error: doomErr.message,
            timestamp: Date.now()
          })
          callbacks?.onError?.(doomErr)
        } else {
          callbacks?.onFinish?.({
            messageId: undefined,
            inputTokens: 0,
            outputTokens: 0,
            cacheReadInputTokens: 0,
            cacheWriteInputTokens: 0,
            costMicros: 0
          })
        }
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
        namingModelId: systemModels?.namingModelId,
        flushSessionToDisk,
        userConfig: mergedUserConfig,
        agentGateParts: gateSessionBuffer.buildPartDataList(),
        fileChangeParts: workspaceSessionBuffer.buildPartDataList()
      })

      if (!streamError && accumulator.toolCalls.length > 0) {
        await ContextCompressorService.runPrune(sessionRepo, sessionId, undefined, {
          flushSessionToDisk
        })
      }

      // 7. 向外抛出完成/错误回调（仅一次，避免覆盖真实 API 错误）
      if (streamError && !isAgentStreamAbortError(streamError) && !abortSignal?.aborted) {
        const errObj =
          streamError instanceof Error ? streamError : new Error(String(streamError))
        runtimeRecorder.record({
          type: 'session.stream_finished',
          sessionId,
          success: false,
          error: errObj.message,
          timestamp: Date.now()
        })
        callbacks?.onError?.(errObj)
      } else if (!streamError) {
        runtimeRecorder.record({
          type: 'session.stream_finished',
          sessionId,
          success: true,
          messageId: usageResult.assistantMessageId,
          usage: {
            inputTokens: usageResult.inputTokens,
            outputTokens: usageResult.outputTokens,
            cacheReadInputTokens: usageResult.cacheReadInputTokens,
            cacheWriteInputTokens: usageResult.cacheWriteInputTokens
          },
          timestamp: Date.now()
        })
        callbacks?.onFinish?.({
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
      const aborted = isAgentStreamAbortError(err) || abortSignal?.aborted === true
      if (!aborted) {
        runtimeRecorder.record({
          type: 'session.stream_finished',
          sessionId,
          success: false,
          error: err.message,
          timestamp: Date.now()
        })
      }
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
      throw aborted ? new DOMException('The operation was aborted', 'AbortError') : err
    } finally {
      unsubGateBuffer()
      abortSignal?.removeEventListener('abort', onAbortCancelGate)
      abortSignal?.removeEventListener('abort', onAbortRuntime)
      sessionAgentGate?.cancelSession(sessionId, 'stream ended')
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
        callbacks.onToolCallStart?.(chunk.toolName, chunk.input, chunk.toolCallId)
        break
      case ChunkType.TOOL_RESULT:
        callbacks.onToolCallResult?.(chunk.toolName, chunk.output, chunk.toolCallId)
        break
      case ChunkType.ERROR:
        break
    }
  }
}
