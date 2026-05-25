import { IAIProvider } from '../providers/provider.interface'
import { ToolRegistry } from '../tools/tool-registry'
import { SessionRepository } from '@baishou/database'
// @ts-ignore
import { SnapshotRepository } from '@baishou/database/src/repositories/snapshot.repository'

export interface AttachmentInput {
  type: 'image' | 'file'
  url?: string
  data?: string // base64
  mimeType?: string
  name?: string
  isText?: boolean
  textContent?: string
  isImage?: boolean
  isPdf?: boolean
  filePath?: string
}

export interface StreamChatOptions {
  sessionId: string
  userText: string
  provider: IAIProvider
  modelId: string
  toolRegistry: ToolRegistry
  sessionRepo: SessionRepository
  snapshotRepo: SnapshotRepository
  systemPrompt?: string
  userConfig?: Record<string, unknown>
  attachments?: AttachmentInput[]
  contextSnapshots?: { title?: string; content: string }[]
  systemModels?: {
    namingProvider?: IAIProvider
    namingModelId?: string
    summaryProvider?: IAIProvider
    summaryModelId?: string
    embeddingProvider?: IAIProvider
    embeddingModelId?: string
  }
  diarySearcher?: import('../tools/agent.tool').ToolDiarySearcher
  webSearchResultFetcher?: (url: string) => Promise<string>
  fetchSearchPage?: (url: string) => Promise<string>
  abortSignal?: AbortSignal
  userMessageId?: string // 明确指定回复针对的用户消息 ID
  skipUserMessageRecording?: boolean // 如果是编辑/重发消息，跳过用户消息记录
}

export interface StreamChatCallbacks {
  onTextDelta?: (text: string) => void
  onReasoningDelta?: (text: string) => void
  onToolCallStart?: (toolName: string, args: unknown) => void
  onToolCallResult?: (toolName: string, result: unknown) => void
  onError?: (error: Error) => void
  onFinish?: (result?: { inputTokens?: number; outputTokens?: number; costMicros?: number }) => void
}
