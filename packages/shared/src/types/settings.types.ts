/**
 * 供应商类型枚举
 */
export type ProviderType = 'openai' | 'gemini' | 'anthropic' | 'deepseek' | 'kimi' | 'ollama' | 'siliconflow' | 'openrouter' | 'dashscope' | 'doubao' | 'grok' | 'mistral' | 'lmstudio' | 'custom' | string;

/**
 * AI 供应商配置模型
 * 像素级还原 AiProviderModel
 */
export interface AIProviderConfig {
  id: string;                 // 唯一标识
  name: string;               // 显示名称
  type: ProviderType;         // 供应商类型
  apiKey: string;             // 密钥
  baseUrl: string;            // 基础地址
  models: string[];           // 获取到的可用模型列表
  enabledModels: string[];    // 用户主动开启的模型列表
  defaultDialogueModel: string; // 默认对话模型
  defaultNamingModel: string;   // 默认命名模型
  isEnabled: boolean;         // 是否启用
  isSystem: boolean;          // 是否为系统内置
  sortOrder: number;          // 排序权重
  webSearchMode?: string;     // 网络搜索模式（如：duckduckgo等，可能在原版为某些特定模型特有）
}

/**
 * 全局模型配置 (Global Models Config)
 */
export interface GlobalModelsConfig {
  globalDialogueProviderId: string;
  globalDialogueModelId: string;
  globalNamingProviderId: string;
  globalNamingModelId: string;
  globalSummaryProviderId: string;
  globalSummaryModelId: string;
  globalEmbeddingProviderId: string;
  globalEmbeddingModelId: string;
  monthlySummarySource: 'weeklies' | 'diaries'; // 月度总结数据源：'weeklies' (仅周记) 或 'diaries' (全量日记)
}

/**
 * Agent 行为与陪伴模式配置
 */
export interface AgentBehaviorConfig {
  agentContextWindowSize: number;       // Agent 上下文窗口大小（默认 20）
  companionCompressTokens: number;      // 深度陪伴模式触发压缩的 Token 数（默认 8000）
  companionTruncateTokens: number;      // 深度陪伴模式压缩时截断多少 token 以前的对话（默认 4000）
  agentPersona: string;                 // Agent 角色人设描述
  agentGuidelines: string;              // Agent 行为准则
  pinnedAssistantIds: string[];         // 侧边栏置顶助手列表 (最多 3 个)
}

/**
 * RAG 与记忆库配置
 */
export interface RagConfig {
  ragEnabled: boolean;                  // 是否启用全局记忆（RAG检索，默认 true）
  ragTopK: number;                      // 检索返回的前 K 个最相似结果（默认 20）
  ragSimilarityThreshold: number;       // 相似度阈值过滤（默认 0.4）
}

/**
 * 网络搜索配置 (Web Search Config)
 */
export interface WebSearchConfig {
  webSearchEngine: 'duckduckgo' | 'tavily' | string; // 使用的搜索引擎 (默认 duckduckgo)
  webSearchMaxResults: number;                       // 搜索返回的最大结果数 (1-30，默认 5)
  webSearchRagEnabled: boolean;                      // 是否启用了 Web-RAG (网页压缩读取)
  tavilyApiKey: string;                              // Tavily API 密钥
  webSearchRagMaxChunks: number;                     // 引用片段总数上限 (默认 12)
  webSearchRagChunksPerSource: number;               // 单来源最大片段数 (默认 4)
  webSearchPlainSnippetLength: number;               // 未配置 Embedding 时的纯文本截取上限 (默认 3000)
}

/**
 * 总结模块自定义指令配置
 * key 为总结类型（如 daily, weekly, monthly, annual）
 * value 为针对该类型的 prompt instruction 字符串
 */
export interface SummaryConfig {
  instructions: Record<string, string>;
}

/**
 * 工具管理配置
 */
export interface ToolManagementConfig {
  disabledToolIds: string[];                          // 被禁用的工具 ID 列表
  customConfigs: Record<string, Record<string, any>>; // 各工具的独立 key-value 用户配置
}

/**
 * MCP (Model Context Protocol) Server 配置
 */
export interface McpServerConfig {
  mcpEnabled: boolean; // MCP Server 是否启用（默认关闭）
  mcpPort: number;     // MCP Server 端口（默认 31004）
}

/**
 * 全局热键配置 (Global Hotkey Config)
 */
export interface HotkeyConfig {
  hotkeyEnabled: boolean;   // 是否启用全局呼出（默认 false）
  hotkeyModifier: string;   // 修饰键（如：Alt, CmdOrCtrl, Shift 等）
  hotkeyKey: string;        // 触发键（如：S, Space, F1 等）
}
