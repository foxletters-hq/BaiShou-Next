// ProviderType enum 从 ai-provider.types.ts 统一导出，此处不再重复定义
import { ProviderType } from './ai-provider.types'
export { ProviderType }
import type { TtsSettings } from './tts.types'
export type { TtsSettings }

/**
 * AI 供应商配置模型
 * 像素级还原 AiProviderModel
 */
export interface AIProviderConfig {
  id: string // 唯一标识
  name: string // 显示名称
  type: ProviderType // 供应商类型
  apiKey: string // 密钥
  baseUrl: string // 基础地址
  models: string[] // 获取到的可用模型列表
  enabledModels: string[] // 用户主动开启的模型列表
  defaultDialogueModel: string // 默认对话模型
  defaultNamingModel: string // 默认命名模型
  isEnabled: boolean // 是否启用
  isSystem: boolean // 是否为系统内置
  sortOrder: number // 排序权重
  webSearchMode?: string // 网络搜索模式（如：duckduckgo等，可能在原版为某些特定模型特有）
}

/** TTS 供应商配置（与 ai_providers 分离，按供应商 id 独立存储） */
export interface TtsProviderConnectionConfig {
  baseUrl?: string
  apiKey?: string
  /** 上次从服务端拉取的模型列表 */
  availableModels?: string[]
  modelId?: string
  voice?: string
  speed?: number
  responseFormat?: string
  refAudioPath?: string
  refAudioBase64?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  stream?: boolean
}

export interface GlobalModelsConfig {
  globalDialogueProviderId: string
  globalDialogueModelId: string
  globalNamingProviderId: string
  globalNamingModelId: string
  globalSummaryProviderId: string
  globalSummaryModelId: string
  globalEmbeddingProviderId: string
  globalEmbeddingModelId: string
  globalEmbeddingDimension?: number
  globalTtsProviderId: string
  globalTtsModelId: string
  globalTtsSettings?: TtsSettings
  /** 各 TTS 供应商的 baseUrl / apiKey，key 为 openai-tts、mimo-tts 等 */
  globalTtsProviderConfigs?: Record<string, TtsProviderConnectionConfig>
  monthlySummarySource: 'weeklies' | 'diaries' // 月报：'weeklies' 仅本月周记；'diaries' 本月周记 + 本月日记
}

/**
 * Agent 行为与陪伴模式配置
 */
export interface AgentBehaviorConfig {
  agentContextWindowSize: number // Agent 上下文窗口大小（默认 20）
  companionCompressTokens?: number // 深度陪伴模式触发压缩的 Token 数（默认 8000）
  companionTruncateTokens?: number // 深度陪伴模式压缩时截断多少 token 以前的对话（默认 4000）
  agentPersona: string // Agent 角色人设描述
  agentGuidelines: string // Agent 行为准则
  pinnedAssistantIds: string[] // 侧边栏置顶助手列表 (最多 3 个)
}

/**
 * RAG 与记忆库配置
 */
export interface RagConfig {
  ragEnabled: boolean // 是否启用全局记忆（RAG检索，默认 true）
  ragTopK: number // 检索返回的前 K 个最相似结果（默认 20）
  ragSimilarityThreshold: number // 相似度阈值过滤（默认 0.4）
  /** 批量嵌入日记时的并行篇数（1–20，默认 20） */
  batchEmbedConcurrency?: number
  /** 最近一次日记自动嵌入失败的时间戳（毫秒），用于 RAG 页非阻塞提示 */
  lastDiaryEmbedFailureAt?: number
  /** 最近一次日记自动嵌入失败的原因（用户可读） */
  lastDiaryEmbedFailureMessage?: string
}

/**
 * 网络搜索配置 (Web Search Config)
 */
export interface WebSearchConfig {
  webSearchEngine: 'duckduckgo' | 'tavily' | 'local-bing' | 'local-google' | string // 使用的搜索引擎
  webSearchMaxResults: number // 搜索返回的最大结果数 (1-30，默认 5)
  webSearchRagEnabled: boolean // 是否启用了 Web-RAG (网页压缩读取)
  tavilyApiKey: string // Tavily API 密钥
  exaApiKey: string // Exa API 密钥
  anysearchApiKey: string // AnySearch API 密钥
  webSearchRagMaxChunks: number // 引用片段总数上限 (默认 12)
  webSearchRagChunksPerSource: number // 单来源最大片段数 (默认 4)
  webSearchPlainSnippetLength: number // 未配置 Embedding 时的纯文本截取上限 (默认 3000)
}

import type { SummaryPromptLocale, SummaryTemplatesMap } from './summary-prompt.types'

/** 回忆总结的生成模式：提示词模板 / 指定伙伴 */
export type SummaryGenerationMode = 'prompt' | 'assistant'

/**
 * 总结模块自定义指令配置
 * - instructionsByLocale: 按界面语言分别保存周/月/季/年模板
 * - instructions: 旧版扁平结构（等价于 instructionsByLocale.zh）
 */
export interface SummaryConfig {
  /** 生成总结时使用的提示词语言 */
  promptLocale?: SummaryPromptLocale
  /** 共同回忆复制时的回溯月数（回忆页 / 唤醒回忆共用） */
  sharedMemoryLookbackMonths?: number
  /** 复制共同回忆时附加在全文最前方的自定义前缀 */
  sharedMemoryCopyPrefix?: string
  /**
   * 生成模式：提示词模板（默认）或指定伙伴（用伙伴模型 + systemPrompt）
   */
  generationMode?: SummaryGenerationMode
  /** 伙伴模式下选用的助手 ID；缺失或已删时回退提示词模式 */
  generationAssistantId?: string
  /** 生成总结前是否将共同回忆注入 prompt（与「唤醒回忆」对话注入无关） */
  injectSharedMemoryBeforeGenerate?: boolean
  /**
   * 自定义提示词模式下的「生成回忆助手」system prompt（按语言）
   * 空或缺省时使用内置默认；复用伙伴模式忽略此字段
   */
  customGenerationSystemPromptByLocale?: Partial<Record<SummaryPromptLocale, string>>
  instructionsByLocale?: Partial<Record<SummaryPromptLocale, SummaryTemplatesMap>>
  instructions?: SummaryTemplatesMap
}

/**
 * 日记正文模板配置（新建 / 追加时的初始 Markdown）
 */
export interface DiaryTemplateConfig {
  /** 新建日记时的初始正文，支持 {time} {date} {datetime} */
  newEntryTemplate?: string
  /** 追加记录时插入的时间块，支持 {time} {date} {datetime} */
  appendBlockTemplate?: string
  /**
   * 伙伴写日记时的可选补充说明（风格/内容要求，不含时间标题格式）。
   * 时间标题格式由 newEntryTemplate / appendBlockTemplate 统一决定。
   */
  writingStyleSupplement?: string
  /** @deprecated 旧字段；读取时会迁移到 writingStyleSupplement，新写入请用 writingStyleSupplement */
  aiWritingPrompt?: string
}

/**
 * 工具管理配置
 */
export interface ToolManagementConfig {
  disabledToolIds: string[] // 被禁用的工具 ID 列表
  customConfigs: Record<string, Record<string, any>> // 各工具的独立 key-value 用户配置
  emojiConfig?: EmojiToolConfig // 表情包工具配置
}

/**
 * 表情包工具配置
 */
export interface EmojiToolConfig {
  enabled: boolean // 是否启用表情包回复
  /** 表情包组列表（读取后应经 normalizeEmojiToolConfig 归一化） */
  groups?: EmojiGroup[]
  /** @deprecated 旧版扁平列表，读取时自动迁移到默认组 */
  emojis?: EmojiItem[]
}

export interface EmojiGroup {
  id: string
  name: string
  emojis: EmojiItem[]
}

export interface EmojiItem {
  id: string // 唯一标识，格式: emoji_{timestamp}
  name: string // 表情包名称/标签
  relativePath: string // 相对路径，格式: emojis/emoji_{timestamp}.{ext}
}

/**
 * MCP (Model Context Protocol) Server 配置
 */
export interface McpServerConfig {
  mcpEnabled: boolean // MCP Server 是否启用（默认关闭）
  mcpPort: number // MCP Server 端口（默认 31004）
  /** 可选访问令牌；启用 MCP 时若为空会自动生成，外部客户端需在 Authorization 头携带 */
  mcpAuthToken?: string
}

/**
 * 全局热键配置 (Global Hotkey Config)
 */
export interface HotkeyConfig {
  hotkeyEnabled: boolean // 是否启用全局呼出（默认 false）
  hotkeyModifier: string // 修饰键（如：Alt, CmdOrCtrl, Shift 等）
  hotkeyKey: string // 触发键（如：S, Space, F1 等）
}

export interface DevicePreferences {
  nickname?: string
  identity_facts?: string[]
  theme_mode?: number
  seed_color?: number
  ai_providers_list?: any[]
  global_dialogue_provider_id?: string
  global_dialogue_model_id?: string
  global_naming_provider_id?: string
  global_naming_model_id?: string
  global_summary_provider_id?: string
  global_summary_model_id?: string
  global_embedding_provider_id?: string
  global_embedding_model_id?: string
  global_embedding_dimension?: number
  ai_provider?: string
  ai_model?: string
  ai_naming_model?: string
  api_key?: string
  base_url?: string
  monthly_summary_source?: string
  agent_context_window_size?: number
  companion_compress_tokens?: number
  companion_truncate_tokens?: number
  agent_persona?: string
  agent_guidelines?: string
  summary_prompt_instructions?: string
  all_summary_instructions?: any
  all_tool_configs?: any
  disabled_tool_ids?: string[]
  rag_global_enabled?: boolean
  rag_top_k?: number
  rag_similarity_threshold?: number
  web_search_engine?: string
  web_search_max_results?: number
  web_search_rag_enabled?: boolean
  tavily_api_key?: string
  exa_api_key?: string
  web_search_rag_max_chunks?: number
  web_search_rag_chunks_per_source?: number
  web_search_plain_snippet_length?: number
  sync_target?: number
  webdav_url?: string
  webdav_username?: string
  webdav_password?: string
  webdav_path?: string
  s3_endpoint?: string
  s3_access_key?: string
  s3_secret_key?: string
  s3_bucket?: string
  s3_region?: string
  s3_path?: string
  mcp_server_enabled?: boolean
  mcp_server_port?: number
}
