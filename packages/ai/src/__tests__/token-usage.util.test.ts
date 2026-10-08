import { describe, expect, it } from 'vitest'
import { StreamAccumulator, extractCacheUsage } from '../agent/stream-accumulator'
import {
  mergeStreamUsageFromSdk,
  normalizeTokenUsageForBilling
} from '../agent/token-usage.util'

describe('extractCacheUsage', () => {
  it('reads SDK-style inputTokenDetails', () => {
    const result = extractCacheUsage({
      inputTokens: 12281,
      inputTokenDetails: {
        noCacheTokens: 4,
        cacheReadTokens: 12159,
        cacheWriteTokens: 118
      }
    })
    expect(result).toEqual({ cacheReadInputTokens: 12159, cacheWriteInputTokens: 118 })
  })

  it('falls back to raw provider fields', () => {
    const result = extractCacheUsage({
      inputTokens: 1000,
      raw: {
        cache_read_input_tokens: 800,
        cache_creation_input_tokens: 120
      }
    })
    expect(result).toEqual({ cacheReadInputTokens: 800, cacheWriteInputTokens: 120 })
  })

  it('falls back to providerMetadata anthropic fields', () => {
    const result = extractCacheUsage(
      { inputTokens: 1000 },
      {
        anthropic: {
          cacheReadInputTokens: 700,
          cacheCreationInputTokens: 90
        }
      }
    )
    expect(result).toEqual({ cacheReadInputTokens: 700, cacheWriteInputTokens: 90 })
  })

  it('returns zeros when no cache fields exist', () => {
    expect(extractCacheUsage({ inputTokens: 1000 })).toEqual({
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0
    })
  })
})

describe('mergeStreamUsageFromSdk', () => {
  const accumulatorUsage = {
    inputTokens: 47624,
    outputTokens: 1069,
    cacheReadInputTokens: 44961,
    cacheWriteInputTokens: 617
  }

  it('prefers SDK inputTokenDetails over accumulator values', () => {
    const merged = mergeStreamUsageFromSdk(accumulatorUsage, {
      inputTokens: 47624,
      outputTokens: 1069,
      inputTokenDetails: {
        noCacheTokens: 2663,
        cacheReadTokens: 47007,
        cacheWriteTokens: 617
      }
    })
    expect(merged.cacheReadInputTokens).toBe(47007)
    expect(merged.cacheWriteInputTokens).toBe(617)
  })

  it('falls back to accumulator cache values when SDK omits them', () => {
    const merged = mergeStreamUsageFromSdk(accumulatorUsage, {
      inputTokens: 47624,
      outputTokens: 1069
    })
    expect(merged.cacheReadInputTokens).toBe(44961)
    expect(merged.cacheWriteInputTokens).toBe(617)
  })
})

describe('normalizeTokenUsageForBilling', () => {
  it('splits cache write tokens out of input tokens', () => {
    const usage = normalizeTokenUsageForBilling({
      inputTokens: 12281,
      outputTokens: 888,
      cacheReadInputTokens: 12159,
      cacheWriteInputTokens: 118
    })
    expect(usage.inputTokens).toBe(4)
    expect(usage.cachedInputTokens).toBe(12159)
    expect(usage.cacheWriteInputTokens).toBe(118)
  })

  it('never produces negative non-cached input', () => {
    const usage = normalizeTokenUsageForBilling({
      inputTokens: 100,
      outputTokens: 10,
      cacheReadInputTokens: 90,
      cacheWriteInputTokens: 50
    })
    expect(usage.inputTokens).toBe(0)
  })
})

describe('StreamAccumulator usage', () => {
  it('sums cache write tokens across steps', () => {
    const acc = new StreamAccumulator()
    acc.add({
      type: 'finish-step',
      usage: {
        inputTokens: 1000,
        outputTokens: 100,
        inputTokenDetails: { cacheReadTokens: 800, cacheWriteTokens: 120 }
      }
    } as any)
    acc.add({
      type: 'finish-step',
      usage: {
        inputTokens: 2000,
        outputTokens: 200,
        inputTokenDetails: { cacheReadTokens: 1500, cacheWriteTokens: 300 }
      }
    } as any)
    expect(acc.usage.inputTokens).toBe(3000)
    expect(acc.usage.cacheReadInputTokens).toBe(2300)
    expect(acc.usage.cacheWriteInputTokens).toBe(420)
  })

  it('prefers finish totalUsage over last-step usage', () => {
    const acc = new StreamAccumulator()
    acc.add({
      type: 'finish-step',
      usage: {
        inputTokens: 16849,
        outputTokens: 839,
        inputTokenDetails: { cacheReadTokens: 15081, cacheWriteTokens: 0 }
      }
    } as any)
    acc.add({
      type: 'finish-step',
      usage: {
        inputTokens: 30775,
        outputTokens: 230,
        inputTokenDetails: { cacheReadTokens: 29880, cacheWriteTokens: 0 }
      }
    } as any)
    acc.add({
      type: 'finish',
      usage: {
        inputTokens: 30775,
        outputTokens: 230,
        inputTokenDetails: { cacheReadTokens: 29880, cacheWriteTokens: 0 }
      },
      totalUsage: {
        inputTokens: 47624,
        outputTokens: 1069,
        inputTokenDetails: {
          noCacheTokens: 2663,
          cacheReadTokens: 44961,
          cacheWriteTokens: 617
        }
      }
    } as any)
    expect(acc.usage.inputTokens).toBe(47624)
    expect(acc.usage.outputTokens).toBe(1069)
    expect(acc.usage.cacheReadInputTokens).toBe(44961)
    expect(acc.usage.cacheWriteInputTokens).toBe(617)
  })
})
