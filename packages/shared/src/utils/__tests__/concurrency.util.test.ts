import { describe, expect, it } from 'vitest'
import {
  resolveBatchEmbedConcurrency,
  resolveMobileBatchEmbedConcurrency
} from '../concurrency.util'

describe('resolveBatchEmbedConcurrency', () => {
  it('defaults invalid values to 3', () => {
    expect(resolveBatchEmbedConcurrency(undefined)).toBe(3)
    expect(resolveBatchEmbedConcurrency('')).toBe(3)
    expect(resolveBatchEmbedConcurrency(NaN)).toBe(3)
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
