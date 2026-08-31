import type { StreamTokenUsage } from '../agent/stream-accumulator'
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

  const inputTokenDetails = sdkUsage.inputTokenDetails as Record<string, unknown> | undefined
  const inputTokensDetails = sdkUsage.inputTokensDetails as Record<string, unknown> | undefined
  const promptTokensDetails = sdkUsage.promptTokensDetails as Record<string, unknown> | undefined
  const cacheRead = Number(
    sdkUsage.cacheReadInputTokens ??
      sdkUsage.cachedInputTokens ??
      sdkUsage.prompt_cache_hit_tokens ??
      sdkUsage.promptCacheHitTokens ??
      inputTokenDetails?.cacheReadTokens ??
      inputTokensDetails?.cachedTokens ??
      promptTokensDetails?.cachedTokens ??
      promptTokensDetails?.cached_tokens ??
      (metadata?.anthropic as Record<string, unknown> | undefined)?.cacheReadInputTokens ??
      (metadata?.anthropic as Record<string, unknown> | undefined)?.cache_read_input_tokens ??
      accumulatorUsage.cacheReadInputTokens
  )

  const cacheWrite = Number(
    sdkUsage.cacheWriteInputTokens ??
      sdkUsage.cacheCreationInputTokens ??
      (metadata?.anthropic as Record<string, unknown> | undefined)?.cacheCreationInputTokens ??
      (metadata?.anthropic as Record<string, unknown> | undefined)?.cache_creation_input_tokens ??
      accumulatorUsage.cacheWriteInputTokens
  )

  return {
    inputTokens: inputTokens,
    outputTokens: outputTokens,
    cacheReadInputTokens: Number.isFinite(cacheRead) ? Math.max(0, cacheRead) : 0,
    cacheWriteInputTokens: Number.isFinite(cacheWrite) ? Math.max(0, cacheWrite) : 0
  }
}
