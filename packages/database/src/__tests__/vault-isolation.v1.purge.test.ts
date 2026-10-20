import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { purgeVaultDerivedData } from '../vault-derived-data.purge'
import type { VaultIsolationFixture } from './vault-isolation.v1.test-helpers'
import {
  VAULT_A,
  VAULT_B,
  createVaultIsolationFixture,
  disposeVaultIsolationFixture,
  vec
} from './vault-isolation.v1.test-helpers'

describe('vault isolation V2.2 (vault_id) — 删除清理', () => {
  let fixture: VaultIsolationFixture

  beforeEach(async () => {
    fixture = await createVaultIsolationFixture()
  })

  afterEach(async () => {
    await disposeVaultIsolationFixture(fixture)
  })

  it('4) purgeVaultDerivedData removes B and leaves A intact', async () => {
    const { db, repo, exec } = fixture
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
      sql: `INSERT INTO graph_nodes (id, vault_id, node_type, name, name_normalized) VALUES ('nB', ?, 'person', 'Bob', 'bob')`,
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
    await db.execute({
      sql: `INSERT INTO compression_snapshots (session_id, summary_text, covered_up_to_message_id, message_count, created_at)
            VALUES ('sA', 'sumA', 'm1', 1, 1)`
    })
    await db.execute({
      sql: `INSERT INTO compression_snapshots (session_id, summary_text, covered_up_to_message_id, message_count, created_at)
            VALUES ('sB', 'sumB', 'm2', 2, 1)`
    })

    const purged = await purgeVaultDerivedData(exec, VAULT_B)
    expect(purged.compressionSnapshots).toBe(1)

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
    const snapB = await db.execute({
      sql: `SELECT count(*) as c FROM compression_snapshots WHERE session_id = 'sB'`
    })
    expect(Number(snapB.rows[0]?.c)).toBe(0)
    const snapA = await db.execute({
      sql: `SELECT count(*) as c FROM compression_snapshots WHERE session_id = 'sA'`
    })
    expect(Number(snapA.rows[0]?.c)).toBe(1)
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

  it('5c) §9 delete B: no vault_id=B anywhere; A intact', async () => {
    const { db, repo, exec } = fixture
    await db.execute({
      sql: `INSERT INTO agent_sessions (id, title, vault_id) VALUES ('sA', 'A', ?), ('sB', 'B', ?)`,
      args: [VAULT_A, VAULT_B]
    })
    await repo.insertEmbedding({
      id: 'eA',
      sourceType: 'memory',
      sourceId: 'mA',
      groupId: 'memory',
      vaultId: VAULT_A,
      chunkIndex: 0,
      chunkText: 'keep A',
      embedding: vec(0.1),
      modelId: 'm'
    })
    await repo.insertEmbedding({
      id: 'eB',
      sourceType: 'memory',
      sourceId: 'mB',
      groupId: 'memory',
      vaultId: VAULT_B,
      chunkIndex: 0,
      chunkText: 'drop B',
      embedding: vec(0.2),
      modelId: 'm'
    })
    await db.execute({
      sql: `INSERT INTO graph_nodes (id, vault_id, node_type, name, name_normalized) VALUES ('nA', ?, 'person', 'Ann', 'ann'), ('nB', ?, 'person', 'Bob', 'bob')`,
      args: [VAULT_A, VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO summaries (vault_id, type, start_date, end_date, content, generated_at)
            VALUES (?, 'monthly', 1, 2, 'A', 1), (?, 'monthly', 1, 2, 'B', 1)`,
      args: [VAULT_A, VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO agent_assistants (id, vault_id, name) VALUES ('default', ?, 'A'), ('default', ?, 'B')`,
      args: [VAULT_A, VAULT_B]
    })
    await db.execute({
      sql: `INSERT INTO diary_embed_jobs (vault_id, diary_id, content_hash, updated_at, created_at)
            VALUES (?, 1, 'hA', 1, 1), (?, 2, 'hB', 1, 1)`,
      args: [VAULT_A, VAULT_B]
    })

    await purgeVaultDerivedData(exec, VAULT_B)

    for (const table of [
      'agent_sessions',
      'memory_embeddings',
      'graph_nodes',
      'summaries',
      'agent_assistants',
      'diary_embed_jobs'
    ]) {
      const left = await db.execute({
        sql: `SELECT count(*) as c FROM ${table} WHERE vault_id = ?`,
        args: [VAULT_B]
      })
      expect(Number(left.rows[0]?.c), table).toBe(0)
    }

    expect(
      Number(
        (
          await db.execute({
            sql: `SELECT count(*) as c FROM agent_sessions WHERE vault_id = ?`,
            args: [VAULT_A]
          })
        ).rows[0]?.c
      )
    ).toBe(1)
    expect(
      Number(
        (
          await db.execute({
            sql: `SELECT count(*) as c FROM memory_embeddings WHERE vault_id = ?`,
            args: [VAULT_A]
          })
        ).rows[0]?.c
      )
    ).toBe(1)
    expect(
      Number(
        (
          await db.execute({
            sql: `SELECT count(*) as c FROM agent_assistants WHERE vault_id = ?`,
            args: [VAULT_A]
          })
        ).rows[0]?.c
      )
    ).toBe(1)
  })
})
