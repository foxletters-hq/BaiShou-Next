import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, Client } from '@libsql/client'
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
})
