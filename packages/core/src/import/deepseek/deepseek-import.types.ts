import type { AssistantKind } from '@baishou/shared'
import type { IFileSystem } from '../../fs/file-system.types'

export type DeepSeekArchiveFormat = 'v3' | 'legacy'

export interface DeepSeekManifest {
  export_format_version?: number
}

export interface DeepSeekSessionIndexItem {
  id: string
  title?: string | null
  pinned?: boolean
  message_count?: number
  inserted_at?: string | null
  updated_at?: string | null
}

export interface DeepSeekSearchResultItem {
  url?: string
  title?: string
  snippet?: string
  published_at?: string | null
  site_name?: string | null
  site_icon?: string | null
}

export interface DeepSeekImageSearchResultItem {
  title?: string
  source_page_url?: string
  snippet?: string
  site_name?: string | null
  published_at?: string | null
}

export interface DeepSeekReadLinkResultItem {
  signature?: string
  url?: string
  title?: string | null
}

export interface DeepSeekExportFileMeta {
  id: string
  file_name: string
  file_size?: number
  token_usage?: number | null
  inserted_at?: string | null
  export_path?: string | null
  is_image?: boolean
  width?: number | null
  height?: number | null
}

export type DeepSeekFragment =
  | { type: 'REQUEST'; content?: string }
  | { type: 'RESPONSE'; content?: string }
  | { type: 'TEMPLATE_RESPONSE'; content?: string }
  | { type: 'THINK'; content?: string; elapsed_secs?: number | null }
  | {
      type: 'TOOL_SEARCH'
      queries?: string[]
      results?: DeepSeekSearchResultItem[]
      status?: string
    }
  | {
      type: 'TOOL_OPEN'
      status?: string
      url?: string | null
      title?: string | null
      snippet?: string | null
      site_name?: string | null
      published_at?: string | null
    }
  | {
      type: 'TOOL_FIND'
      status?: string
      pattern?: string | null
    }
  | {
      type: 'READ_LINK'
      results?: DeepSeekReadLinkResultItem[]
    }
  | {
      type: 'TOOL_IMAGE_SEARCH'
      status?: string
      image_indexes?: number[]
      results?: DeepSeekImageSearchResultItem[]
    }
  | {
      type: 'FILE'
      files?: DeepSeekExportFileMeta[]
    }
  | {
      type: 'CONTENT_RISK' | 'TIP'
      content?: string
      style?: string
    }
  | {
      type: 'PARTIAL_FILE_READ'
      ratio?: number
    }
  | {
      type: string
      [key: string]: unknown
    }

export interface DeepSeekRawMessage {
  id: number
  parent_id: number | null
  role: 'USER' | 'ASSISTANT' | string
  status?: string
  thinking_enabled?: boolean
  search_enabled?: boolean
  accumulated_token_usage?: number
  inserted_at?: string | null
  fragments?: DeepSeekFragment[]
}

export interface DeepSeekSessionFile {
  id: string
  title?: string | null
  pinned?: boolean
  current_message_id?: number | null
  inserted_at?: string | null
  updated_at?: string | null
  messages?: DeepSeekRawMessage[]
}

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

export interface DeepSeekImportSessionAggregate {
  session: {
    id: string
    title: string | null
    vaultId: string
    vaultName: string
    assistantId: string
    isPinned: boolean
    systemPrompt?: string
    providerId: string
    modelId: string
    totalInputTokens: number
    totalOutputTokens: number
    totalCacheReadInputTokens: number
    totalCacheWriteInputTokens: number
    totalCostMicros: number
    createdAt: Date
    updatedAt: Date
  }
  messages: Array<{
    id: string
    sessionId: string
    role: 'user' | 'assistant'
    isSummary: boolean
    orderIndex: number
    providerId?: string
    modelId?: string
    createdAt: Date
    parts: Array<{
      id: string
      messageId: string
      sessionId: string
      type: 'text' | 'tool' | 'attachment'
      data: Record<string, unknown>
      createdAt: Date
    }>
  }>
}

export interface DeepSeekImportDeps {
  fileSystem: IFileSystem
  sessionRepo: {
    upsertAggregate: (aggregate: DeepSeekImportSessionAggregate) => Promise<void>
    getSessionById?: (sessionId: string) => Promise<{ id: string } | null>
    findAllSessions?: (
      limit?: number,
      offset?: number,
      assistantId?: string,
      searchQuery?: string,
      vaultId?: string | string[]
    ) => Promise<Array<{ id: string }>>
  }
  sessionManager: {
    flushSessionToDisk: (sessionId: string, vaultName?: string | null) => Promise<void>
  }
  assistantManager: {
    create: (input: {
      id: string
      vaultId?: string
      name: string
      description?: string
      systemPrompt?: string
      isDefault?: boolean
      isPinned?: boolean
      providerId?: string | null
      modelId?: string | null
      avatarPath?: string
      contextWindow?: number
      compressTokenThreshold?: number
      compressKeepTurns?: number
      compressSystemPrompt?: string | null
      assistantKind?: AssistantKind
    }) => Promise<void>
    findById?: (id: string) => Promise<{ id: string; name: string } | null | undefined>
  }
}

export interface DeepSeekImportOptions {
  scanResult: DeepSeekArchiveScanResult
  selectedSessionIds?: ReadonlyArray<string>
  target: DeepSeekTargetAssistantInput
  vaultId: string
  vaultName: string
  /** 若提供，则将 DeepSeek 导出的聊天图片复制到 `<attachmentsBaseDir>/<sessionId>/` */
  attachmentsBaseDir?: string | null
  onProgress?: (progress: DeepSeekImportProgress) => void
}
