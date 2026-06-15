import type { LanguageModelV3Middleware } from '@ai-sdk/provider'
import {
  ANTHROPIC_BREAKPOINT_CAP,
  applyInlineCacheMarkersToMessages,
  applyInlineCacheMarkersToSystem,
  applyInlineCacheMarkersToTools,
  buildPromptCacheProviderOptions,
  mergeProviderOptions,
  normalizePromptCacheKey,
  resolveCachingStrategy
} from './prompt-caching.util'
import type { PromptCachingContext } from './prompt-caching.types'

/**
 * 提示词缓存中间件 — 默认开启，在每次 stream/generate 前注入厂商缓存断点。
 *
 * - Anthropic / Claude：cache_control 断点（system、tools、最新 user）
 * - OpenAI 兼容：promptCacheKey = sessionId（隐式前缀缓存）
 * - Gemini：依赖厂商隐式前缀缓存，不注入无效标记
 */
export function createPromptCachingMiddleware(
  ctx: PromptCachingContext
): LanguageModelV3Middleware {
  return {
    specificationVersion: 'v3' as const,
    transformParams: async ({ params }) => {
      const strategy = resolveCachingStrategy(ctx)
      if (!strategy.inlineMarkers && !strategy.promptCacheKey) {
        return params
      }

      let next: Record<string, unknown> = { ...params }
      const breakpointBudget = { remaining: ANTHROPIC_BREAKPOINT_CAP }

      if (strategy.inlineMarkers) {
        if (Array.isArray(next.prompt)) {
          next.prompt = applyInlineCacheMarkersToMessages(
            next.prompt as Parameters<typeof applyInlineCacheMarkersToMessages>[0],
            ctx,
            breakpointBudget
          )
        }

        if (next.system !== undefined) {
          next.system = applyInlineCacheMarkersToSystem(next.system, ctx)
          breakpointBudget.remaining = Math.max(0, breakpointBudget.remaining - 1)
        }

        if (next.tools !== undefined) {
          next.tools = applyInlineCacheMarkersToTools(next.tools, ctx, breakpointBudget)
        }
      }

      if (strategy.promptCacheKey && ctx.sessionId) {
        const cacheKey = normalizePromptCacheKey(ctx.sessionId)
        const cacheOpts = buildPromptCacheProviderOptions(ctx, cacheKey)
        const existing = next.providerOptions as Record<string, unknown> | undefined
        let merged = existing ?? {}
        for (const [namespace, opts] of Object.entries(cacheOpts)) {
          merged = mergeProviderOptions(merged, { [namespace]: opts })
        }
        next.providerOptions = merged
      }

      return next as typeof params
    }
  }
}
