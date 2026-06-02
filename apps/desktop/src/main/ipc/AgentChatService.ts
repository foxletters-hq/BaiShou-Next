import { logger } from '@baishou/shared'
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
  public static stopStream() {
    const stopped = AgentChatCoreService.stopStream()
    searchService.requestAbort()
    void searchService.closeAllSearchWindows()
    return stopped
  }

  public static resetAbortController() {
    AgentChatCoreService.resetAbortController()
  }

  public static async getAssistantContextWindow(sessionId: string): Promise<number | undefined> {
    try {
      const { realSessionRepo, realAssistantRepo } = getAgentManagers()
      const session = await realSessionRepo.getSessionById(sessionId)
      if (session?.assistantId) {
        const assistant = await realAssistantRepo.findById(session.assistantId)
        if (assistant?.contextWindow !== undefined) {
          return assistant.contextWindow
        }
      }
    } catch (e: any) {
      logger.warn('Failed to load assistant context window:', e)
    }
    return undefined
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
  }) {
    const { realSessionRepo, realSnapshotRepo } = getAgentManagers()
    const emitter = new ElectronStreamEmitter(params.event)

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
      realSessionRepo,
      realSnapshotRepo,
      toolRegistry,
      diarySearcher: createDiarySearcher(),
      webSearchResultFetcher: createWebSearchResultFetcher(),
      fetchSearchPage: createFetchSearchPage()
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
    try {
      const { sessionManager } = getAgentManagers()
      const assistantContextWindow = await this.getAssistantContextWindow(args.sessionId)

      const { provider, globalModels, systemModels, userConfig } = await buildStreamConfig(
        args.providerId,
        args.modelId,
        args.searchMode,
        assistantContextWindow
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
        attachments: args.attachments
      })

      try {
        await sessionManager.flushSessionToDisk(args.sessionId)
      } catch (e: any) {
        logger.error('Agent IPC persistence SSOT Error', e)
      }
      return true
    } catch (error: any) {
      if (error.name === 'AbortError') {
        event.sender.send('agent:stream-finish', { success: true })
        return true
      }
      logger.error('Agent IPC stream error:', error)
      event.sender.send('agent:stream-finish', { error: error.message || 'Stream Error' })
      return false
    } finally {
      AgentChatCoreService.resetAbortController()
    }
  }
}
