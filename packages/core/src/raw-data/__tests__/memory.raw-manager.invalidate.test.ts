import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@libsql/client'
import { setEmbedLedgerRebuildListener } from '@baishou/shared'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { MemoryRawManager } from '../managers/memory.raw-manager'
import { SqliteHybridSearchRepository } from '@baishou/database'
import { EMBED_LEDGER_CREATE_SQL, EMBED_LEDGER_INDEXES_SQL } from '@baishou/database'
import type { IStoragePathService } from '../../vault/storage-path.types'

describe('MemoryRawManager.invalidateIndexedHashes', () => {
  let tmpDir: string
  let memoryManager: MemoryRawManager

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'mem-invalidate-'))
    const freshness = new DerivedFreshnessService()
    const pathService = {
      getMemoryBaseDirectory: async () => path.join(tmpDir, 'Memory')
    } as unknown as IStoragePathService
    memoryManager = new MemoryRawManager(pathService, new NodeFileSystem(), freshness)
  })

  afterEach(async () => {
    setEmbedLedgerRebuildListener(null)
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('marks indexed memory shards pending', async () => {
    const now = Date.now()
    const written = await memoryManager.writeRecord({
      id: 'mem-1',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'hello',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    const pending = await memoryManager.listPendingIndex()
    expect(pending).toHaveLength(1)
    await memoryManager.commitIndexed(written.relativePath, pending[0]!.contentHash)
    expect(await memoryManager.listPendingIndex()).toHaveLength(0)

    await memoryManager.invalidateIndexedHashes()
    expect(await memoryManager.listPendingIndex()).toHaveLength(1)
  })

  it('invalidates memory manifest hashes when ledger rebuild runs', async () => {
    const now = Date.now()
    const written = await memoryManager.writeRecord({
      id: 'mem-2',
      schemaVersion: 1,
      vaultName: 'Personal',
      content: 'rebuild',
      tags: [],
      sourceSessionId: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null
    })
    const pending = await memoryManager.listPendingIndex()
    await memoryManager.commitIndexed(written.relativePath, pending[0]!.contentHash)
    expect(await memoryManager.listPendingIndex()).toHaveLength(0)

    const db = createClient({ url: ':memory:' })
    const repo = new SqliteHybridSearchRepository(db)
    await db.execute(`
      CREATE TABLE IF NOT EXISTS memory_embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        embedding_id TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        vault_id TEXT,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        embedding BLOB NOT NULL,
        dimension INTEGER NOT NULL,
        model_id TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        source_created_at INTEGER
      )
    `)
    await db.execute(EMBED_LEDGER_CREATE_SQL)
    for (const ddl of EMBED_LEDGER_INDEXES_SQL) {
      await db.execute(ddl)
    }
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'memory',
      sourceId: 'mem-2',
      contentHash: 'stale',
      chunkCount: 3,
      modelId: 'm1',
      dimension: 2
    })

    const result = await repo.reconcileEmbedLedger({ vaultId: 'vault-a', sourceType: 'memory' })
    expect(result.rebuilt).toBe(true)
    expect(await memoryManager.listPendingIndex()).toHaveLength(1)
    db.close()
  })
})
