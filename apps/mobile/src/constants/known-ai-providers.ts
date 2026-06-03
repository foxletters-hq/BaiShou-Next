/** 与桌面 AIModelServicesView 内置供应商目录保持一致 */
export const BASE_KNOWN_PROVIDERS_CONFIG = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultBase: 'https://generativelanguage.googleapis.com/v1beta',
    isSystem: true
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultBase: 'https://api.anthropic.com',
    isSystem: true
  },
  {
    id: 'openai',
    name: 'OpenAI',
    defaultBase: 'https://api.openai.com/v1',
    isSystem: true
  },
  {
    id: 'grok',
    name: 'Grok (xAI)',
    defaultBase: 'https://api.x.ai/v1',
    isSystem: true
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    defaultBase: 'https://api.deepseek.com',
    isSystem: true
  },
  {
    id: 'siliconflow',
    name: '硅基流动 (SiliconFlow)',
    defaultBase: 'https://api.siliconflow.cn/v1',
    isSystem: true
  },
  {
    id: 'kimi',
    name: 'Kimi (Moonshot)',
    defaultBase: 'https://api.moonshot.cn/v1',
    isSystem: true
  },
  {
    id: 'xiaomimimo',
    name: '小米 MiMo',
    defaultBase: 'https://api.xiaomimimo.com/v1',
    isSystem: true
  },
  {
    id: 'minimax',
    name: 'MiniMax',
    defaultBase: 'https://api.minimaxi.com/v1',
    isSystem: true
  },
  {
    id: 'zhipu',
    name: '智谱 AI (ZhiPu)',
    defaultBase: 'https://open.bigmodel.cn/api/paas/v4',
    isSystem: true
  },
  {
    id: 'dashscope',
    name: '通义千问 (百炼)',
    defaultBase: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    isSystem: true
  },
  {
    id: 'doubao',
    name: '豆包 (火山引擎)',
    defaultBase: 'https://ark.cn-beijing.volces.com/api/v3',
    isSystem: true
  },
  {
    id: 'lmstudio',
    name: 'LM Studio',
    defaultBase: 'http://localhost:1234/v1',
    isSystem: true
  },
  {
    id: 'ollama',
    name: 'Ollama',
    defaultBase: 'http://localhost:11434/v1',
    isSystem: true
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultBase: 'https://openrouter.ai/api/v1',
    isSystem: true
  },
  {
    id: 'mistral',
    name: 'Mistral',
    defaultBase: 'https://api.mistral.ai/v1',
    isSystem: true
  },
  {
    id: 'stepfun',
    name: '阶跃星辰 (StepFun)',
    defaultBase: 'https://api.stepfun.com/v1',
    isSystem: true
  },
  {
    id: 'hunyuan',
    name: '腾讯混元 (Hunyuan)',
    defaultBase: 'https://api.hunyuan.cloud.tencent.com/v1',
    isSystem: true
  },
  {
    id: 'vertexai',
    name: 'Google Vertex AI',
    defaultBase: 'https://aiplatform.googleapis.com/v1',
    isSystem: true
  },
  {
    id: 'vercel',
    name: 'Vercel AI Gateway',
    defaultBase: 'https://ai-gateway.vercel.sh/v1/ai',
    isSystem: true
  }
] as const

export const PROVIDER_NAME_I18N_MAP: Record<string, string> = {
  siliconflow: 'aiProviders.siliconflow',
  dashscope: 'aiProviders.dashscope',
  doubao: 'aiProviders.doubao',
  zhipu: 'aiProviders.zhipu',
  stepfun: 'aiProviders.stepfun',
  hunyuan: 'aiProviders.hunyuan',
  minimax: 'aiProviders.minimax',
  vertexai: 'aiProviders.vertexai',
  vercel: 'aiProviders.vercel',
  xiaomimimo: 'aiProviders.xiaomimimo'
}

export const PROVIDER_TYPES = [
  'openai',
  'anthropic',
  'gemini',
  'deepseek',
  'kimi',
  'ollama',
  'siliconflow',
  'openrouter',
  'dashscope',
  'doubao',
  'grok',
  'mistral',
  'lmstudio',
  'zhipu',
  'stepfun',
  'hunyuan',
  'minimax',
  'vertexai',
  'vercel',
  'xiaomimimo'
] as const

export type KnownProviderMeta = (typeof BASE_KNOWN_PROVIDERS_CONFIG)[number]
