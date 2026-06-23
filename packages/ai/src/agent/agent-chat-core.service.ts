import { AgentSessionService } from './agent-session.service'
import type { IStreamEmitter } from './stream-emitter.interface'
import {
  abortAllAgentStreamSessions,
  abortAgentStreamSession,
  claimAgentStreamSession,
  releaseAgentStreamSession
} from './stream-session-guard'
import { clearCompressionSessionLock } from './compression-session-lock'

const agentService = new AgentSessionService()

export class AgentChatCoreService {
  public static stopStream(sessionId?: string) {
    if (sessionId) {
      abortAgentStreamSession(sessionId)
      clearCompressionSessionLock(sessionId)
    } else {
      abortAllAgentStreamSessions()
    }
    return true
  }

  public static resetAbortController() {
    // 保留 API 兼容；流中止已由 stream-session-guard 管理
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
    forceRecompress?: boolean
    realSessionRepo: unknown
    realSnapshotRepo: unknown
    toolRegistry: unknown
    diarySearcher: unknown
    webSearchResultFetcher: unknown
    fetchSearchPage: unknown
  }) {
    const claim = claimAgentStreamSession(params.sessionId)

    try {
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
          forceRecompress: params.forceRecompress,
          toolRegistry: params.toolRegistry,
          sessionRepo: params.realSessionRepo,
          snapshotRepo: params.realSnapshotRepo,
          diarySearcher: params.diarySearcher,
          webSearchResultFetcher: params.webSearchResultFetcher,
          fetchSearchPage: params.fetchSearchPage,
          abortSignal: claim.signal,
          streamClaimGeneration: claim.generation
        } as Parameters<typeof agentService.streamChat>[0],
        {
          onTextDelta: (chunk) => params.emitter.sendChunk(params.sessionId, chunk),
          onReasoningDelta: (chunk) => params.emitter.sendReasoningChunk(params.sessionId, chunk),
          onToolCallStart: (name, argsObj) =>
            params.emitter.sendToolStart(params.sessionId, name, argsObj),
          onToolCallResult: (name, result) =>
            params.emitter.sendToolResult(params.sessionId, name, result),
          onError: (err) => params.emitter.sendFinish(params.sessionId, { error: err.message }),
          onFinish: (result) =>
            params.emitter.sendFinish(params.sessionId, { success: true, ...result })
        }
      )
    } finally {
      releaseAgentStreamSession(params.sessionId, claim.generation)
    }
  }
}
