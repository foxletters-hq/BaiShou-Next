import { isAgentStreamAbortError, logger, normalizePartData } from '@baishou/shared'
import { AgentChatCoreService } from '../agent-chat-core.service'
import type { IStreamEmitter } from '../stream-emitter.interface'
import type { AttachmentInput } from '../agent-session.types'

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
  /**
   * 截断删库后清理会话本地附件（参数为删库前取出的 parts）
   */
  cleanupAttachments?: (
    sessionId: string,
    parts: ReadonlyArray<{ type?: string; data?: unknown }>
  ) => Promise<void>
}

export interface StreamRunConfig {
  provider: unknown
  modelId: string
  systemModels: unknown
  userConfig: unknown
  attachments?: unknown[]
  skipUserMessageRecording?: boolean
  forceRecompress?: boolean
}

export function extractTextFromUserMessage(userMessage: {
  parts?: Array<{ type: string; data?: { text?: string; content?: string } | string }>
}): string {
  if (userMessage.parts && userMessage.parts.length > 0) {
    return userMessage.parts
      .filter((p) => p.type === 'text')
      .map((p) => {
        if (typeof p.data === 'object' && p.data) {
          if (typeof p.data.text === 'string') return p.data.text
          if (typeof p.data.content === 'string') return p.data.content
        }
        return typeof p.data === 'string' ? p.data : ''
      })
      .join('\n')
  }
  return ''
}

export function extractAttachmentsFromParts(
  parts?: Array<{ type?: string; data?: unknown }>
): AttachmentInput[] | undefined {
  if (!parts?.length) return undefined

  const attachments: AttachmentInput[] = []
  for (const part of parts) {
    const partType = String(part.type ?? '').toLowerCase()
    if (partType !== 'attachment' && partType !== 'image') continue

    const att = normalizePartData(part.data)
    const fileName = String(att.name || att.fileName || 'Attachment')
    const isImage = partType === 'image' || att.type === 'image' || att.isImage === true
    attachments.push({
      type: isImage ? 'image' : 'file',
      url: typeof att.url === 'string' ? att.url : undefined,
      data: typeof att.data === 'string' ? att.data : undefined,
      mimeType: typeof att.mimeType === 'string' ? att.mimeType : undefined,
      name: fileName,
      filePath: typeof att.filePath === 'string' ? att.filePath : undefined,
      isImage,
      isPdf: att.isPdf === true,
      isText: att.isText === true,
      textContent: typeof att.textContent === 'string' ? att.textContent : undefined
    })
  }

  return attachments.length > 0 ? attachments : undefined
}

export function extractUserMessagePayload(userMessage: {
  parts?: Array<{ type?: string; data?: unknown }>
}): { userText: string; attachments?: AttachmentInput[] } {
  return {
    userText: extractTextFromUserMessage(
      userMessage as Parameters<typeof extractTextFromUserMessage>[0]
    ),
    attachments: extractAttachmentsFromParts(userMessage.parts)
  }
}

export function hasUserMessagePayload(payload: {
  userText: string
  attachments?: AttachmentInput[]
}): boolean {
  return Boolean(payload.userText.trim()) || Boolean(payload.attachments?.length)
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
      forceRecompress: config.forceRecompress,
      realSessionRepo: deps.realSessionRepo,
      realSnapshotRepo: deps.realSnapshotRepo,
      toolRegistry: deps.toolRegistry,
      diarySearcher: deps.diarySearcher,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      flushSessionToDisk: deps.sessionManager
        ? (sessionId) => deps.sessionManager!.flushSessionToDisk(sessionId)
        : undefined
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
    if (isAgentStreamAbortError(e)) {
      deps.emitter.sendFinish(deps.sessionId, { success: true })
      return true
    }
    const err = e as { message?: string }
    deps.emitter.sendFinish(deps.sessionId, { error: err.message })
    return false
  } finally {
    AgentChatCoreService.resetAbortController()
  }
}
