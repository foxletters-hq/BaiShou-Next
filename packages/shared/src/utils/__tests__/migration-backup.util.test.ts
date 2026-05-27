import { describe, it, expect } from 'vitest'
import { mapMigrationBackupRow, assertMigrationBackupRow } from '../migration-backup.util'

describe('mapMigrationBackupRow', () => {
  it('maps drizzle camelCase aliases', () => {
    const row = mapMigrationBackupRow({
      embedding_id: 'id-1',
      sourceType: 'diary',
      sourceId: 'd1',
      groupId: 'g1',
      chunkIndex: 0,
      chunkText: 'hello world',
      metadataJson: '{}',
      sourceCreatedAt: 100
    })

    expect(row.embeddingId).toBe('id-1')
    expect(row.chunkText).toBe('hello world')
  })

  it('maps snake_case rows', () => {
    const row = mapMigrationBackupRow({
      embedding_id: 'id-2',
      source_type: 'manual',
      source_id: 'm1',
      group_id: 'manual',
      chunk_index: 2,
      chunk_text: 'backup text',
      metadata_json: '{"k":1}',
      source_created_at: 200
    })

    expect(row.embeddingId).toBe('id-2')
    expect(row.chunkText).toBe('backup text')
    expect(row.metadataJson).toBe('{"k":1}')
    expect(row.sourceCreatedAt).toBe(200)
  })

  it('rejects empty chunk text', () => {
    expect(() =>
      assertMigrationBackupRow(
        mapMigrationBackupRow({
          embedding_id: 'id-3',
          chunk_text: '   '
        })
      )
    ).toThrow(/missing id or text/i)
  })
})
