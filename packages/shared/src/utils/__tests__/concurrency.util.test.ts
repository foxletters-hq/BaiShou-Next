import { describe, expect, it } from 'vitest'
import {
  clampOcrConcurrency,
  DEFAULT_OCR_CONCURRENCY,
  limitExecute,
  listOcrConcurrencyValues,
  RECOMMENDED_OCR_CONCURRENCY,
  resolveBatchEmbedConcurrency,
  resolveMobileBatchEmbedConcurrency
} from '../concurrency.util'

describe('clampOcrConcurrency', () => {
  it('clamps to 1–10 and lists selectable values', () => {
    expect(RECOMMENDED_OCR_CONCURRENCY).toBe(3)
    expect(DEFAULT_OCR_CONCURRENCY).toBe(3)
    expect(clampOcrConcurrency(undefined)).toBe(3)
    expect(clampOcrConcurrency(0)).toBe(1)
    expect(clampOcrConcurrency(9)).toBe(9)
    expect(clampOcrConcurrency(11)).toBe(10)
    expect(listOcrConcurrencyValues()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
  })
})

describe('resolveBatchEmbedConcurrency', () => {
  it('defaults invalid values to 20', () => {
    expect(resolveBatchEmbedConcurrency(undefined)).toBe(20)
    expect(resolveBatchEmbedConcurrency('')).toBe(20)
    expect(resolveBatchEmbedConcurrency(NaN)).toBe(20)
  })

  it('clamps to 1–20', () => {
    expect(resolveBatchEmbedConcurrency(0)).toBe(1)
    expect(resolveBatchEmbedConcurrency(99)).toBe(20)
    expect(resolveBatchEmbedConcurrency(12)).toBe(12)
  })
})

describe('resolveMobileBatchEmbedConcurrency', () => {
  it('defaults unset values to 5', () => {
    expect(resolveMobileBatchEmbedConcurrency(undefined)).toBe(5)
    expect(resolveMobileBatchEmbedConcurrency(null)).toBe(5)
  })

  it('caps configured values at 10', () => {
    expect(resolveMobileBatchEmbedConcurrency(20)).toBe(10)
    expect(resolveMobileBatchEmbedConcurrency(8)).toBe(8)
    expect(resolveMobileBatchEmbedConcurrency(0)).toBe(1)
  })
})

describe('limitExecute shouldStop', () => {
  it('does not start remaining items after shouldStop becomes true', async () => {
    const seen: number[] = []
    await limitExecute(
      [1, 2, 3, 4],
      1,
      async (item) => {
        seen.push(item)
      },
      { shouldStop: () => seen.length >= 2 }
    )
    expect(seen).toEqual([1, 2])
  })
})
