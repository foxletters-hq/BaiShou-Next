import { describe, it, expect } from 'vitest'
import { normalizeBackupChunk } from '../embedding-migration'

describe('normalizeBackupChunk', () => {
  it('reads camelCase fields returned by storage queries', () => {
    const chunk = normalizeBackupChunk({
      embedding_id: 'legacy-chunk-1',
      sourceType: 'diary',
      sourceId: 'd1',
      groupId: 'g1',
      chunkIndex: 0,
      chunkText: '我昨天吃了一顿麦当劳。',
      metadataJson: '{}',
      sourceCreatedAt: 123
    })

    expect(chunk.embeddingId).toBe('legacy-chunk-1')
    expect(chunk.chunkText).toBe('我昨天吃了一顿麦当劳。')
    expect(chunk.sourceType).toBe('diary')
    expect(chunk.chunkIndex).toBe(0)
  })

  it('falls back to snake_case fields when present', () => {
    const chunk = normalizeBackupChunk({
      embedding_id: 'legacy-chunk-2',
      source_type: 'diary',
      source_id: 'd2',
      group_id: 'g1',
      chunk_index: 1,
      chunk_text: '但是可乐不好喝。',
      metadata_json: '{"k":1}',
      source_created_at: 456
    })

    expect(chunk.embeddingId).toBe('legacy-chunk-2')
    expect(chunk.chunkText).toBe('但是可乐不好喝。')
    expect(chunk.metadataJson).toBe('{"k":1}')
    expect(chunk.sourceCreatedAt).toBe(456)
  })

  it('throws when chunk text is missing', () => {
    expect(() =>
      normalizeBackupChunk({
        embeddingId: 'missing-text',
        chunkText: '   '
      })
    ).toThrow(/missing id or text/i)
  })
})

describe('embedding migration chunk field regression', () => {
  it('would have sent empty input when only chunkText alias exists', () => {
    const row = {
      embedding_id: 'abc',
      chunkText: 'valid diary content'
    }

    const legacyAccess = (row as any).chunk_text
    expect(legacyAccess).toBeUndefined()

    const normalized = normalizeBackupChunk(row)
    expect(normalized.chunkText).toBe('valid diary content')
  })
})
