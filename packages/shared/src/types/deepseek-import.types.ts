import type { AssistantKind } from '../constants/assistant-kind.constants'

export type DeepSeekArchiveFormat = 'v3' | 'legacy'

export interface DeepSeekSessionPreview {
  sourceId: string
  title: string
  pinned: boolean
  messageCount: number
  insertedAt: string
  updatedAt: string
  hasThinking: boolean
  hasSearch: boolean
  imageCount: number
  /** v3 格式对应解压后的会话 JSON 相对路径 */
  sessionFilePath?: string
}

export interface DeepSeekArchiveScanResult {
  format: DeepSeekArchiveFormat
  exportFormatVersion: number | null
  payloadDir: string
  sessions: DeepSeekSessionPreview[]
  totalMessages: number
  earliestAt: string | null
  latestAt: string | null
  warnings: string[]
}

export type DeepSeekTargetAssistantInput =
  | {
      mode: 'existing'
      assistantId: string
      assistantName?: string
    }
  | {
      mode: 'new'
      name: string
      description?: string
      systemPrompt?: string
      providerId?: string | null
      modelId?: string | null
      avatarPath?: string | null
      assistantKind?: AssistantKind
      contextWindow?: number
      compressTokenThreshold?: number
      compressKeepTurns?: number
      compressSystemPrompt?: string | null
    }

export interface DeepSeekImportProgress {
  phase: 'preparing' | 'creating_assistant' | 'importing' | 'finishing'
  current: number
  total: number
  sessionTitle?: string
}

export interface DeepSeekImportResult {
  assistantId: string
  assistantName: string
  createdNewAssistant: boolean
  importedSessions: number
  importedMessages: number
  importedAttachments: number
  skippedSessions: number
  failedSessions: number
  failureSamples: string[]
  importedSessionIds: string[]
  firstImportedSessionId: string | null
}
