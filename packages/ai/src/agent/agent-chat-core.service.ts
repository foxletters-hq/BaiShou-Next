import { AgentSessionService } from './agent-session.service'
import type { IStreamEmitter } from './stream-emitter.interface'
import { isAgentStreamAbortError } from '@baishou/shared'
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
    flushSessionToDisk?: (sessionId: string) => Promise<void>
    agentGate?: unknown
    persistBaishouAgentGateConfig?: (
      config: import('@baishou/shared').BaishouAgentGateConfig
    ) => Promise<void>
    rawDataSourceManager?: import('@baishou/shared').ToolRawDataSourceManager
    syncGraphPendingIndex?: () => Promise<void>
    deleteGraphRecord?: (input: { kind: 'node' | 'edge'; id: string }) => Promise<void>
    graphReader?: import('@baishou/shared').ToolGraphReader
    graphNodeLookup?: import('@baishou/shared').ToolGraphNodeLookup
    graphEdgeLookup?: import('@baishou/shared').ToolGraphEdgeLookup
    knowledgeReader?: import('@baishou/shared').ToolKnowledgeReader
    knowledgeGraphReader?: import('@baishou/shared').ToolKnowledgeGraphReader
    skillsWriter?: import('../tools/agent.tool').ToolContext['skillsWriter']
    workspace?: import('./agent-session.types').StreamChatOptions['workspace']
    resolveVaultDisplayName?: (vaultId: string) => string | null | undefined
    skillsCatalog?: import('./agent-session.types').StreamChatOptions['skillsCatalog']
    extraVercelToolsFactory?: import('./agent-session.types').StreamChatOptions['extraVercelToolsFactory']
    maxSteps?: number
    sessionRuntimeV2?: boolean
  }): Promise<{ aborted: boolean }> {
    const claim = claimAgentStreamSession(params.sessionId)

    try {
      if (claim.signal.aborted) {
        params.emitter.sendFinish(params.sessionId, { success: true })
        return { aborted: true }
      }

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
          agentGate: params.agentGate,
          persistBaishouAgentGateConfig: params.persistBaishouAgentGateConfig,
          rawDataSourceManager: params.rawDataSourceManager,
          syncGraphPendingIndex: params.syncGraphPendingIndex,
          deleteGraphRecord: params.deleteGraphRecord,
          graphReader: params.graphReader,
          graphNodeLookup: params.graphNodeLookup,
          graphEdgeLookup: params.graphEdgeLookup,
          knowledgeReader: params.knowledgeReader,
          knowledgeGraphReader: params.knowledgeGraphReader,
          skillsWriter: params.skillsWriter,
          workspace: params.workspace,
          resolveVaultDisplayName: params.resolveVaultDisplayName,
          skillsCatalog: params.skillsCatalog,
          extraVercelToolsFactory: params.extraVercelToolsFactory,
          maxSteps: params.maxSteps,
          sessionRuntimeV2: params.sessionRuntimeV2,
          abortSignal: claim.signal,
          streamClaimGeneration: claim.generation,
          flushSessionToDisk: params.flushSessionToDisk
        } as Parameters<typeof agentService.streamChat>[0],
        {
          onTextDelta: (chunk) => params.emitter.sendChunk(params.sessionId, chunk),
          onReasoningDelta: (chunk) => params.emitter.sendReasoningChunk(params.sessionId, chunk),
          onToolCallStart: (name, argsObj, toolCallId) =>
            params.emitter.sendToolStart(params.sessionId, name, argsObj, toolCallId),
          onToolCallResult: (name, result, toolCallId) =>
            params.emitter.sendToolResult(params.sessionId, name, result, toolCallId),
          onError: (err) => {
            if (isAgentStreamAbortError(err)) {
              params.emitter.sendFinish(params.sessionId, { success: true })
              return
            }
            params.emitter.sendFinish(params.sessionId, { error: err.message })
          },
          onFinish: (result) =>
            params.emitter.sendFinish(params.sessionId, { success: true, ...result })
        }
      )
      return { aborted: claim.signal.aborted }
    } catch (error) {
      if (isAgentStreamAbortError(error) || claim.signal.aborted) {
        return { aborted: true }
      }
      throw error
    } finally {
      releaseAgentStreamSession(params.sessionId, claim.generation)
    }
  }
}
