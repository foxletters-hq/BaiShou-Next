import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  backfillMemoryEmbeddingsVaultName,
  countEmptyVaultEmbeddingsByBucket
} from '../memory-embeddings-vault-backfill'
import { migrateAgentDbVaultNameToVaultId } from '../vault-id-backfill'
import type { VaultIsolationFixture } from './vault-isolation.v1.test-helpers'
import {
  VAULT_PERSONAL,
  VAULT_WORK,
  createSqlExec,
  createVaultIsolationFixture,
  disposeVaultIsolationFixture,
  vec
} from './vault-isolation.v1.test-helpers'

describe('vault isolation V2.2 (vault_id) — 旧库回填', () => {
  let fixture: VaultIsolationFixture

  beforeEach(async () => {
    fixture = await createVaultIsolationFixture()
  })

  afterEach(async () => {
    await disposeVaultIsolationFixture(fixture)
  })

  it('6) V1 vault_name backfill then V2.2 name→id + diary source_id rewrite', async () => {
    const { db } = fixture
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

    const sqlExec = createSqlExec(db)

    const first = await backfillMemoryEmbeddingsVaultName(sqlExec)
    expect(first.memoryFromGroupId).toBe(1)
    expect(first.diaryFromGroupId).toBe(1)
    expect(first.diaryFromSourceId).toBe(1)
    expect(first.chatFromSessionJoin).toBe(1)
    expect(first.legacyManualUnscoped).toBe(1)

    // V1.0 回填幂等：连跑第二次应无新候选
    const secondNameBackfill = await backfillMemoryEmbeddingsVaultName(sqlExec)
    expect(secondNameBackfill.memoryFromGroupId).toBe(0)
    expect(secondNameBackfill.diaryFromGroupId).toBe(0)
    expect(secondNameBackfill.diaryFromSourceId).toBe(0)
    expect(secondNameBackfill.chatFromSessionJoin).toBe(0)

    const afterFirst = await countEmptyVaultEmbeddingsByBucket(sqlExec)
    expect(afterFirst.legacyManualEmpty).toBe(1)

    const v2 = await migrateAgentDbVaultNameToVaultId(sqlExec)
    expect(v2.distinctNamesMapped).toBeGreaterThan(0)

    const rows = await db.execute(
      `SELECT embedding_id, vault_id, source_id FROM memory_embeddings ORDER BY embedding_id`
    )
    const byId = Object.fromEntries(
      rows.rows.map((r) => [String(r.embedding_id), { vaultId: r.vault_id, sourceId: r.source_id }])
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

  it('7) direct upgrade from main: table has vault_id directly without vault_name', async () => {
    const { db } = fixture
    await db.execute(`DROP TABLE IF EXISTS agent_sessions`)
    await db.execute(`DROP TABLE IF EXISTS memory_embeddings`)
    await db.execute(`
      CREATE TABLE agent_sessions (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL DEFAULT 't',
        vault_id TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL DEFAULT 0
      )
    `)
    // 模拟 main 分支：最初无任何 vault 列，由缺列补丁直接添加了 vault_id TEXT（值全为 NULL）
    await db.execute(`
      CREATE TABLE memory_embeddings (
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

    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES ('sess_main', 't', 'Work')`
    })
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('m_main', 'memory', 'id1', 'memory:Personal', NULL, 0, 'mem', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.3)).buffer)]
    })
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('d_main', 'diary', 'Personal#10', 'diary:Personal', NULL, 0, 'd', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.4)).buffer)]
    })
    await db.execute({
      sql: `INSERT INTO memory_embeddings
        (embedding_id, source_type, source_id, group_id, vault_id, chunk_index, chunk_text,
         embedding, dimension, model_id, created_at)
       VALUES ('c_main', 'chat', 'msg1', 'sess_main', NULL, 0, 'chat', ?, 3, 'm', 1)`,
      args: [new Uint8Array(new Float32Array(vec(0.6)).buffer)]
    })

    const sqlExec = createSqlExec(db)

    // 执行回填（目标列是 vault_id）
    const first = await backfillMemoryEmbeddingsVaultName(sqlExec, 'vault_id')
    expect(first.memoryFromGroupId).toBe(1)
    expect(first.diaryFromGroupId).toBe(1)
    expect(first.chatFromSessionJoin).toBe(1)

    // 执行 ID 映射
    const v2 = await migrateAgentDbVaultNameToVaultId(sqlExec)
    expect(v2.valuesRemapped).toBeGreaterThan(0)

    const rows = await db.execute(
      `SELECT embedding_id, vault_id, source_id FROM memory_embeddings ORDER BY embedding_id`
    )
    const byId = Object.fromEntries(
      rows.rows.map((r) => [String(r.embedding_id), { vaultId: r.vault_id, sourceId: r.source_id }])
    )
    expect(byId.m_main?.vaultId).toBe(VAULT_PERSONAL)
    expect(byId.d_main?.vaultId).toBe(VAULT_PERSONAL)
    expect(byId.d_main?.sourceId).toBe(`${VAULT_PERSONAL}#10`)
    expect(byId.c_main?.vaultId).toBe(VAULT_WORK)
  })
})
