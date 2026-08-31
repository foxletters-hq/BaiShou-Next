import { describe, expect, it } from 'vitest'
import { mergeStreamUsageFromSdk, normalizeTokenUsageForBilling } from '../agent/token-usage.util'

const empty = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheWriteInputTokens: 0
}

describe('mergeStreamUsageFromSdk', () => {
  it('reads DeepSeek-style prompt_cache_hit_tokens', () => {
    const usage = mergeStreamUsageFromSdk(empty, {
      promptTokens: 25080,
      completionTokens: 1495,
      prompt_cache_hit_tokens: 13056
    })
    expect(usage.inputTokens).toBe(25080)
    expect(usage.outputTokens).toBe(1495)
    expect(usage.cacheReadInputTokens).toBe(13056)
  })
})

describe('normalizeTokenUsageForBilling', () => {
  it('treats input as inclusive of cache', () => {
    expect(
      normalizeTokenUsageForBilling({
        inputTokens: 25080,
        outputTokens: 1495,
        cacheReadInputTokens: 13056,
        cacheWriteInputTokens: 0
      })
    ).toEqual({
      inputTokens: 12024,
      outputTokens: 1495,
      cachedInputTokens: 13056,
      cacheWriteInputTokens: 0
    })
  })
})
