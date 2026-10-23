import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { SqliteHybridSearchRepository } from '../repositories/hybrid-search.repository'
import type { VaultIsolationFixture } from './vault-isolation.v1.test-helpers'
import {
  VAULT_A,
  VAULT_B,
  createVaultIsolationFixture,
  disposeVaultIsolationFixture,
  vec
} from './vault-isolation.v1.test-helpers'

describe('vault isolation V2.2 (vault_id) — 检索隔离', () => {
  let fixture: VaultIsolationFixture
  let repo: SqliteHybridSearchRepository

  beforeEach(async () => {
    fixture = await createVaultIsolationFixture()
    repo = fixture.repo
  })

  afterEach(async () => {
    await disposeVaultIsolationFixture(fixture)
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
    const { db } = fixture
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

  it('3b) listEmbeddingChunksByType only returns active vault (JSONL backfill isolation)', async () => {
    await repo.insertEmbedding({
      id: 'mem-a',
      sourceType: 'memory',
      sourceId: 'memA',
      groupId: 'memory',
      vaultId: VAULT_A,
      chunkIndex: 0,
      chunkText: 'memory content A only',
      embedding: vec(0.2),
      modelId: 'm'
    })
    await repo.insertEmbedding({
      id: 'mem-b',
      sourceType: 'memory',
      sourceId: 'memB',
      groupId: 'memory',
      vaultId: VAULT_B,
      chunkIndex: 0,
      chunkText: 'memory content B only',
      embedding: vec(0.3),
      modelId: 'm'
    })

    // 切到 B 仓 hydration：只应拿到 B，不得带入 A
    const forB = await repo.listEmbeddingChunksByType('memory', { vaultId: VAULT_B })
    expect(forB.map((c) => c.sourceId)).toEqual(['memB'])
    expect(forB.some((c) => c.chunkText.includes('content A'))).toBe(false)

    const forA = await repo.listEmbeddingChunksByType('memory', { vaultId: VAULT_A })
    expect(forA.map((c) => c.sourceId)).toEqual(['memA'])
    expect(forA.some((c) => c.chunkText.includes('content B'))).toBe(false)

    // fail-closed
    expect(await repo.listEmbeddingChunksByType('memory')).toEqual([])
    expect(await repo.listEmbeddingChunksByType('memory', {})).toEqual([])
  })
})
