import { describe, expect, it } from 'vitest'
import { resolveBatchEmbedConcurrency } from '../concurrency.util'

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
