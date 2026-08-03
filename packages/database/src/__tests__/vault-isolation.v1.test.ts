/**
 * 仓库隔离 V1 + 身份 V2.2：多仓库检索 / 会话列表 / 删除清理 / name→id 回填。
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { deriveLegacyVaultId } from '@baishou/shared'
import { SqliteHybridSearchRepository } from '../repositories/hybrid-search.repository'
import {
  backfillMemoryEmbeddingsVaultName,
  countEmptyVaultEmbeddingsByBucket
} from '../memory-embeddings-vault-backfill'
import { migrateAgentDbVaultNameToVaultId } from '../vault-id-backfill'
import { purgeVaultDerivedData } from '../vault-derived-data.purge'
import { createSqlExecutor } from '../sql-executor.factory'

const VAULT_A = deriveLegacyVaultId('A')
const VAULT_B = deriveLegacyVaultId('B')
const VAULT_PERSONAL = deriveLegacyVaultId('Personal')
const VAULT_WORK = deriveLegacyVaultId('Work')

async function createSchema(db: Client) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL DEFAULT '新对话',
      vault_id TEXT NOT NULL,
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
      vault_id TEXT,
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
      vault_id TEXT NOT NULL,
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
      vault_id TEXT NOT NULL,
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
      vault_id TEXT NOT NULL,
      diary_id INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS summaries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vault_id TEXT NOT NULL,
      type TEXT NOT NULL,
      start_date INTEGER NOT NULL,
      end_date INTEGER NOT NULL,
      content TEXT NOT NULL,
      source_ids TEXT,
      generated_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER
    )
  `)
  await db.execute(`
    CREATE UNIQUE INDEX IF NOT EXISTS summaries_vault_id_type_start_date_end_date_unique
    ON summaries (vault_id, type, start_date, end_date)
  `)
  await db.execute(`
    CREATE TABLE IF NOT EXISTS agent_assistants (
      id TEXT NOT NULL,
      vault_id TEXT NOT NULL,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      is_pinned INTEGER NOT NULL DEFAULT 0,
      context_window INTEGER NOT NULL DEFAULT -1,
      compress_token_threshold INTEGER NOT NULL DEFAULT 150000,
      compress_keep_turns INTEGER NOT NULL DEFAULT 3,
      assistant_kind TEXT NOT NULL DEFAULT 'companion',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (vault_id, id)
    )
  `)
}

function vec(n: number): number[] {
  return [n, 0, 0]
}

describe('vault isolation V2.2 (vault_id)', () => {
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

  it('1) search in vault A never returns vault B rows (by vault_id)', async () => {
    await repo.insertEmbedding({
      id: 'a1',
      sourceType: 'memory',
      sourceId: 'mA',
      groupId: 'memory',
      vaultId: VAULT_A,
      chunkIndex: 0,
      chunkText: 'alpha secret in A',
      embedding: vec(1),
      modelId: 'm'
    })
    await repo.insertEmbedding({
      id: 'b1',
      sourceType: 'memory',
      sourceId: 'mB',
      groupId: 'memory',
      vaultId: VAULT_B,
      chunkIndex: 0,
      chunkText: 'beta secret in B',
      embedding: vec(0.99),
      modelId: 'm'
    })

    const hits = await repo.queryNativeVector(vec(1), 10, { vaultId: VAULT_A })
    expect(hits.every((h) => h.chunkText.includes('A') || h.messageId === 'a1')).toBe(true)
    expect(hits.some((h) => h.messageId === 'b1')).toBe(false)

    const fts = await repo.queryFTS('secret', 10, { vaultId: VAULT_A })
    expect(fts.some((h) => h.messageId === 'b1')).toBe(false)
    expect(fts.some((h) => h.messageId === 'a1')).toBe(true)
  })

  it('2) empty vault_id rows are never returned (fail-closed)', async () => {
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES (?, 'memory', 'x', 'manual', NULL, 0, 'orphan', ?, 3, 'm', 1)`,
      args: ['orphan1', new Uint8Array(new Float32Array(vec(1)).buffer)]
    })
    const hits = await repo.queryNativeVector(vec(1), 10, { vaultId: VAULT_A })
    expect(hits.some((h) => h.messageId === 'orphan1')).toBe(false)

    const noVault = await repo.queryNativeVector(vec(1), 10)
    expect(noVault).toEqual([])
  })

  it('3) session list scoped by vault_id', async () => {
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES (?, ?, ?)`,
      args: ['sA', 'Session A', VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES (?, ?, ?)`,
      args: ['sB', 'Session B', VAULT_B]
    })

    const inA = await db.execute({
      sql: `SELECT id FROM agent_sessions WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(inA.rows.map((r) => r.id)).toEqual(['sA'])
  })

  it('4) purgeVaultDerivedData removes B and leaves A intact', async () => {
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES (?, ?, ?)`,
      args: ['sA', 'A', VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES (?, ?, ?)`,
      args: ['sB', 'B', VAULT_B]
    })
    await repo.insertEmbedding({
      id: 'eA',
      sourceType: 'diary',
      sourceId: `${VAULT_A}#1`,
      groupId: 'diary',
      vaultId: VAULT_A,
      chunkIndex: 0,
      chunkText: 'diary A',
      embedding: vec(0.1),
      modelId: 'm'
    })
    await repo.insertEmbedding({
      id: 'eB',
      sourceType: 'diary',
      sourceId: `${VAULT_B}#1`,
      groupId: 'diary',
      vaultId: VAULT_B,
      chunkIndex: 0,
      chunkText: 'diary B',
      embedding: vec(0.2),
      modelId: 'm'
    })
    await db.execute({
      sql: `INSERT INTO graph_nodes (id, vault_id, node_type, name) VALUES ('nB', ?, 'person', 'Bob')`,
      args: [VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO graph_edges (id, vault_id, from_id, to_id, edge_type, shard_month)
            VALUES ('e1', ?, 'nB', 'nB', 'relates_to', '2026-01')`,
      args: [VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO diary_embed_jobs (vault_id, diary_id, content_hash, updated_at, created_at)
            VALUES (?, 1, 'h', 1, 1)`,
      args: [VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'monthly', 1, 2, 'sumA', 1)`,
      args: [VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'monthly', 1, 2, 'sumB', 1)`,
      args: [VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'Latte A')`,
      args: [VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'Latte B')`,
      args: [VAULT_B]
    })

    await purgeVaultDerivedData(exec, VAULT_B)

    const embB = await db.execute({
      sql: `SELECT count(*) as c FROM memory_embeddings WHERE vault_id = ?`,
      args: [VAULT_B]
    })
    expect(Number(embB.rows[0]?.c)).toBe(0)
    const embA = await db.execute({
      sql: `SELECT count(*) as c FROM memory_embeddings WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(Number(embA.rows[0]?.c)).toBe(1)
    const sessB = await db.execute({
      sql: `SELECT count(*) as c FROM agent_sessions WHERE vault_id = ?`,
      args: [VAULT_B]
    })
    expect(Number(sessB.rows[0]?.c)).toBe(0)
    const nodesB = await db.execute({
      sql: `SELECT count(*) as c FROM graph_nodes WHERE vault_id = ?`,
      args: [VAULT_B]
    })
    expect(Number(nodesB.rows[0]?.c)).toBe(0)
    const sumB = await db.execute({
      sql: `SELECT count(*) as c FROM summaries WHERE vault_id = ?`,
      args: [VAULT_B]
    })
    expect(Number(sumB.rows[0]?.c)).toBe(0)
    const sumA = await db.execute({
      sql: `SELECT count(*) as c FROM summaries WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(Number(sumA.rows[0]?.c)).toBe(1)
    const astB = await db.execute({
      sql: `SELECT count(*) as c FROM agent_assistants WHERE vault_id = ?`,
      args: [VAULT_B]
    })
    expect(Number(astB.rows[0]?.c)).toBe(0)
    const astA = await db.execute({
      sql: `SELECT id, name FROM agent_assistants WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(astA.rows).toEqual([{ id: 'default', name: 'Latte A' }])
  })

  it('4b) assistant list scoped by vault_id; same id can coexist across vaults', async () => {
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'A')`,
      args: [VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'B')`,
      args: [VAULT_B]
    })

    const inA = await db.execute({
      sql: `SELECT name FROM agent_assistants WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(inA.rows.map((r) => r.name)).toEqual(['A'])

    const allDefaults = await db.execute({
      sql: `SELECT count(*) as c FROM agent_assistants WHERE id = 'default'`
    })
    expect(Number(allDefaults.rows[0]?.c)).toBe(2)
  })

  it('4c) summaries unique allows same period in different vaults', async () => {
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'weekly', 10, 20, 'A', 1)`,
      args: [VAULT_A]
    })
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'weekly', 10, 20, 'B', 1)`,
      args: [VAULT_B]
    })
    const inA = await db.execute({
      sql: `SELECT content FROM summaries WHERE vault_id = ?`,
      args: [VAULT_A]
    })
    expect(inA.rows.map((r) => r.content)).toEqual(['A'])
  })

  it('5) new embeds use group_id memory/diary (not vault-prefixed)', async () => {
    await repo.insertEmbedding({
      id: 'g1',
      sourceType: 'memory',
      sourceId: 'm1',
      groupId: 'memory',
      vaultId: VAULT_A,
      chunkIndex: 0,
      chunkText: 'mem',
      embedding: vec(0.2),
      modelId: 'm'
    })
    await repo.insertEmbedding({
      id: 'g2',
      sourceType: 'diary',
      sourceId: `${VAULT_A}#7`,
      groupId: 'diary',
      vaultId: VAULT_A,
      chunkIndex: 0,
      chunkText: 'day',
      embedding: vec(0.3),
      modelId: 'm'
    })
    const rows = await db.execute(
      `SELECT embedding_id, group_id, source_id FROM memory_embeddings ORDER BY embedding_id`
    )
    const byId = Object.fromEntries(
      rows.rows.map((r) => [String(r.embedding_id), { g: r.group_id, s: r.source_id }])
    )
    expect(byId.g1).toEqual({ g: 'memory', s: 'm1' })
    expect(byId.g2).toEqual({ g: 'diary', s: `${VAULT_A}#7` })
    expect(String(byId.g2!.s).startsWith('vlt_')).toBe(true)
  })

  it('6) V1 vault_name backfill then V2.2 name→id + diary source_id rewrite', async () => {
    // 模拟旧库：仍用 vault_name 列
    await db.execute(`DROP TABLE IF EXISTS agent_sessions`)
    await db.execute(`DROP TABLE IF EXISTS memory_embeddings`)
    await db.execute(`
      CREATE TABLE agent_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT 't',
        vault_name TEXT NOT NULL,
        provider_id TEXT NOT NULL DEFAULT 'x',
        model_id TEXT NOT NULL DEFAULT 'y',
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `)
    await db.execute(`
      CREATE TABLE memory_embeddings (
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

    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_name) VALUES ('sess1', 't', 'Work')`
    })
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('m1', 'memory', 'id1', 'memory:Personal', NULL, 0, 'mem', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.3)).buffer)]
    })
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('d1', 'diary', 'Personal#9', 'diary:Personal', NULL, 0, 'd', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.4)).buffer)]
    })
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('d2', 'diary', 'Work#3', 'diary_batch', NULL, 0, 'old', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.5)).buffer)]
    })
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_name, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('c1', 'chat', 'msg1', 'sess1', NULL, 0, 'chat', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.6)).buffer)]
    })
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
    expect(afterFirst.legacyManualEmpty).toBe(1)

    const v2 = await migrateAgentDbVaultNameToVaultId(sqlExec)
    expect(v2.distinctNamesMapped).toBeGreaterThan(0)

    const rows = await db.execute(
      `SELECT embedding_id, vault_id, source_id FROM memory_embeddings ORDER BY embedding_id`
    )
    const byId = Object.fromEntries(
      rows.rows.map((r) => [
        String(r.embedding_id),
        { vaultId: r.vault_id, sourceId: r.source_id }
      ])
    )
    expect(byId.m1?.vaultId).toBe(VAULT_PERSONAL)
    expect(byId.d1?.vaultId).toBe(VAULT_PERSONAL)
    expect(byId.d1?.sourceId).toBe(`${VAULT_PERSONAL}#9`)
    expect(byId.d2?.vaultId).toBe(VAULT_WORK)
    expect(byId.d2?.sourceId).toBe(`${VAULT_WORK}#3`)
    expect(byId.c1?.vaultId).toBe(VAULT_WORK)
    expect(byId.man1?.vaultId == null || byId.man1?.vaultId === '').toBe(true)

    // 幂等
    const v2b = await migrateAgentDbVaultNameToVaultId(sqlExec)
    expect(v2b.valuesRemapped).toBe(0)
    expect(v2b.diarySourceIdsRewritten).toBe(0)
  })
})
