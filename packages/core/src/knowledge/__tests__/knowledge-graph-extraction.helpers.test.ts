import { describe, expect, it } from 'vitest'
import {
  preferNotebookReviewStatus,
  reviewStatusForAmbiguousEndpoint,
  shouldSupersedeNotebookAiEdges
} from '../knowledge-graph-extraction.helpers'

describe('shouldSupersedeNotebookAiEdges', () => {
  it('should keep old AI edges when the extract kept none', () => {
    expect(shouldSupersedeNotebookAiEdges(new Set())).toBe(false)
  })

  it('should retire old AI edges when at least one new edge is kept', () => {
    expect(shouldSupersedeNotebookAiEdges(new Set(['e1']))).toBe(true)
  })
})

describe('preferNotebookReviewStatus', () => {
  it('should keep approved when the existing row is already approved', () => {
    expect(preferNotebookReviewStatus('approved', 'pending')).toBe('approved')
  })

  it('should keep rejected when the existing row was rejected', () => {
    expect(preferNotebookReviewStatus('rejected', 'approved')).toBe('rejected')
  })
})

describe('reviewStatusForAmbiguousEndpoint', () => {
  it('should force pending when an endpoint is ambiguous', () => {
    expect(reviewStatusForAmbiguousEndpoint('approved', true)).toBe('pending')
  })

  it('should keep rejected when an ambiguous endpoint was already rejected', () => {
    expect(reviewStatusForAmbiguousEndpoint('rejected', true)).toBe('rejected')
  })
})
