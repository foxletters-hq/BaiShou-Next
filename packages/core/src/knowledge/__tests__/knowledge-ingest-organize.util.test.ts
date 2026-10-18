import { describe, expect, it } from 'vitest'
import { resolveNotebookOrganizeStage } from '../knowledge-ingest.rebuild'

describe('resolveNotebookOrganizeStage', () => {
  it('should queue extract when the source has no extracted text', () => {
    expect(resolveNotebookOrganizeStage({ status: 'stored' })).toBe('extract')
    expect(resolveNotebookOrganizeStage({ status: 'failed' })).toBe('extract')
    expect(resolveNotebookOrganizeStage({ status: 'needs_ocr' })).toBe('extract')
  })

  it('should queue embed when extracted text exists but chunks are missing', () => {
    expect(resolveNotebookOrganizeStage({ status: 'ready', extractedTextHash: 'abc' })).toBe(
      'embed'
    )
    expect(resolveNotebookOrganizeStage({ status: 'stored', extractedTextHash: 'abc' })).toBe(
      'embed'
    )
  })

  it('should skip ready sources that already have embeddings so FAB does not re-graph', () => {
    expect(
      resolveNotebookOrganizeStage({
        status: 'ready',
        extractedTextHash: 'abc',
        hasChunkEmbeddings: true
      })
    ).toBeNull()
    expect(
      resolveNotebookOrganizeStage({
        status: 'partial',
        extractedTextHash: 'abc',
        hasChunkEmbeddings: true
      })
    ).toBeNull()
  })

  it('should queue graph when a pending leftover already has embeddings', () => {
    expect(
      resolveNotebookOrganizeStage({
        status: 'pending',
        extractedTextHash: 'abc',
        hasChunkEmbeddings: true
      })
    ).toBe('graph')
  })

  it('should queue graph when stored leftover already has embeddings', () => {
    expect(
      resolveNotebookOrganizeStage({
        status: 'stored',
        extractedTextHash: 'abc',
        hasChunkEmbeddings: true
      })
    ).toBe('graph')
  })

  it('should retry graph when an embedded source still has a failed graph job', () => {
    expect(
      resolveNotebookOrganizeStage({
        status: 'ready',
        extractedTextHash: 'abc',
        hasChunkEmbeddings: true,
        graphJobStatus: 'failed'
      })
    ).toBe('graph')
  })

  it('should skip sources already extracting, embedding, or graphing', () => {
    expect(resolveNotebookOrganizeStage({ status: 'extracting' })).toBeNull()
    expect(
      resolveNotebookOrganizeStage({ status: 'embedding', extractedTextHash: 'abc' })
    ).toBeNull()
    expect(
      resolveNotebookOrganizeStage({
        status: 'ready',
        extractedTextHash: 'abc',
        hasChunkEmbeddings: true,
        graphJobStatus: 'running'
      })
    ).toBeNull()
  })
})
