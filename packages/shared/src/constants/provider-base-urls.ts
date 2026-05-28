/**
 * Default OpenAI-compatible base URLs for built-in providers (id === type for system providers).
 */
export const PROVIDER_DEFAULT_BASE_URLS: Record<string, string> = {
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
  anthropic: 'https://api.anthropic.com',
  openai: 'https://api.openai.com/v1',
  grok: 'https://api.x.ai/v1',
  deepseek: 'https://api.deepseek.com',
  siliconflow: 'https://api.siliconflow.cn/v1',
  kimi: 'https://api.moonshot.cn/v1',
  xiaomimimo: 'https://api.xiaomimimo.com/v1',
  minimax: 'https://api.minimaxi.com/v1',
  zhipu: 'https://open.bigmodel.cn/api/paas/v4',
  dashscope: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  doubao: 'https://ark.cn-beijing.volces.com/api/v3',
  lmstudio: 'http://localhost:1234/v1',
  ollama: 'http://localhost:11434/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  mistral: 'https://api.mistral.ai/v1',
  stepfun: 'https://api.stepfun.com/v1',
  hunyuan: 'https://api.hunyuan.cloud.tencent.com/v1',
  vertexai: 'https://aiplatform.googleapis.com/v1',
  vercel: 'https://ai-gateway.vercel.sh/v1/ai',
  custom: 'https://api.openai.com/v1'
}

export function resolveProviderBaseUrl(
  providerId: string,
  providerType?: string,
  baseUrl?: string | null
): string {
  const trimmed = (baseUrl ?? '').trim()
  if (trimmed) {
    return trimmed
  }

  const typeKey = (providerType || '').trim().toLowerCase()
  if (typeKey && PROVIDER_DEFAULT_BASE_URLS[typeKey]) {
    return PROVIDER_DEFAULT_BASE_URLS[typeKey]
  }

  const idKey = providerId.trim().toLowerCase()
  return PROVIDER_DEFAULT_BASE_URLS[idKey] ?? ''
}
