import { describe, expect, it } from 'vitest'
import { resolveBatchEmbedConcurrency } from '../concurrency.util'

describe('resolveBatchEmbedConcurrency', () => {
  it('defaults invalid values to 3', () => {
    expect(resolveBatchEmbedConcurrency(undefined)).toBe(3)
    expect(resolveBatchEmbedConcurrency('')).toBe(3)
    expect(resolveBatchEmbedConcurrency(NaN)).toBe(3)
  })

  it('clamps to 1–5', () => {
    expect(resolveBatchEmbedConcurrency(0)).toBe(1)
    expect(resolveBatchEmbedConcurrency(99)).toBe(5)
    expect(resolveBatchEmbedConcurrency(4)).toBe(4)
  })
})
