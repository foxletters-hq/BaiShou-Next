/** 缓存策略：默认 auto 开启；none 关闭自动断点（手动 CacheHint 预留） */
export type PromptCachePolicy = 'auto' | 'none'

export interface PromptCachingContext {
  providerType: string
  providerId?: string
  modelId?: string
  sessionId?: string
  baseUrl?: string
  cachePolicy?: PromptCachePolicy
}

export interface CachingStrategyResult {
  /** 在 system / tools / messages 上注入 cache_control 等显式断点 */
  inlineMarkers: boolean
  /** 请求级 promptCacheKey（OpenAI 及兼容端点的隐式前缀缓存） */
  promptCacheKey: boolean
}
