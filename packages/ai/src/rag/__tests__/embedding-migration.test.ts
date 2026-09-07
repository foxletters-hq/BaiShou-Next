import { describe, it, expect, vi } from 'vitest'
import { continueMigration, migrateEmbeddings, normalizeBackupChunk } from '../embedding-migration'
import { MigrationControl } from '../migration-control'
import { RAG_MIGRATION_STATUS } from '@baishou/shared'

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

describe('embedding migration ledger rebuild', () => {
  it('rebuilds embed ledger after verifyMigrationComplete on resume', async () => {
    const rebuildEmbedLedger = vi.fn().mockResolvedValue(undefined)
    const deps = {
      isConfigured: true,
      config: {
        getGlobalEmbeddingModelId: () => 'm1',
        getGlobalEmbeddingProviderId: () => 'p1',
        getProviderInstance: async () => ({ getEmbeddingModel: () => 'model' })
      },
      db: {
        hasMigrationBackupTable: async () => true,
        getUnmigratedCount: async () => 0,
        verifyMigrationComplete: async () => [true, true] as [boolean, boolean],
        dropMigrationBackup: async () => undefined,
        dropRollbackSnapshot: async () => undefined,
        rebuildEmbedLedger
      },
      retryEmbed: async (action: () => Promise<void>) => action(),
      lifecycle: {
        markCompleted: vi.fn(),
        markInterrupted: vi.fn(),
        markInProgress: vi.fn(),
        markIdle: vi.fn()
      }
    }
    const control = new MigrationControl()
    const events = []
    for await (const event of continueMigration(deps as any, { current: false }, control)) {
      events.push(event)
    }
    expect(rebuildEmbedLedger).toHaveBeenCalledTimes(1)
    expect(events.at(-1)?.statusKey).toBe(RAG_MIGRATION_STATUS.finished)
  })

  it('rebuilds embed ledger after abortMigration restores the snapshot', async () => {
    const rebuildEmbedLedger = vi.fn().mockResolvedValue(undefined)
    const control = new MigrationControl()
    const deps = {
      isConfigured: true,
      config: {
        getGlobalEmbeddingModelId: () => 'm1',
        getGlobalEmbeddingProviderId: () => 'p1',
        getProviderInstance: async () => ({ getEmbeddingModel: () => 'model' }),
        setGlobalEmbeddingDimension: async () => undefined
      },
      db: {
        createRollbackSnapshot: async () => {
          control.requestAbort()
          return 2
        },
        hasMigrationRollbackTable: async () => true,
        restoreRollbackSnapshot: async () => 2,
        hasMigrationBackupTable: async () => false,
        dropMigrationBackup: async () => undefined,
        dropRollbackSnapshot: async () => undefined,
        rebuildEmbedLedger
      },
      retryEmbed: async (action: () => Promise<void>) => action(),
      lifecycle: {
        markCompleted: vi.fn(),
        markInterrupted: vi.fn(),
        markInProgress: vi.fn(),
        markIdle: vi.fn()
      }
    }
    const events = []
    for await (const event of migrateEmbeddings(deps as any, { current: false }, control)) {
      events.push(event)
    }
    expect(rebuildEmbedLedger).toHaveBeenCalledTimes(1)
    expect(events.some((event) => event.aborted)).toBe(true)
  })
})
