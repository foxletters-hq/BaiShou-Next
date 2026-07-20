import i18n from 'i18next'
import {
  isAgentStreamAbortError,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  logger
} from '@baishou/shared'
import {
  AgentSessionService,
  EmbeddingAdapter,
  GraphReaderAdapter,
  type IBaishouAgentGate,
  type StreamChatCallbacks
} from '@baishou/ai'
import { GraphRagService } from '@baishou/core-mobile'
import { GraphRepository } from '@baishou/database'
import type { BaishouAgentGateConfig } from '@baishou/shared'
import {
  buildMobileStreamUserConfig,
  resolveAssistantContextWindow,
  resolveAssistantEmojiPrefs
} from '../../services/mobile-context-at-message.service'
import { webFetchContent, fetchSearchPageHtml } from './web-fetch'
import type {
  ToolRegistry,
  ToolDiarySearcher,
  AIProviderRegistry,
  IAIProvider
} from '@baishou/ai'
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
      let embeddingProvider: IAIProvider | undefined
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
          ).getMobileRawDataSourceManager() ?? undefined,
          syncGraphPendingIndex: async () => {
            const { syncMobileGraphPendingIndex } = await import(
              '../../services/mobile-raw-data-source.runtime'
            )
            await syncMobileGraphPendingIndex({
              drizzleDb: runtime.drizzleDb,
              embeddingProvider: embeddingProvider ?? null,
              embeddingModelId: embeddingModelId ?? null
            })
          },
          graphReader: new GraphReaderAdapter(async (opts) => {
            const session = await runtime.sessionRepo.getSessionById(sessionId)
            const vaultName = session?.vaultName || 'Personal'
            const rag = new GraphRagService(new GraphRepository(runtime.drizzleDb))
            let embedQuery: ((text: string) => Promise<number[] | null>) | undefined
            if (embeddingProvider && embeddingModelId) {
              try {
                const adapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId)
                if (adapter.isConfigured) {
                  embedQuery = (text) => adapter.embedQuery(text)
                }
              } catch {
                embedQuery = undefined
              }
            }
            const result = await rag.recallRelations({
              vaultName,
              entity: opts.entity,
              mode: opts.mode,
              embedQuery
            })
            return {
              anchors: result.anchors.map((a) => ({
                id: a.id,
                name: a.name,
                nodeType: a.nodeType,
                summary: a.summary
              })),
              subgraph: result.subgraph.map((e) => ({
                id: e.id,
                fromId: e.fromId,
                toId: e.toId,
                edgeType: e.edgeType,
                sourceRef: e.sourceRef,
                sourceExcerpt: e.sourceExcerpt,
                validFrom: e.validFrom
              })),
              timeline: result.timeline?.map((e) => ({
                id: e.id,
                fromId: e.fromId,
                toId: e.toId,
                edgeType: e.edgeType,
                sourceRef: e.sourceRef,
                sourceExcerpt: e.sourceExcerpt,
                validFrom: e.validFrom
              })),
              nodes: result.nodes.map((n) => ({
                id: n.id,
                name: n.name,
                nodeType: n.nodeType,
                summary: n.summary
              }))
            }
          })
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
