import i18n from 'i18next'
import {
  isAgentStreamAbortError,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  logger
} from '@baishou/shared'
import {
  AgentSessionService,
  type IBaishouAgentGate,
  type StreamChatCallbacks
} from '@baishou/ai'
import type { BaishouAgentGateConfig } from '@baishou/shared'
import {
  buildMobileStreamUserConfig,
  resolveAssistantContextWindow,
  resolveAssistantEmojiPrefs
} from '../../services/mobile-context-at-message.service'
import { webFetchContent, fetchSearchPageHtml } from './web-fetch'
import type { ToolRegistry, ToolDiarySearcher, AIProviderRegistry } from '@baishou/ai'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'

export function createStartAgentChat(deps: {
  agentService: AgentSessionService
  toolRegistry: ToolRegistry
  registry: AIProviderRegistry
  agentDbRuntimeRef: typeof agentDbRuntimeRef
  getDiarySearcher: () => ToolDiarySearcher | undefined
  getAgentGate?: () => IBaishouAgentGate | undefined
  persistBaishouAgentGateConfig?: (config: BaishouAgentGateConfig) => Promise<void>
}) {
  const {
    agentService,
    toolRegistry,
    registry,
    getDiarySearcher,
    getAgentGate,
    persistBaishouAgentGateConfig
  } = deps
  return async (
    sessionId: string,
    userText: string,
    callbacks: StreamChatCallbacks,
    overrides?: {
      providerId?: string
      modelId?: string
      searchMode?: boolean
      abortSignal?: AbortSignal
      userMessageId?: string
      skipUserMessageRecording?: boolean
      forceRecompress?: boolean
      streamClaimGeneration?: number
      attachments?: unknown[]
    }
  ) => {
    try {
      const runtime = agentDbRuntimeRef.current
      if (!runtime) {
        throw new Error(
          i18n.t(
            'auto.apps.mobile.src.providers.baishou.provider.start.agent.chat.L43',
            '数据库未就绪'
          )
        )
      }
      const providers = (await runtime.settingsManager.get<any[]>('ai_providers')) || []
      const globalModels = await runtime.settingsManager.get<any>('global_models')

      const providerId = overrides?.providerId || globalModels?.globalDialogueProviderId
      const config =
        providers.find((p: any) => p.id === providerId) || providers.find((p: any) => p.isEnabled)

      if (!config) throw new Error('No active provider configured')

      const provider = registry.getOrUpdateProvider(config)

      const searchMode = overrides?.searchMode ?? false
      const [assistantContextWindow, assistantEmojiPrefs] = await Promise.all([
        resolveAssistantContextWindow(sessionId, runtime.sessionRepo, runtime.assistantManager),
        resolveAssistantEmojiPrefs(sessionId, runtime.sessionRepo, runtime.assistantManager)
      ])
      const userConfig = await buildMobileStreamUserConfig(runtime.settingsManager, searchMode, {
        assistantContextWindow,
        assistantEmojiPrefs
      })

      const embeddingProviderId = globalModels?.globalEmbeddingProviderId
      const embeddingModelId = globalModels?.globalEmbeddingModelId
      let embeddingProvider
      if (embeddingProviderId && embeddingModelId && embeddingModelId !== 'off') {
        const embConfig = providers.find((p: any) => p.id === embeddingProviderId)
        if (embConfig) {
          embeddingProvider = registry.getOrUpdateProvider(embConfig)
        }
      }

      const namingModelConfigured =
        isConfiguredProviderId(globalModels?.globalNamingProviderId) &&
        isConfiguredDialogueModelId(globalModels?.globalNamingModelId)
      let namingProvider
      let namingModelId: string | undefined
      if (namingModelConfigured) {
        const namingConfig = providers.find(
          (p: any) => p.id === globalModels.globalNamingProviderId
        )
        if (namingConfig) {
          namingProvider = registry.getOrUpdateProvider(namingConfig)
          namingModelId = globalModels.globalNamingModelId
        }
      }

      const modelId =
        overrides?.modelId ||
        globalModels?.globalDialogueModelId ||
        config.defaultDialogueModel ||
        config.models[0]

      const systemModels = {
        namingModelConfigured,
        ...(namingProvider && namingModelId ? { namingProvider, namingModelId } : {}),
        ...(embeddingProvider && embeddingModelId ? { embeddingProvider, embeddingModelId } : {})
      }

      await agentService.streamChat(
        {
          sessionId,
          userText,
          provider,
          modelId,
          toolRegistry,
          sessionRepo: runtime.sessionRepo,
          snapshotRepo: runtime.snapshotRepo,
          userConfig,
          systemModels: Object.keys(systemModels).length > 0 ? systemModels : undefined,
          diarySearcher: getDiarySearcher(),
          webSearchResultFetcher: webFetchContent,
          fetchSearchPage: fetchSearchPageHtml,
          abortSignal: overrides?.abortSignal,
          userMessageId: overrides?.userMessageId,
          skipUserMessageRecording: overrides?.skipUserMessageRecording,
          forceRecompress: overrides?.forceRecompress,
          streamClaimGeneration: overrides?.streamClaimGeneration,
          attachments: overrides?.attachments as any,
          flushSessionToDisk: (id) => runtime.sessionManager.flushSessionToDisk(id),
          agentGate: getAgentGate?.(),
          persistBaishouAgentGateConfig,
          rawDataSourceManager: (
            await import('../../services/mobile-raw-data-source.runtime')
          ).getMobileRawDataSourceManager() ?? undefined
        },
        callbacks
      )
    } catch (e) {
      if (!isAgentStreamAbortError(e)) {
        logger.error('Mobile Agent Chat Failed:', e as Error)
      }
      throw e
    }
  }
}
