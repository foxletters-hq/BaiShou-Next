/**
 * 仓库隔离 V1.0–V1.3：多仓库检索 / 会话列表 / 删除清理 / 回填幂等。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { SqliteHybridSearchRepository } from '../repositories/hybrid-search.repository'
import {
  backfillMemoryEmbeddingsVaultName,
  countEmptyVaultEmbeddingsByBucket
} from '../memory-embeddings-vault-backfill'
import { purgeVaultDerivedData } from '../vault-derived-data.purge'
import { createSqlExecutor } from '../sql-executor.factory'

async function createSchema(db: Client) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      vault_name TEXT NOT NULL,
      assistant_id TEXT,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      provider_id TEXT NOT NULL DEFAULT 'x',
      model_id TEXT NOT NULL DEFAULT 'y',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS memory_embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      embedding_id TEXT NOT NULL UNIQUE,
      source_type TEXT NOT NULL,
      source_id TEXT NOT NULL,
      group_id TEXT NOT NULL,
      vault_name TEXT,
      chunk_index INTEGER NOT NULL DEFAULT 0,
      chunk_text TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      embedding BLOB NOT NULL,
      dimension INTEGER NOT NULL,
      model_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      source_created_at INTEGER
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS graph_nodes (
      id TEXT PRIMARY KEY NOT NULL,
      vault_name TEXT NOT NULL,
      node_type TEXT NOT NULL,
      name TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      summary TEXT NOT NULL DEFAULT '',
      props_json TEXT NOT NULL DEFAULT '{}',
      mention_count INTEGER NOT NULL DEFAULT 0,
      origin TEXT NOT NULL DEFAULT 'ai',
      shard_month TEXT NOT NULL DEFAULT '',
      review_status TEXT NOT NULL DEFAULT 'approved',
      model_id TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS graph_edges (
      id TEXT PRIMARY KEY NOT NULL,
      vault_name TEXT NOT NULL,
      from_id TEXT NOT NULL,
      to_id TEXT NOT NULL,
      edge_type TEXT NOT NULL,
      props_json TEXT NOT NULL DEFAULT '{}',
      is_current INTEGER NOT NULL DEFAULT 1,
      source_kind TEXT NOT NULL DEFAULT 'diary',
      source_excerpt TEXT NOT NULL DEFAULT '',
      confidence INTEGER NOT NULL DEFAULT 100,
      origin TEXT NOT NULL DEFAULT 'ai',
      review_status TEXT NOT NULL DEFAULT 'approved',
      shard_month TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      deleted_at INTEGER
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS diary_embed_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_name TEXT NOT NULL,
      diary_id INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)
}

function vec(n: number): number[] {
  return [n, 0, 0]
}

describe('vault isolation V1 (multi-vault)', () => {
  let db: Client
  let repo: SqliteHybridSearchRepository
  let tempDir: string
  let exec: ReturnType<typeof createSqlExecutor>

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-vault-iso-'))
    const dbPath = path.join(tempDir, 'test.db')
    db = createClient({ url: `file:${dbPath}` })
    await createSchema(db)
    repo = new SqliteHybridSearchRepository(db)
    exec = createSqlExecutor(db)
  })

  afterEach(async () => {
    db.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('1) search in vault A never returns vault B rows', async () => {
    await repo.insertEmbedding({
      id: 'a1',
      sourceType: 'memory',
      sourceId: 'mA',
      groupId: 'memory:A',
      vaultName: 'A',
      chunkIndex: 0,
      chunkText: 'alpha secret in A',
      embedding: vec(1),
      modelId: 'm'
    })
    await repo.insertEmbedding({
      id: 'b1',
      sourceType: 'memory',
      sourceId: 'mB',
      groupId: 'memory:B',
      vaultName: 'B',
      chunkIndex: 0,
      chunkText: 'beta secret in B',
      embedding: vec(0.99),
      modelId: 'm'
    })

    const hits = await repo.queryNativeVector(vec(1), 10, { vaultName: 'A' })
    expect(hits.every((h) => h.chunkText.includes('A') || h.messageId === 'a1')).toBe(true)
    expect(hits.some((h) => h.messageId === 'b1')).toBe(false)

    const fts = await repo.queryFTS('secret', 10, { vaultName: 'A' })
    expect(fts.some((h) => h.messageId === 'b1')).toBe(false)
    expect(fts.some((h) => h.messageId === 'a1')).toBe(true)
  })

  it('2) empty vault_name rows are never returned (fail-closed)', async () => {
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES (?, 'memory', 'x', 'manual', NULL, 0, 'orphan', ?, 3, 'm', 1)`,
      args: ['orphan1', new Uint8Array(new Float32Array(vec(1)).buffer)]
    })
    const hits = await repo.queryNativeVector(vec(1), 10, { vaultName: 'A' })
    expect(hits.some((h) => h.messageId === 'orphan1')).toBe(false)

    const noVault = await repo.queryNativeVector(vec(1), 10)
    expect(noVault).toEqual([])
  })

  it('3) session list scoped by vault_name', async () => {
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_name) VALUES (?, ?, ?)`,
      args: ['sA', 'Session A', 'A']
    })
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_name) VALUES (?, ?, ?)`,
      args: ['sB', 'Session B', 'B']
    })

    const inA = await db.execute({
      sql: `SELECT id FROM agent_sessions WHERE vault_name = ?`,
      args: ['A']
    })
    expect(inA.rows.map((r) => r.id)).toEqual(['sA'])
  })

  it('4) purgeVaultDerivedData removes B and leaves A intact', async () => {
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_name) VALUES (?, ?, ?)`,
      args: ['sA', 'A', 'A']
    })
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_name) VALUES (?, ?, ?)`,
      args: ['sB', 'B', 'B']
    })
    await repo.insertEmbedding({
      id: 'eA',
      sourceType: 'diary',
      sourceId: 'A#1',
      groupId: 'diary:A',
      vaultName: 'A',
      chunkIndex: 0,
      chunkText: 'diary A',
      embedding: vec(0.1),
      modelId: 'm'
    })
    await repo.insertEmbedding({
      id: 'eB',
      sourceType: 'diary',
      sourceId: 'B#1',
      groupId: 'diary:B',
      vaultName: 'B',
      chunkIndex: 0,
      chunkText: 'diary B',
      embedding: vec(0.2),
      modelId: 'm'
    })
    await db.execute({
      sql: `INSERT INTO graph_nodes (id, vault_name, node_type, name) VALUES ('nB', 'B', 'person', 'Bob')`
    })
    await db.execute({
      sql: `INSERT INTO graph_edges (id, vault_name, from_id, to_id, edge_type, shard_month)
            VALUES ('e1', 'B', 'nB', 'nB', 'relates_to', '2026-01')`
    })
    await db.execute({
      sql: `INSERT INTO diary_embed_jobs (vault_name, diary_id, content_hash, updated_at, created_at)
            VALUES ('B', 1, 'h', 1, 1)`
    })

    await purgeVaultDerivedData(exec, 'B')

    const embB = await db.execute({
      sql: `SELECT count(*) as c FROM memory_embeddings WHERE vault_name = 'B'`
    })
    expect(Number(embB.rows[0]?.c)).toBe(0)
    const embA = await db.execute({
      sql: `SELECT count(*) as c FROM memory_embeddings WHERE vault_name = 'A'`
    })
    expect(Number(embA.rows[0]?.c)).toBe(1)
    const sessB = await db.execute({
      sql: `SELECT count(*) as c FROM agent_sessions WHERE vault_name = 'B'`
    })
    expect(Number(sessB.rows[0]?.c)).toBe(0)
    const nodesB = await db.execute({
      sql: `SELECT count(*) as c FROM graph_nodes WHERE vault_name = 'B'`
    })
    expect(Number(nodesB.rows[0]?.c)).toBe(0)
  })

  it('6) vault_name backfill is idempotent', async () => {
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_name) VALUES ('sess1', 't', 'Work')`
    })
    // memory prefix
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('m1', 'memory', 'id1', 'memory:Personal', NULL, 0, 'mem', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.3)).buffer)]
    })
    // diary prefix
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('d1', 'diary', 'Personal#9', 'diary:Personal', NULL, 0, 'd', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.4)).buffer)]
    })
    // old diary batch via source_id
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('d2', 'diary', 'Work#3', 'diary_batch', NULL, 0, 'old', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.5)).buffer)]
    })
    // chat join
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('c1', 'chat', 'msg1', 'sess1', NULL, 0, 'chat', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.6)).buffer)]
    })
    // legacy manual — stays empty
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('man1', 'manual', 'manual_1', 'manual', NULL, 0, 'legacy', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.7)).buffer)]
    })

    const sqlExec = async (sql: string, args: Array<string | number | null> = []) => {
      const res = await db.execute({ sql, args })
      return { rows: res.rows as Array<Record<string, unknown>>, rowsAffected: res.rowsAffected }
    }

    const first = await backfillMemoryEmbeddingsVaultName(sqlExec)
    expect(first.memoryFromGroupId).toBe(1)
    expect(first.diaryFromGroupId).toBe(1)
    expect(first.diaryFromSourceId).toBe(1)
    expect(first.chatFromSessionJoin).toBe(1)
    expect(first.legacyManualUnscoped).toBe(1)

    const afterFirst = await countEmptyVaultEmbeddingsByBucket(sqlExec)
    expect(afterFirst.memoryPrefixEmpty).toBe(0)
    expect(afterFirst.diaryPrefixEmpty).toBe(0)
    expect(afterFirst.diarySourceIdEmpty).toBe(0)
    expect(afterFirst.chatJoinableEmpty).toBe(0)
    expect(afterFirst.legacyManualEmpty).toBe(1)

    const second = await backfillMemoryEmbeddingsVaultName(sqlExec)
    expect(second.memoryFromGroupId).toBe(0)
    expect(second.diaryFromGroupId).toBe(0)
    expect(second.diaryFromSourceId).toBe(0)
    expect(second.chatFromSessionJoin).toBe(0)
    expect(second.legacyManualUnscoped).toBe(1)

    const afterSecond = await countEmptyVaultEmbeddingsByBucket(sqlExec)
    expect(afterSecond).toEqual(afterFirst)

    const rows = await db.execute(`SELECT embedding_id, vault_name FROM memory_embeddings ORDER BY embedding_id`)
    const byId = Object.fromEntries(rows.rows.map((r) => [String(r.embedding_id), r.vault_name]))
    expect(byId.m1).toBe('Personal')
    expect(byId.d1).toBe('Personal')
    expect(byId.d2).toBe('Work')
    expect(byId.c1).toBe('Work')
    expect(byId.man1 == null || byId.man1 === '').toBe(true)
  })
})
