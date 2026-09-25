import { describe, expect, it } from 'vitest'
import { resolveNotebookOrganizeStage } from '../knowledge-ingest.rebuild'

describe('resolveNotebookOrganizeStage', () => {
  it('should queue extract when the source has no extracted text', () => {
    expect(resolveNotebookOrganizeStage({ status: 'stored' })).toBe('extract')
    expect(resolveNotebookOrganizeStage({ status: 'failed' })).toBe('extract')
    expect(resolveNotebookOrganizeStage({ status: 'needs_ocr' })).toBe('extract')
  })

  it('should queue embed and keep graph follow when extracted text exists', () => {
    expect(
      resolveNotebookOrganizeStage({ status: 'ready', extractedTextHash: 'abc' })
    ).toBe('embed')
    expect(
      resolveNotebookOrganizeStage({ status: 'stored', extractedTextHash: 'abc' })
    ).toBe('embed')
  })

  it('should skip sources already extracting or embedding', () => {
    expect(resolveNotebookOrganizeStage({ status: 'extracting' })).toBeNull()
    expect(
      resolveNotebookOrganizeStage({ status: 'embedding', extractedTextHash: 'abc' })
    ).toBeNull()
  })
})
