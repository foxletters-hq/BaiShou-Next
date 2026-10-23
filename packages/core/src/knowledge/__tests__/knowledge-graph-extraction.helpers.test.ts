import { describe, expect, it } from 'vitest'
import {
  isKnowledgeGraphExtractWindowSkipError,
  preferNotebookReviewStatus,
  reviewStatusForAmbiguousEndpoint,
  shouldSupersedeNotebookAiEdges
} from '../knowledge-graph-extraction.helpers'

describe('isKnowledgeGraphExtractWindowSkipError', () => {
  it('should skip a timed-out window and keep payment errors fatal', () => {
    expect(isKnowledgeGraphExtractWindowSkipError(new Error('graph-extract-window-timeout'))).toBe(
      true
    )
    expect(
      isKnowledgeGraphExtractWindowSkipError(
        new Error('AI generation timeout: timed out after 120 seconds without further output.')
      )
    ).toBe(true)
    expect(
      isKnowledgeGraphExtractWindowSkipError(
        new Error('AI generation timeout: timed out after 120 seconds waiting for first output.')
      )
    ).toBe(true)
    const abort = new DOMException('The operation was aborted', 'AbortError')
    expect(isKnowledgeGraphExtractWindowSkipError(abort)).toBe(true)
    expect(isKnowledgeGraphExtractWindowSkipError(new Error('Payment Required'))).toBe(false)
  })
})

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
