import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createClient, Client } from '@libsql/client'
import { setEmbedLedgerRebuildListener } from '@baishou/shared'
import { SqliteHybridSearchRepository } from '../repositories/hybrid-search.repository'
import { EMBED_LEDGER_CREATE_SQL, EMBED_LEDGER_INDEXES_SQL } from '../agent-schema-compat'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

describe('embed_ledger write path', () => {
  let db: Client
  let repo: SqliteHybridSearchRepository
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-embed-ledger-'))
    db = createClient({ url: `file:${path.join(tempDir, 'ledger.db')}` })
    repo = new SqliteHybridSearchRepository(db)

    await db.execute(`
      CREATE TABLE IF NOT EXISTS memory_embeddings (
        id              INTEGER PRIMARY KEY AUTOINCREMENT,
        embedding_id    TEXT NOT NULL UNIQUE,
        source_type     TEXT NOT NULL,
        source_id       TEXT NOT NULL,
        group_id        TEXT NOT NULL,
        vault_id        TEXT,
        chunk_index     INTEGER NOT NULL,
        chunk_text      TEXT NOT NULL,
        metadata_json   TEXT NOT NULL DEFAULT '{}',
        embedding       BLOB NOT NULL,
        dimension       INTEGER NOT NULL,
        model_id        TEXT NOT NULL,
        created_at      INTEGER NOT NULL,
        source_created_at INTEGER
      )
    `)
    await db.execute(EMBED_LEDGER_CREATE_SQL)
    for (const ddl of EMBED_LEDGER_INDEXES_SQL) {
      await db.execute(ddl)
    }
  })

  afterEach(async () => {
    setEmbedLedgerRebuildListener(null)
    db.close()
    try {
      await fs.rm(tempDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  async function readLedger() {
    const res = await db.execute(`SELECT * FROM embed_ledger ORDER BY id`)
    return res.rows as Array<Record<string, unknown>>
  }

  it('recordEmbedded upserts the same source into a single row', async () => {
    const params = {
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#12',
      contentHash: 'abc',
      chunkCount: 2,
      modelId: 'm1',
      dimension: 8
    }

    await repo.recordEmbedded(params)
    await repo.recordEmbedded({ ...params, contentHash: 'def', modelId: 'm2' })

    const rows = await readLedger()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      vault_id: 'vault-a',
      source_type: 'diary',
      source_id: 'vault-a#12',
      content_hash: 'def',
      chunk_count: 2,
      model_id: 'm2',
      status: 'embedded',
      attempts: 0
    })
    expect(rows[0]!.last_error).toBeNull()
  })

  it('recordEmbedded overwrites chunk_count instead of accumulating', async () => {
    const base = {
      vaultId: 'vault-a',
      sourceType: 'memory',
      sourceId: 'mem-1',
      contentHash: 'h1',
      modelId: 'm1',
      dimension: 4
    }

    await repo.recordEmbedded({ ...base, chunkCount: 5 })
    await repo.recordEmbedded({ ...base, chunkCount: 3, contentHash: 'h2' })

    const rows = await readLedger()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0]!.chunk_count)).toBe(3)
    expect(rows[0]!.content_hash).toBe('h2')
  })

  it('recordEmbedFailure marks failed, increments attempts, and keeps chunk_count', async () => {
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#9',
      contentHash: 'ok',
      chunkCount: 5,
      modelId: 'm1',
      dimension: 8
    })

    await repo.recordEmbedFailure({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#9',
      lastError: 'timeout'
    })
    await repo.recordEmbedFailure({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#9',
      lastError: 'rate limited'
    })

    const rows = await readLedger()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      status: 'failed',
      last_error: 'rate limited'
    })
    expect(Number(rows[0]!.attempts)).toBe(2)
    expect(Number(rows[0]!.chunk_count)).toBe(5)
  })

  it('deleteEmbeddingsBySource removes vector rows and the ledger row together', async () => {
    await repo.insertEmbedding({
      id: 'emb-1',
      sourceType: 'diary',
      sourceId: 'vault-a#3',
      groupId: 'diary',
      vaultId: 'vault-a',
      chunkIndex: 0,
      chunkText: 'hello',
      embedding: [1, 0, 0],
      modelId: 'm1'
    })
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#3',
      contentHash: 'h',
      chunkCount: 1,
      modelId: 'm1',
      dimension: 3
    })

    await repo.deleteEmbeddingsBySource('diary', 'vault-a#3')

    const vectors = await db.execute(
      `SELECT count(*) as c FROM memory_embeddings WHERE source_type = 'diary' AND source_id = 'vault-a#3'`
    )
    const ledger = await readLedger()
    expect(Number((vectors.rows[0] as { c?: unknown })?.c ?? 0)).toBe(0)
    expect(ledger).toHaveLength(0)
  })

  it('insertEmbedding does not write a ledger row by itself', async () => {
    await repo.insertEmbedding({
      id: 'emb-2',
      sourceType: 'memory',
      sourceId: 'mem-2',
      groupId: 'memory',
      vaultId: 'vault-a',
      chunkIndex: 0,
      chunkText: 'note',
      embedding: [0, 1, 0],
      modelId: 'm1'
    })

    expect(await readLedger()).toHaveLength(0)
  })

  it('reconcileEmbedLedger rebuilds when SUM(chunk_count) != COUNT(*)', async () => {
    await repo.insertEmbedding({
      id: 'emb-3',
      sourceType: 'diary',
      sourceId: 'vault-a#7',
      groupId: 'diary',
      vaultId: 'vault-a',
      chunkIndex: 0,
      chunkText: 'body',
      metadataJson: JSON.stringify({ content_hash: 'hash-7', updated_at: 99 }),
      embedding: [1, 0],
      modelId: 'm1'
    })
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#7',
      contentHash: 'stale',
      chunkCount: 5,
      modelId: 'old',
      dimension: 2
    })

    await db.execute(`DELETE FROM memory_embeddings`)

    const onRebuilt = vi.fn().mockResolvedValue(undefined)
    const result = await repo.reconcileEmbedLedger({
      vaultId: 'vault-a',
      sourceType: 'diary',
      onRebuilt
    })

    expect(result.rebuilt).toBe(true)
    expect(result.ledgerChunkSum).toBe(5)
    expect(result.vectorCount).toBe(0)
    expect(onRebuilt).toHaveBeenCalledTimes(1)
    expect(await readLedger()).toHaveLength(0)
  })

  it('rebuilds ledger from metadata_json hashes and merges legacy plus scoped source ids', async () => {
    await repo.insertEmbedding({
      id: 'emb-legacy',
      sourceType: 'diary',
      sourceId: '9',
      groupId: 'diary',
      vaultId: 'vault-a',
      chunkIndex: 0,
      chunkText: 'legacy',
      metadataJson: JSON.stringify({ content_hash: 'from-meta', updated_at: 11 }),
      embedding: [1, 0],
      modelId: 'm2'
    })
    await repo.insertEmbedding({
      id: 'emb-scoped',
      sourceType: 'diary',
      sourceId: 'vault-a#9',
      groupId: 'diary',
      vaultId: 'vault-a',
      chunkIndex: 0,
      chunkText: 'scoped',
      metadataJson: JSON.stringify({ content_hash: 'from-meta', updated_at: 22 }),
      embedding: [0, 1],
      modelId: 'm2'
    })
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#9',
      contentHash: '',
      chunkCount: 1,
      modelId: 'old',
      dimension: 2
    })

    const result = await repo.reconcileEmbedLedger({ vaultId: 'vault-a', sourceType: 'diary' })
    expect(result.rebuilt).toBe(true)

    const rows = await readLedger()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      vault_id: 'vault-a',
      source_type: 'diary',
      source_id: 'vault-a#9',
      content_hash: 'from-meta',
      status: 'embedded'
    })
    expect(Number(rows[0]!.chunk_count)).toBe(2)
    expect(rows[0]!.content_hash).not.toBe('')
  })

  it('keeps explicit zero-chunk ledger rows after rebuild', async () => {
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#empty',
      contentHash: 'empty-hash',
      chunkCount: 0,
      modelId: 'm1',
      dimension: 0
    })
    await repo.insertEmbedding({
      id: 'emb-keep',
      sourceType: 'diary',
      sourceId: 'vault-a#10',
      groupId: 'diary',
      vaultId: 'vault-a',
      chunkIndex: 0,
      chunkText: 'keep',
      metadataJson: JSON.stringify({ content_hash: 'keep-hash' }),
      embedding: [1, 0],
      modelId: 'm1'
    })
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#10',
      contentHash: 'wrong',
      chunkCount: 9,
      modelId: 'm1',
      dimension: 2
    })

    await repo.rebuildEmbedLedger({ vaultId: 'vault-a', sourceType: 'diary' })
    const rows = await readLedger()
    const empty = rows.find((row) => row.source_id === 'vault-a#empty')
    const kept = rows.find((row) => row.source_id === 'vault-a#10')
    expect(empty).toMatchObject({ chunk_count: 0, content_hash: 'empty-hash', status: 'embedded' })
    expect(kept).toMatchObject({ chunk_count: 1, content_hash: 'keep-hash' })
  })

  it('clearEmbeddings drops ledger rows together with the vectors', async () => {
    await repo.insertEmbedding({
      id: 'emb-clear',
      sourceType: 'diary',
      sourceId: 'vault-a#20',
      groupId: 'diary',
      vaultId: 'vault-a',
      chunkIndex: 0,
      chunkText: 'clear me',
      embedding: [1, 0],
      modelId: 'm1'
    })
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#20',
      contentHash: 'h20',
      chunkCount: 1,
      modelId: 'm1',
      dimension: 2
    })
    expect(await readLedger()).toHaveLength(1)

    await repo.clearEmbeddings()

    expect(await readLedger()).toHaveLength(0)
    const reconciled = await repo.reconcileEmbedLedger({ vaultId: 'vault-a' })
    expect(reconciled.rebuilt).toBe(false)
  })

  it('rebuild leaves the ledger untouched when an insert fails midway', async () => {
    for (const suffix of ['30', '31', '32']) {
      await repo.insertEmbedding({
        id: `emb-${suffix}`,
        sourceType: 'diary',
        sourceId: `vault-a#${suffix}`,
        groupId: 'diary',
        vaultId: 'vault-a',
        chunkIndex: 0,
        chunkText: `text ${suffix}`,
        metadataJson: JSON.stringify({ content_hash: `h${suffix}` }),
        embedding: [1, 0],
        modelId: 'm1'
      })
    }
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceType: 'diary',
      sourceId: 'vault-a#stale',
      contentHash: 'stale',
      chunkCount: 4,
      modelId: 'm1',
      dimension: 2
    })
    const before = await readLedger()
    expect(before).toHaveLength(1)

    const realExecute = db.execute.bind(db)
    let inserts = 0
    const spy = vi.spyOn(db, 'execute').mockImplementation((async (query: unknown) => {
      const text = typeof query === 'string' ? query : String((query as { sql: string }).sql)
      if (text.includes('INSERT INTO embed_ledger')) {
        inserts += 1
        if (inserts === 2) throw new Error('boom')
      }
      return realExecute(query as never)
    }) as never)

    await expect(
      repo.rebuildEmbedLedger({ vaultId: 'vault-a', sourceType: 'diary' })
    ).rejects.toThrow('boom')
    spy.mockRestore()

    expect(await readLedger()).toEqual(before)
  })
})
