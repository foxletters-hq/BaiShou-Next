import { IAIProvider } from '../providers/provider.interface'
import { ToolRegistry } from '../tools/tool-registry'
import { SessionRepository } from '@baishou/database'
// @ts-ignore
import { SnapshotRepository } from '@baishou/database'

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
    namingModelConfigured?: boolean
    summaryProvider?: IAIProvider
    summaryModelId?: string
    embeddingProvider?: IAIProvider
    embeddingModelId?: string
  }
  diarySearcher?: import('../tools/agent.tool').ToolDiarySearcher
  webSearchResultFetcher?: (url: string) => Promise<string>
  fetchSearchPage?: (url: string) => Promise<string>
  abortSignal?: AbortSignal
  /** 会话流 claim 代数；被新流取代时跳过落盘，避免快速重试产生重复 assistant 消息 */
  streamClaimGeneration?: number
  userMessageId?: string // 明确指定回复针对的用户消息 ID
  skipUserMessageRecording?: boolean // 用户消息已提前落库时，跳过重复记录
  forceRecompress?: boolean // 编辑/重发截断后允许重新判定压缩（截断已清除 marker/无效快照）
}

export interface StreamChatCallbacks {
  onTextDelta?: (text: string) => void
  onReasoningDelta?: (text: string) => void
  onToolCallStart?: (toolName: string, args: unknown) => void
  onToolCallResult?: (toolName: string, result: unknown) => void
  onError?: (error: Error) => void
  onFinish?: (result?: {
    messageId?: string
    inputTokens?: number
    outputTokens?: number
    cacheReadInputTokens?: number
    cacheWriteInputTokens?: number
    costMicros?: number
  }) => void
}
