import type {
  AIProviderConfig,
  GlobalModelsConfig,
  AgentBehaviorConfig,
  RagConfig,
  WebSearchConfig,
  SummaryConfig,
  ToolManagementConfig,
  McpServerConfig,
  HotkeyConfig
} from '@baishou/shared';

export const DEFAULT_AI_PROVIDERS: AIProviderConfig[] = [
  { id: 'openai', name: 'OpenAI', type: 'openai' as any, baseUrl: 'https://api.openai.com/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 0, apiKey: '' },
  { id: 'gemini', name: 'Google Gemini', type: 'gemini' as any, baseUrl: 'https://generativelanguage.googleapis.com/v1beta', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 1, apiKey: '' },
  { id: 'anthropic', name: 'Anthropic Claude', type: 'anthropic' as any, baseUrl: 'https://api.anthropic.com', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 2, apiKey: '' },
  { id: 'deepseek', name: 'DeepSeek', type: 'deepseek' as any, baseUrl: 'https://api.deepseek.com', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 3, apiKey: '' },
  { id: 'kimi', name: 'Kimi (Moonshot)', type: 'kimi' as any, baseUrl: 'https://api.moonshot.cn/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 4, apiKey: '' },
  { id: 'ollama', name: 'Ollama', type: 'ollama' as any, baseUrl: 'http://localhost:11434/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 5, apiKey: '' },
  { id: 'siliconflow', name: '硅基流动 (SiliconFlow)', type: 'siliconflow' as any, baseUrl: 'https://api.siliconflow.cn/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 6, apiKey: '' },
  { id: 'openrouter', name: 'OpenRouter', type: 'openrouter' as any, baseUrl: 'https://openrouter.ai/api/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 7, apiKey: '' },
  { id: 'dashscope', name: '通义千问 (百炼)', type: 'dashscope' as any, baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 8, apiKey: '' },
  { id: 'doubao', name: '豆包 (火山引擎)', type: 'doubao' as any, baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 9, apiKey: '' },
  { id: 'grok', name: 'Grok (xAI)', type: 'grok' as any, baseUrl: 'https://api.x.ai/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 10, apiKey: '' },
  { id: 'mistral', name: 'Mistral', type: 'mistral' as any, baseUrl: 'https://api.mistral.ai/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 11, apiKey: '' },
  { id: 'lmstudio', name: 'LM Studio', type: 'lmstudio' as any, baseUrl: 'http://localhost:1234/v1', models: [], enabledModels: [], isEnabled: false, defaultDialogueModel: '', defaultNamingModel: '', isSystem: true, sortOrder: 12, apiKey: '' },
];

export const DEFAULT_GLOBAL_MODELS: GlobalModelsConfig = {
  globalDialogueProviderId: 'gemini',
  globalDialogueModelId: 'off',
  globalNamingProviderId: 'gemini',
  globalNamingModelId: 'off',
  globalSummaryProviderId: 'gemini',
  globalSummaryModelId: 'off',
  globalEmbeddingProviderId: '',
  globalEmbeddingModelId: '',
  monthlySummarySource: 'weeklies'
};

export const DEFAULT_AGENT_BEHAVIOR: AgentBehaviorConfig = {
  agentContextWindowSize: 20,
  companionCompressTokens: 8000,
  companionTruncateTokens: 4000,
  agentPersona: '你是 AI 伙伴，帮助用户回顾日记和生活记录。',
  agentGuidelines: '请使用工具查阅日记内容，不要编造。引用时注明日期。',
  pinnedAssistantIds: []
};

export const DEFAULT_RAG_CONFIG: RagConfig = {
  ragEnabled: true,
  ragTopK: 20,
  ragSimilarityThreshold: 0.4
};

export const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  webSearchEngine: 'duckduckgo',
  webSearchMaxResults: 5,
  webSearchRagEnabled: false,
  tavilyApiKey: '',
  webSearchRagMaxChunks: 12,
  webSearchRagChunksPerSource: 4,
  webSearchPlainSnippetLength: 3000
};

export const DEFAULT_SUMMARY_CONFIG: SummaryConfig = {
  instructions: {}
};

export const DEFAULT_TOOL_MANAGEMENT_CONFIG: ToolManagementConfig = {
  disabledToolIds: [],
  customConfigs: {}
};

export const DEFAULT_MCP_SERVER_CONFIG: McpServerConfig = {
  mcpEnabled: false,
  mcpPort: 31004
};

export const DEFAULT_HOTKEY_CONFIG: HotkeyConfig = {
  hotkeyEnabled: false,
  hotkeyModifier: 'Alt',
  hotkeyKey: 'S'
};
