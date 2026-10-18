import { extractCacheUsage, type StreamTokenUsage } from '../agent/stream-accumulator'
import type { TokenUsage } from '../pricing/model-pricing.service'

/** 将 API 返回的 usage 拆分为计费用的非缓存 / 缓存读 / 缓存写 token */
export function normalizeTokenUsageForBilling(usage: StreamTokenUsage): TokenUsage {
  const cacheRead = usage.cacheReadInputTokens
  const cacheWrite = usage.cacheWriteInputTokens
  const nonCachedInput = Math.max(0, usage.inputTokens - cacheRead - cacheWrite)

  return {
    inputTokens: nonCachedInput,
    outputTokens: usage.outputTokens,
    cachedInputTokens: cacheRead,
    cacheWriteInputTokens: cacheWrite
  }
}

export function mergeStreamUsageFromSdk(
  accumulatorUsage: StreamTokenUsage,
  sdkUsage: Record<string, unknown> | null | undefined,
  metadata?: Record<string, unknown>
): StreamTokenUsage {
  if (!sdkUsage) return accumulatorUsage

  const inputTokens =
    Number(sdkUsage.inputTokens ?? sdkUsage.promptTokens ?? 0) || accumulatorUsage.inputTokens
  const outputTokens =
    Number(sdkUsage.outputTokens ?? sdkUsage.completionTokens ?? 0) || accumulatorUsage.outputTokens

  // SDK 与累加器口径一致（均为整轮总计）；SDK 缺失时回退到累加器
  const sdkCache = extractCacheUsage(sdkUsage, metadata)

  return {
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    cacheReadInputTokens: sdkCache.cacheReadInputTokens || accumulatorUsage.cacheReadInputTokens,
    cacheWriteInputTokens: sdkCache.cacheWriteInputTokens || accumulatorUsage.cacheWriteInputTokens
  }
}
