import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { VaultIsolationFixture } from './vault-isolation.v1.test-helpers'
import {
  VAULT_A,
  createVaultIsolationFixture,
  disposeVaultIsolationFixture,
  vec
} from './vault-isolation.v1.test-helpers'

describe('vault isolation V2.2 (vault_id) — 向量写入', () => {
  let fixture: VaultIsolationFixture

  beforeEach(async () => {
    fixture = await createVaultIsolationFixture()
  })

  afterEach(async () => {
    await disposeVaultIsolationFixture(fixture)
  })

  it('5) new embeds use group_id memory/diary (not vault-prefixed)', async () => {
    const { db, repo } = fixture
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
})
