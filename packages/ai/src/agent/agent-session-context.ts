import {
  resolveSessionDisabledToolIds,
  normalizeAssistantKind,
  buildEffectiveAssistantSystemPrompt,
  isAutoInjectCurrentTimeEnabled,
  resolveVaultIdentity,
  type AssistantKind
} from '@baishou/shared'
import { AssistantRepository } from '@baishou/database'
import {
  estimateContextTokensForTrigger,
  estimateTokensSinceLastSnapshot,
  resolveSessionCompressionConfig,
  resolveCompressionTrigger,
  usableContextTokens
} from './context-compression.utils'
import {
  shouldCountTokensSinceLastSnapshot,
  shouldEvaluateCompressionAfterResend
} from './agent-session-recompress.util'
import { COMPRESSION_MESSAGE_FETCH_LIMIT } from './compression.constants'
import { ContextCompressorService } from './context-compressor.service'
import { ContextWindowBuilder } from './context-window.builder'
import { MessageAdapter, type MessageWithParts } from './message.adapter'
import { runCompressionSaveDiaryLifecycle } from '../baishou-agent-gate/compression-save-diary.lifecycle'
import { replaceEpochBaselineAfterCompression } from '../session-runtime/context-epoch'
import { resolveEffectiveProviderType } from '../providers/opencodego/opencodego.model-protocol'
import { logger } from '@baishou/shared'
import type { IBaishouAgentGate } from '../baishou-agent-gate/baishou-agent-gate.service'
import type { StreamChatOptions } from './agent-session.types'
import {
  buildMiddlewareChain,
  wrapLanguageModelWithMiddlewares,
  type ProviderType
} from '../middleware/middleware-factory'

export async function prepareAgentSessionContext(input: {
  options: StreamChatOptions
  sessionAgentGate?: IBaishouAgentGate
  workspaceOptions?: StreamChatOptions['workspace']
}): Promise<{
  model: ReturnType<typeof wrapLanguageModelWithMiddlewares>
  effectiveProviderType: string
  messagesForModel: Awaited<ReturnType<typeof MessageAdapter.toVercelMessages>>
  dbHistory: Awaited<ReturnType<typeof ContextWindowBuilder.buildFromMessages>>
  mergedUserConfig: Record<string, unknown>
  effectiveSystemPrompt?: string
  assistantKind: AssistantKind
  injectMessageTime: boolean
  configRecentCount: number
  vaultId: string
  vaultName: string
  saveDiaryBeforeCompression: (messages: MessageWithParts[]) => Promise<void>
}> {
  const { options, sessionAgentGate, workspaceOptions } = input
  const {
    sessionId,
    provider,
    modelId,
    sessionRepo,
    snapshotRepo,
    systemPrompt,
    userConfig,
    abortSignal,
    userMessageId,
    streamClaimGeneration,
    forceRecompress,
    flushSessionToDisk,
    resolveVaultDisplayName,
    diarySearcher
  } = options

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
        disabledToolIds: resolveSessionDisabledToolIds(
          Array.isArray(mergedUserConfig['disabledToolIds'])
            ? (mergedUserConfig['disabledToolIds'] as string[])
            : [],
          assistantKind,
          workspaceOptions?.sessionKind
        )
      }
      const combined = buildEffectiveAssistantSystemPrompt(ast.systemPrompt, ast.customSystemPrompt)
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

  let compressionConfig = await resolveSessionCompressionConfig(sessionId, sessionRepo)
  const loadSessionMessages = async () =>
    (await sessionRepo.getMessagesBySession(
      sessionId,
      COMPRESSION_MESSAGE_FETCH_LIMIT
    )) as MessageWithParts[]

  let sessionMessages = await loadSessionMessages()
  let snapshotForWindow = await (
    await import('./session-snapshot-restore')
  ).ensureSessionSnapshotsRestored(sessionId, snapshotRepo, sessionRepo, {
    restoreSynthesizedFromMarkers: forceRecompress !== true
  })
  {
    if (abortSignal?.aborted) {
      throw new DOMException('The operation was aborted', 'AbortError')
    }

    const usableWindow = usableContextTokens(
      compressionConfig.modelContextWindow ?? 0,
      compressionConfig.reservedTokens
    )
    const shouldEvaluateCompression =
      shouldEvaluateCompressionAfterResend({
        forceRecompress,
        hasCompressionSnapshot: Boolean(snapshotForWindow)
      }) &&
      (compressionConfig.force || compressionConfig.threshold > 0 || usableWindow > 0)

    if (shouldEvaluateCompression) {
      const countTokensSinceLastSnapshot = shouldCountTokensSinceLastSnapshot({
        forceRecompress,
        hasCompressionSnapshot: Boolean(snapshotForWindow)
      })
      const contextTokens =
        countTokensSinceLastSnapshot && snapshotForWindow
          ? estimateTokensSinceLastSnapshot(sessionMessages, snapshotForWindow)
          : estimateContextTokensForTrigger(sessionMessages, snapshotForWindow, {
              recentCount: configRecentCount,
              systemPrompt: effectiveSystemPrompt
            })
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
          resolveEffectiveProviderType(provider.config?.type ?? '', modelId),
          {
            ...(userMessageId ? { triggerUserMessageId: userMessageId } : {}),
            abortSignal,
            streamClaimGeneration,
            wrapMessageTime: injectMessageTime,
            prefetchedMessages: sessionMessages,
            recentCount: configRecentCount,
            systemPrompt: effectiveSystemPrompt,
            countTokensSinceLastSnapshot
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
          replaceEpochBaselineAfterCompression(sessionId, '')
        }
      }
    }
  }

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

  return {
    model,
    effectiveProviderType,
    messagesForModel,
    dbHistory,
    mergedUserConfig,
    effectiveSystemPrompt,
    assistantKind,
    injectMessageTime,
    configRecentCount,
    vaultId,
    vaultName,
    saveDiaryBeforeCompression
  }
}
