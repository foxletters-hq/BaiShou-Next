import { describe, expect, it } from 'vitest'
import {
  isTextLayerHint,
  pickSourceCardEvidence,
  sourceCardFailureReason,
  sourceMissingPageCount
} from '../source-card-evidence.util'

describe('source card evidence', () => {
  it('should count missing text-layer pages', () => {
    expect(sourceMissingPageCount({ pageCount: 1033, textPageCount: 1032 })).toBe(1)
    expect(sourceMissingPageCount({ pageCount: 10, textPageCount: 10 })).toBeNull()
    expect(sourceMissingPageCount({ pageCount: null, textPageCount: 1 })).toBeNull()
  })

  it('should treat backend extract notes as the same text-layer hint', () => {
    expect(isTextLayerHint('1033 页中有 1 页没有文本层')).toBe(true)
    expect(isTextLayerHint('页数未知，禁止标 ready')).toBe(false)
  })

  it('should keep a single scan line when error repeats the same hint', () => {
    expect(
      pickSourceCardEvidence({
        pageCount: 1033,
        missingPages: 1
      })
    ).toEqual({ type: 'scan', pageCount: 1033, missingPages: 1 })
  })

  it('should keep errors off the card face and only expose them for failed sources', () => {
    expect(
      pickSourceCardEvidence({
        pageCount: 3,
        missingPages: null
      })
    ).toBeNull()
    expect(
      sourceCardFailureReason({
        status: 'failed',
        errorMessage: 'embedding-not-configured'
      })
    ).toBe('embedding-not-configured')
    expect(
      sourceCardFailureReason({
        status: 'ready',
        errorMessage: 'embedding-not-configured'
      })
    ).toBeNull()
    expect(sourceCardFailureReason({ status: 'failed', errorMessage: '  ' })).toBeNull()
  })

  it('should hide hints while OCR is running', () => {
    expect(
      pickSourceCardEvidence({
        pageCount: 10,
        missingPages: 2,
        hideHints: true
      })
    ).toBeNull()
  })
})
