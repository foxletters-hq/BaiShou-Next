import { describe, expect, it } from 'vitest'
import {
  looksLikeUnitIntervalConfidence,
  normalizeGraphEdgeReviewFields,
  normalizeGraphExtractConfidence,
  remapGraphViewReviewForDisplay
} from '../graph-extract-confidence.util'

describe('normalizeGraphExtractConfidence', () => {
  it('keeps 0-100 scores', () => {
    expect(normalizeGraphExtractConfidence(86, 80)).toBe(86)
    expect(normalizeGraphExtractConfidence('75', 80)).toBe(75)
  })

  it('scales 0-1 scores to 0-100', () => {
    expect(normalizeGraphExtractConfidence(0.86, 80)).toBe(86)
    expect(normalizeGraphExtractConfidence(1, 80)).toBe(100)
    expect(normalizeGraphExtractConfidence('0.7', 80)).toBe(70)
  })

  it('falls back when missing', () => {
    expect(normalizeGraphExtractConfidence(undefined, 80)).toBe(80)
    expect(normalizeGraphExtractConfidence('x', 75)).toBe(75)
  })
})

describe('looksLikeUnitIntervalConfidence', () => {
  it('treats 0 and 1 as unit-interval leftovers', () => {
    expect(looksLikeUnitIntervalConfidence(1)).toBe(true)
    expect(looksLikeUnitIntervalConfidence(0.8)).toBe(true)
    expect(looksLikeUnitIntervalConfidence(65)).toBe(false)
  })
})

describe('normalizeGraphEdgeReviewFields', () => {
  it('repairs pending leftovers stored as 0-1', () => {
    expect(normalizeGraphEdgeReviewFields({ confidence: 1, reviewStatus: 'pending' })).toEqual({
      confidence: 100,
      reviewStatus: 'approved'
    })
    expect(normalizeGraphEdgeReviewFields({ confidence: 0.86, reviewStatus: 'pending' })).toEqual({
      confidence: 86,
      reviewStatus: 'approved'
    })
  })

  it('keeps real low 0-100 pending', () => {
    expect(normalizeGraphEdgeReviewFields({ confidence: 42, reviewStatus: 'pending' })).toEqual({
      confidence: 42,
      reviewStatus: 'pending'
    })
  })

  it('does not revive rejected', () => {
    expect(normalizeGraphEdgeReviewFields({ confidence: 1, reviewStatus: 'rejected' }).reviewStatus).toBe(
      'rejected'
    )
  })
})

describe('remapGraphViewReviewForDisplay', () => {
  it('approves nodes when all pending edges look like 0-1 leftovers', () => {
    const remapped = remapGraphViewReviewForDisplay(
      [{ id: 'n1', reviewStatus: 'pending' }],
      [{ id: 'e1', reviewStatus: 'pending', confidence: 1 }]
    )
    expect(remapped.nodes[0]?.reviewStatus).toBe('approved')
    expect(remapped.edges[0]?.reviewStatus).toBe('approved')
    expect(remapped.edges[0]?.confidence).toBe(100)
  })
})
