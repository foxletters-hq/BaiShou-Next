import { logger } from '@baishou/shared'
import { AgentChatCoreService } from '../agent-chat-core.service'
import type { IStreamEmitter } from '../stream-emitter.interface'

export interface ActionDeps {
  emitter: IStreamEmitter
  sessionId: string
  realSessionRepo: unknown
  realSnapshotRepo: unknown
  toolRegistry: unknown
  diarySearcher: unknown
  webSearchResultFetcher: unknown
  fetchSearchPage: unknown
  sessionManager?: { flushSessionToDisk(sessionId: string): Promise<void> }
}

export interface StreamRunConfig {
  provider: unknown
  modelId: string
  systemModels: unknown
  userConfig: unknown
  attachments?: unknown[]
  skipUserMessageRecording?: boolean
}

export function extractTextFromUserMessage(userMessage: {
  parts?: Array<{ type: string; data?: { text?: string } | string }>
}): string {
  if (userMessage.parts && userMessage.parts.length > 0) {
    return userMessage.parts
      .filter((p) => p.type === 'text')
      .map((p) => (typeof p.data === 'object' && p.data?.text ? p.data.text : p.data) || '')
      .join('\n')
  }
  return ''
}

export async function runStreamWithPersistence(
  deps: ActionDeps,
  config: StreamRunConfig & { userText: string; userMessageId?: string }
): Promise<boolean> {
  try {
    await AgentChatCoreService.runStreamChat({
      emitter: deps.emitter,
      sessionId: deps.sessionId,
      userText: config.userText,
      userMessageId: config.userMessageId,
      provider: config.provider,
      modelId: config.modelId,
      systemModels: config.systemModels,
      userConfig: config.userConfig,
      attachments: config.attachments,
      skipUserMessageRecording: config.skipUserMessageRecording,
      realSessionRepo: deps.realSessionRepo,
      realSnapshotRepo: deps.realSnapshotRepo,
      toolRegistry: deps.toolRegistry,
      diarySearcher: deps.diarySearcher,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage
    })
    if (deps.sessionManager) {
      try {
        await deps.sessionManager.flushSessionToDisk(deps.sessionId)
      } catch (e: unknown) {
        logger.error('Agent action persist error', e instanceof Error ? e : String(e))
      }
    }
    return true
  } catch (e: unknown) {
    const err = e as { name?: string; message?: string }
    if (err.name === 'AbortError') {
      deps.emitter.sendFinish(deps.sessionId, { success: true })
      return true
    }
    deps.emitter.sendFinish(deps.sessionId, { error: err.message })
    return false
  } finally {
    AgentChatCoreService.resetAbortController()
  }
}
