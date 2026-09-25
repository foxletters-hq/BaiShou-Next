import {
  logger,
  assistantRowToEmojiPrefs,
  isAgentStreamAbortError,
  type AssistantEmojiPrefs,
  type SessionInputDelivery,
  type SessionInputRecord
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
import { buildCompanionStreamHost } from './companion-stream-host'
import { searchService } from '../services/search.service'
import { cancelAllAgentGateSessions, cancelAgentGateSession } from '../services/agent-gate.service'
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
    const streamHost = await buildCompanionStreamHost({
      sessionId: params.sessionId,
      systemModels: params.systemModels
    })

    return AgentChatCoreService.runStreamChat({
      ...streamHost,
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
