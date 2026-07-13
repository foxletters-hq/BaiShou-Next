import {
  logger,
  assistantRowToEmojiPrefs,
  isAgentStreamAbortError,
  type AssistantEmojiPrefs
} from '@baishou/shared'
import { AgentChatCoreService } from '@baishou/ai'
import { ElectronStreamEmitter } from './electron-stream-emitter'
import {
  getAgentManagers,
  toolRegistry,
  createDiarySearcher,
  createWebSearchResultFetcher,
  createFetchSearchPage,
  buildStreamConfig
} from './agent-helpers'
import { searchService } from '../services/search.service'

export class AgentChatService {
  public static stopStream(sessionId?: string) {
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
      const { provider, globalModels, systemModels, userConfig } =
        await this.buildStreamConfigForSession(
          args.sessionId,
          args.providerId,
          args.modelId,
          args.searchMode
        )

      await this.runStreamChat({
        event,
        sessionId: args.sessionId,
        userText: args.text,
        userMessageId: args.userMsgId,
        provider,
        modelId: args.modelId || globalModels?.globalDialogueModelId || 'deepseek-chat',
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
