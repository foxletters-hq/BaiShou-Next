import { describe, expect, it } from 'vitest'
import {
  cacheHitPercent,
  clampRingPercent,
  exclusiveInputTokens,
  formatContextTokenCount,
  lastRoundUsagePercent,
  pickLastRoundUsage,
  sumLastRoundTokens
} from '../last-round-context-usage.util'

describe('pickLastRoundUsage', () => {
  it('returns null when no assistant message reports usage', () => {
    expect(pickLastRoundUsage([])).toBeNull()
    expect(
      pickLastRoundUsage([
        { role: 'user', inputTokens: 12 },
        { role: 'assistant', inputTokens: 0, outputTokens: 0 }
      ])
    ).toBeNull()
  })

  it('uses the latest assistant message that reported tokens', () => {
    const usage = pickLastRoundUsage([
      {
        role: 'assistant',
        inputTokens: 100,
        outputTokens: 20,
        cacheReadInputTokens: 10,
        cacheWriteInputTokens: 5
      },
      { role: 'user', inputTokens: 8 },
      {
        role: 'assistant',
        inputTokens: 200,
        outputTokens: 40,
        cacheReadInputTokens: 15,
        cacheWriteInputTokens: 0
      }
    ])
    expect(usage).toEqual({
      inputTokens: 185,
      outputTokens: 40,
      cacheReadInputTokens: 15,
      cacheWriteInputTokens: 0
    })
    expect(sumLastRoundTokens(usage!)).toBe(240)
  })

  it('skips a later assistant that reported zero tokens', () => {
    const usage = pickLastRoundUsage([
      { role: 'assistant', inputTokens: 80, outputTokens: 20 },
      { role: 'assistant', inputTokens: 0, outputTokens: 0 }
    ])
    expect(usage).toEqual({
      inputTokens: 80,
      outputTokens: 20,
      cacheReadInputTokens: 0,
      cacheWriteInputTokens: 0
    })
  })
})

describe('exclusiveInputTokens', () => {
  it('subtracts cache from inclusive prompt tokens', () => {
    expect(exclusiveInputTokens(25_080, 13_056)).toBe(12_024)
    expect(exclusiveInputTokens(13_056, 13_056)).toBe(0)
  })
})

describe('cacheHitPercent', () => {
  it('uses uncached input plus cache as the prompt denominator', () => {
    expect(
      cacheHitPercent({
        inputTokens: 12_024,
        outputTokens: 1_495,
        cacheReadInputTokens: 13_056,
        cacheWriteInputTokens: 0
      })
    ).toBe(52)
  })
})

describe('lastRoundUsagePercent', () => {
  it('returns null when the window is unknown', () => {
    expect(lastRoundUsagePercent(1200, 0)).toBeNull()
  })

  it('rounds the last-round share of the window', () => {
    expect(lastRoundUsagePercent(0, 128_000)).toBe(0)
    expect(lastRoundUsagePercent(64_000, 128_000)).toBe(50)
    expect(lastRoundUsagePercent(147_900, 256_000)).toBe(58)
  })
})

describe('formatContextTokenCount', () => {
  it('formats compact token counts', () => {
    expect(formatContextTokenCount(120)).toBe('120')
    expect(formatContextTokenCount(147_900)).toBe('147.9K')
    expect(formatContextTokenCount(256_000)).toBe('256K')
    expect(formatContextTokenCount(1_000_000)).toBe('1M')
  })
})

describe('clampRingPercent', () => {
  it('keeps the ring between 0 and 100', () => {
    expect(clampRingPercent(null)).toBe(0)
    expect(clampRingPercent(0)).toBe(0)
    expect(clampRingPercent(58)).toBe(58)
    expect(clampRingPercent(140)).toBe(100)
  })
})
