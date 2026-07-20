import {
  logger,
  assistantRowToEmojiPrefs,
  isAgentStreamAbortError,
  type AssistantEmojiPrefs,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  type BaishouAgentGateConfig
} from '@baishou/shared'
import { AgentChatCoreService } from '@baishou/ai'
import { ElectronStreamEmitter } from './electron-stream-emitter'
import {
  getAgentManagers,
  toolRegistry,
  createDiarySearcher,
  createWebSearchResultFetcher,
  createFetchSearchPage,
  buildStreamConfig,
  resolveStreamDialogueSelection
} from './agent-helpers'
import { settingsManager } from './settings.ipc'
import { vaultService } from './vault.ipc'
import { searchService } from '../services/search.service'
import {
  cancelAllAgentGateSessions,
  cancelAgentGateSession,
  getAgentGate
} from '../services/agent-gate.service'

export class AgentChatService {
  public static stopStream(sessionId?: string) {
    if (sessionId) {
      cancelAgentGateSession(sessionId, 'stream_stopped')
    } else {
      cancelAllAgentGateSessions('stream_stopped')
    }
    const stopped = AgentChatCoreService.stopStream(sessionId)
    searchService.requestAbort()
    void searchService.closeAllSearchWindows()
    return stopped
  }

  public static resetAbortController() {
    AgentChatCoreService.resetAbortController()
  }

  public static async getAssistantSessionPrefs(sessionId: string): Promise<{
    assistantContextWindow?: number
    assistantEmojiPrefs?: AssistantEmojiPrefs
  }> {
    try {
      const { realSessionRepo, realAssistantRepo } = getAgentManagers()
      const session = await realSessionRepo.getSessionById(sessionId)
      if (!session?.assistantId) return {}
      const assistant = await realAssistantRepo.findById(session.assistantId)
      if (!assistant) return {}
      return {
        assistantContextWindow: assistant.contextWindow ?? undefined,
        assistantEmojiPrefs: assistantRowToEmojiPrefs(assistant)
      }
    } catch (e: any) {
      logger.warn('Failed to load assistant session prefs:', e)
      return {}
    }
  }

  public static async getAssistantContextWindow(sessionId: string): Promise<number | undefined> {
    const prefs = await this.getAssistantSessionPrefs(sessionId)
    return prefs.assistantContextWindow
  }

  public static async buildStreamConfigForSession(
    sessionId: string,
    requestedProviderId?: string,
    requestedModelId?: string,
    searchMode?: boolean
  ) {
    const prefs = await this.getAssistantSessionPrefs(sessionId)
    return buildStreamConfig(
      requestedProviderId,
      requestedModelId,
      searchMode,
      prefs.assistantContextWindow,
      prefs.assistantEmojiPrefs
    )
  }

  public static async runStreamChat(params: {
    event: Electron.IpcMainInvokeEvent
    sessionId: string
    userText: string
    userMessageId?: string
    provider: unknown
    modelId: string
    systemModels: unknown
    userConfig: unknown
    attachments?: unknown[]
    skipUserMessageRecording?: boolean
    forceRecompress?: boolean
  }) {
    const { realSessionRepo, realSnapshotRepo, sessionManager } = getAgentManagers()
    const emitter = new ElectronStreamEmitter(params.event)
    const agentGate = await getAgentGate()
    const { getRawDataSourceManager, syncGraphPendingIndex } =
      await import('../services/raw-data-source.runtime')
    const rawDataSourceManager = getRawDataSourceManager()
    const { GraphReaderAdapter, EmbeddingAdapter } = await import('@baishou/ai')
    const { GraphRagService } = await import('@baishou/core-desktop')
    const { connectionManager, GraphRepository } = await import('@baishou/database-desktop')
    const systemModels = params.systemModels as {
      embeddingProvider?: { getLanguageModel?: unknown } & object
      embeddingModelId?: string
    } | null
    let embedQuery: ((text: string) => Promise<number[] | null>) | undefined
    if (systemModels?.embeddingProvider && systemModels.embeddingModelId) {
      try {
        const adapter = new EmbeddingAdapter(
          systemModels.embeddingProvider as never,
          systemModels.embeddingModelId
        )
        if (adapter.isConfigured) {
          embedQuery = (text) => adapter.embedQuery(text)
        }
      } catch {
        embedQuery = undefined
      }
    }
    const graphReader = connectionManager.isConnected()
      ? new GraphReaderAdapter(async (opts) => {
          const rag = new GraphRagService(new GraphRepository(connectionManager.getDb()))
          const vaultName = vaultService.getActiveVault()?.name || 'Personal'
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
      : undefined

    const { DesktopStoragePathService } = await import('../services/path.service')
    const { refreshDesktopAttachmentPathRemapper } = await import('./attachment-path-cache')
    await refreshDesktopAttachmentPathRemapper(new DesktopStoragePathService())

    await AgentChatCoreService.runStreamChat({
      emitter,
      sessionId: params.sessionId,
      userText: params.userText,
      userMessageId: params.userMessageId,
      provider: params.provider,
      modelId: params.modelId,
      systemModels: params.systemModels,
      userConfig: params.userConfig,
      attachments: params.attachments,
      skipUserMessageRecording: params.skipUserMessageRecording,
      forceRecompress: params.forceRecompress,
      agentGate,
      persistBaishouAgentGateConfig: async (config: BaishouAgentGateConfig) => {
        await settingsManager.set(BAISHOU_AGENT_GATE_CONFIG_KEY, config)
      },
      rawDataSourceManager,
      syncGraphPendingIndex,
      graphReader,
      realSessionRepo,
      realSnapshotRepo,
      toolRegistry,
      diarySearcher: createDiarySearcher(),
      webSearchResultFetcher: createWebSearchResultFetcher(),
      fetchSearchPage: createFetchSearchPage(),
      flushSessionToDisk: (sessionId) => sessionManager.flushSessionToDisk(sessionId)
    })
  }

  public static async chat(
    event: Electron.IpcMainInvokeEvent,
    args: {
      sessionId: string
      text: string
      providerId?: string
      modelId?: string
      attachments?: unknown[]
      searchMode?: boolean
      userMsgId?: string
    }
  ) {
    const { sessionManager } = getAgentManagers()
    try {
      const prefs = await this.getAssistantSessionPrefs(args.sessionId)
      const resolved = await resolveStreamDialogueSelection({
        sessionId: args.sessionId,
        requestedProviderId: args.providerId,
        requestedModelId: args.modelId
      })
      const { provider, systemModels, userConfig } = await buildStreamConfig(
        resolved.providerId,
        resolved.modelId,
        args.searchMode,
        prefs.assistantContextWindow,
        prefs.assistantEmojiPrefs
      )

      await this.runStreamChat({
        event,
        sessionId: args.sessionId,
        userText: args.text,
        userMessageId: args.userMsgId,
        provider,
        modelId: resolved.modelId,
        systemModels,
        userConfig,
        attachments: args.attachments,
        skipUserMessageRecording: Boolean(args.userMsgId)
      })

      try {
        await sessionManager.flushSessionToDisk(args.sessionId)
      } catch (e: any) {
        logger.error('Agent IPC persistence SSOT Error', e)
      }
      return true
    } catch (error: any) {
      if (isAgentStreamAbortError(error)) {
        cancelAgentGateSession(args.sessionId, 'stream_stopped')
        try {
          await sessionManager.flushSessionToDisk(args.sessionId)
        } catch (e: any) {
          logger.error('Agent IPC persistence SSOT Error after abort', e)
        }
        event.sender.send('agent:stream-finish', { sessionId: args.sessionId, success: true })
        return true
      }
      logger.error('Agent IPC stream error:', error)
      event.sender.send('agent:stream-finish', {
        sessionId: args.sessionId,
        error: error.message || 'Stream Error'
      })
      return false
    } finally {
      AgentChatCoreService.resetAbortController()
    }
  }
}
