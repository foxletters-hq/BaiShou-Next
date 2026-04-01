export enum ProviderType {
  OpenAI = 'openai',
  Anthropic = 'anthropic',
  Gemini = 'gemini',
  DeepSeek = 'deepseek',
  Kimi = 'kimi',
  Ollama = 'ollama',
  SiliconFlow = 'siliconflow',
  OpenRouter = 'openrouter',
  DashScope = 'dashscope',
  Doubao = 'doubao',
  Grok = 'grok',
  Mistral = 'mistral',
  LMStudio = 'lmstudio',
  Custom = 'custom',
}

export enum WebSearchMode {
  Off = 'off',
  Tool = 'tool',
}

export interface AiProviderModel {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  models: string[];
  defaultDialogueModel: string;
  defaultNamingModel: string;
  isEnabled: boolean;
  enabledModels: string[];
  notes?: string;
  isSystem: boolean;
  sortOrder: number;
  webSearchMode: WebSearchMode;
}

/**
 * 根据 ProviderType 返回默认的搜索模式
 */
export function getDefaultWebSearchMode(_type: ProviderType): WebSearchMode {
  return WebSearchMode.Tool;
}

/**
 * 创建一个符合要求且带默认字段的 AI 提供商配置
 */
export function createAiProvider(model: Partial<AiProviderModel> & Pick<AiProviderModel, 'id' | 'name' | 'type'>): AiProviderModel {
  return {
    apiKey: '',
    baseUrl: '',
    models: [],
    defaultDialogueModel: '',
    defaultNamingModel: '',
    isEnabled: true,
    enabledModels: [],
    isSystem: true,
    sortOrder: 0,
    webSearchMode: model.webSearchMode ?? getDefaultWebSearchMode(model.type),
    ...model,
  };
}
