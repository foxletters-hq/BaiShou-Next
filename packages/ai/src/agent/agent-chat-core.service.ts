import { AgentSessionService } from './agent-session.service'
import type { IStreamEmitter } from './stream-emitter.interface'

const agentService = new AgentSessionService()

export class AgentChatCoreService {
  private static globalAbortController: AbortController | null = null

  public static stopStream() {
    if (this.globalAbortController) {
      this.globalAbortController.abort()
      this.globalAbortController = null
    }
    return true
  }

  public static resetAbortController() {
    this.globalAbortController = null
  }

  public static async runStreamChat(params: {
    emitter: IStreamEmitter
    sessionId: string
    userText: string
    userMessageId?: string
    provider: unknown
    modelId: string
    systemModels: unknown
    userConfig: unknown
    attachments?: unknown[]
    skipUserMessageRecording?: boolean
    realSessionRepo: unknown
    realSnapshotRepo: unknown
    toolRegistry: unknown
    diarySearcher: unknown
    webSearchResultFetcher: unknown
    fetchSearchPage: unknown
  }) {
    this.globalAbortController = new AbortController()

    await agentService.streamChat(
      {
        sessionId: params.sessionId,
        userText: params.userText,
        userMessageId: params.userMessageId,
        provider: params.provider,
        modelId: params.modelId,
        systemModels: params.systemModels,
        userConfig: params.userConfig,
        attachments: params.attachments,
        skipUserMessageRecording: params.skipUserMessageRecording,
        toolRegistry: params.toolRegistry,
        sessionRepo: params.realSessionRepo,
        snapshotRepo: params.realSnapshotRepo,
        diarySearcher: params.diarySearcher,
        webSearchResultFetcher: params.webSearchResultFetcher,
        fetchSearchPage: params.fetchSearchPage,
        abortSignal: this.globalAbortController.signal
      } as Parameters<typeof agentService.streamChat>[0],
      {
        onTextDelta: (chunk) => params.emitter.sendChunk(params.sessionId, chunk),
        onReasoningDelta: (chunk) =>
          params.emitter.sendReasoningChunk(params.sessionId, chunk),
        onToolCallStart: (name, argsObj) =>
          params.emitter.sendToolStart(params.sessionId, name, argsObj),
        onToolCallResult: (name, result) =>
          params.emitter.sendToolResult(params.sessionId, name, result),
        onError: (err) =>
          params.emitter.sendFinish(params.sessionId, { error: err.message }),
        onFinish: () => params.emitter.sendFinish(params.sessionId, { success: true })
      }
    )
  }
}
