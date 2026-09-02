import {
  logger,
  assistantRowToEmojiPrefs,
  isAgentStreamAbortError,
  type AssistantEmojiPrefs,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  type BaishouAgentGateConfig,
  type SessionInputDelivery,
  type SessionInputRecord,
} from '@baishou/shared'
import {
  AgentChatCoreService,
  emitAgentSessionRuntime,
  getSharedSessionInbox,
  isAgentStreamSessionBusy
} from '@baishou/ai'
import { ElectronStreamEmitter } from './electron-stream-emitter'
import {
  getAgentManagers,
  toolRegistry,
  createDiarySearcher,
  createWebSearchResultFetcher,
  createFetchSearchPage,
  buildStreamConfig,
  resolveStreamDialogueSelection,
  applySessionReasoningEffort
} from './agent-helpers'
import { desktopExtraVercelToolsFactory } from '../services/mcp-client-runtime'
import { settingsManager } from './settings.ipc'
import { resolveActiveVaultId, resolveVaultNameById } from './vault.ipc'
import { searchService } from '../services/search.service'
import {
  cancelAllAgentGateSessions,
  cancelAgentGateSession,
  getAgentGate
} from '../services/agent-gate.service'
import { createDesktopKnowledgeReader } from '../services/desktop-knowledge-reader'
import { createDesktopSkillsWriter } from '../services/desktop-skills-writer'
import { drainSessionInbox } from '../services/session-inbox-drain'
import { initDesktopSessionInboxStore } from '../services/session-inbox.store'

async function drainCompanionInbox(
  event: Electron.IpcMainInvokeEvent,
  sessionId: string
): Promise<void> {
  await initDesktopSessionInboxStore()
  await drainSessionInbox({
    sessionId,
    isBusy: isAgentStreamSessionBusy,
    logLabel: 'CompanionChat',
    runPromoted: async (promoted) => {
      const payload = (promoted.payload ?? {}) as {
        providerId?: string
        modelId?: string
        reasoningEffort?: string
        searchMode?: boolean
        attachments?: unknown[]
      }
      // skipInboxDrain：由本循环继续排空；若用户 Stop/abort 则中断整条 drain
      const chatResult = await AgentChatService.chat(event, {
        sessionId,
        text: promoted.text,
        userMsgId: promoted.userMessageId,
        providerId: payload.providerId,
        modelId: payload.modelId,
        reasoningEffort: payload.reasoningEffort,
        searchMode: payload.searchMode,
        attachments: payload.attachments,
        skipInboxDrain: true
      })
      return chatResult === 'aborted' ? 'aborted' : 'ok'
    }
  })
}

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
    const { GraphReaderAdapter, createCompanionGraphLookups, EmbeddingAdapter } =
      await import('@baishou/ai')
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
          const vaultId = resolveActiveVaultId()
          const result = await rag.recallRelations({
            vaultId,
            entity: opts.entity,
            mode: opts.mode,
            depth: opts.depth,
            nodeType: opts.nodeType,
            limit: opts.limit,
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
            })),
            paths: (result.paths ?? []).map((p) => ({
              nodeIds: p.nodeIds,
              nodeNames: p.nodeNames,
              edges: p.edges.map((e) => ({
                id: e.id,
                fromId: e.fromId,
                toId: e.toId,
                edgeType: e.edgeType,
                sourceRef: e.sourceRef,
                sourceExcerpt: e.sourceExcerpt
              })),
              edgeDirections: p.edgeDirections
            }))
          }
        })
      : undefined
    const { graphNodeLookup, graphEdgeLookup } = connectionManager.isConnected()
      ? createCompanionGraphLookups(async () => {
          const repo = new GraphRepository(connectionManager.getDb())
          const vaultId = resolveActiveVaultId()
          return {
            findByNameOrAlias: (name, nodeType) =>
              repo.findNodeByNameOrAlias(vaultId, name, nodeType),
            getNodeById: (id) => repo.getNodeById(id, vaultId),
            getEdgeById: (id) => repo.getEdgeById(id, vaultId)
          }
        })
      : { graphNodeLookup: undefined, graphEdgeLookup: undefined }

    const knowledgeReader = createDesktopKnowledgeReader(embedQuery)
    const { createDesktopKnowledgeGraphReader } = await import(
      '../services/desktop-knowledge-graph-reader'
    )
    const knowledgeGraphReader = createDesktopKnowledgeGraphReader()

    const { DesktopStoragePathService } = await import('../services/path.service')
    const { refreshDesktopAttachmentPathRemapper } = await import('./attachment-path-cache')
    await refreshDesktopAttachmentPathRemapper(new DesktopStoragePathService())

    let skillsCatalog: Array<{ name: string; description?: string }> | undefined
    try {
      const { listAgentSkillsCatalog } = await import('../services/agent-skills.service')
      skillsCatalog = await listAgentSkillsCatalog()
    } catch {
      skillsCatalog = undefined
    }

    return AgentChatCoreService.runStreamChat({
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
      deleteGraphRecord: async ({ kind, id }) => {
        if (!connectionManager.isConnected()) {
          throw new Error('Database not connected')
        }
        const { applyDiaryGraphSurgicalDelete } = await import('@baishou/core-desktop')
        const { getGraphRawManager } = await import('../services/raw-data-source.runtime')
        await applyDiaryGraphSurgicalDelete({
          kind,
          id,
          vaultId: resolveActiveVaultId(),
          manager: getGraphRawManager(),
          repo: new GraphRepository(connectionManager.getDb())
        })
      },
      graphReader,
      graphNodeLookup,
      graphEdgeLookup,
      knowledgeReader,
      knowledgeGraphReader,
      realSessionRepo,
      realSnapshotRepo,
      toolRegistry,
      diarySearcher: createDiarySearcher(),
      skillsWriter: createDesktopSkillsWriter(),
      webSearchResultFetcher: createWebSearchResultFetcher(),
      fetchSearchPage: createFetchSearchPage(),
      flushSessionToDisk: (sessionId) => sessionManager.flushSessionToDisk(sessionId),
      resolveVaultDisplayName: (vaultId) => resolveVaultNameById(vaultId),
      skillsCatalog,
      extraVercelToolsFactory: desktopExtraVercelToolsFactory,
      workspace: {
        folderRoot: '',
        sessionKind: 'companion',
        notebookIds: await (async () => {
          const { readSessionMountedNotebookIds } =
            await import('../services/session-mounted-notebooks')
          return readSessionMountedNotebookIds(params.sessionId)
        })()
      }
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
      reasoningEffort?: string
      /** 内部 drain 循环调用时跳过 finally 再入队，避免与锁冲突 */
      skipInboxDrain?: boolean
    }
  ): Promise<boolean | 'aborted'> {
    const { sessionManager } = getAgentManagers()
    /** 正常结束才 drain；Stop/abort 不排空 inbox */
    let shouldDrainInbox = false
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

      const mergedUserConfig = applySessionReasoningEffort(
        userConfig as Record<string, unknown>,
        args.reasoningEffort
      )

      const streamResult = await this.runStreamChat({
        event,
        sessionId: args.sessionId,
        userText: args.text,
        userMessageId: args.userMsgId,
        provider,
        modelId: resolved.modelId,
        systemModels,
        userConfig: mergedUserConfig,
        attachments: args.attachments,
        skipUserMessageRecording: Boolean(args.userMsgId)
      })

      try {
        await sessionManager.flushSessionToDisk(args.sessionId)
      } catch (e: any) {
        logger.error('Agent IPC persistence SSOT Error', e)
      }

      if (streamResult?.aborted) {
        return 'aborted'
      }
      shouldDrainInbox = !args.skipInboxDrain
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
        return 'aborted'
      }
      logger.error('Agent IPC stream error:', error)
      event.sender.send('agent:stream-finish', {
        sessionId: args.sessionId,
        error: error.message || 'Stream Error'
      })
      return false
    } finally {
      AgentChatCoreService.resetAbortController()
      if (shouldDrainInbox) {
        void drainCompanionInbox(event, args.sessionId)
      }
    }
  }

  public static async admit(
    event: Electron.IpcMainInvokeEvent,
    args: {
      sessionId: string
      text: string
      delivery?: SessionInputDelivery
      userMessageId?: string
      providerId?: string
      modelId?: string
      reasoningEffort?: string
      searchMode?: boolean
      attachments?: unknown[]
    }
  ): Promise<{ input: SessionInputRecord; started: boolean; queued: boolean }> {
    await initDesktopSessionInboxStore()
    const inbox = getSharedSessionInbox()
    const delivery: SessionInputDelivery = args.delivery === 'steer' ? 'steer' : 'queue'
    const input = inbox.admit({
      sessionId: args.sessionId,
      text: args.text,
      delivery,
      userMessageId: args.userMessageId,
      payload: {
        providerId: args.providerId,
        modelId: args.modelId,
        reasoningEffort: args.reasoningEffort,
        searchMode: args.searchMode,
        attachments: args.attachments
      }
    })
    emitAgentSessionRuntime({
      type: 'session.input_queued',
      sessionId: args.sessionId,
      inputId: input.id,
      delivery,
      timestamp: Date.now()
    })

    const busy = isAgentStreamSessionBusy(args.sessionId)
    if (busy) {
      return { input, started: false, queued: true }
    }

    void drainCompanionInbox(event, args.sessionId)
    return { input, started: true, queued: false }
  }

  public static async listPendingInputs(sessionId: string): Promise<SessionInputRecord[]> {
    await initDesktopSessionInboxStore()
    return getSharedSessionInbox().listPending(sessionId)
  }
}
