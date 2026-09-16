import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'
import { ensureKnowledgeSchema } from '../knowledge-schema.shared'
import { KnowledgeRepository } from '../repositories/knowledge.repository'

describe('knowledge_embed_ledger (libsql)', () => {
  let tempDir: string
  let client: Client
  let repo: KnowledgeRepository

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-kb-ledger-libsql-'))
    const dbPath = path.join(tempDir, 'knowledge.db')
    client = createClient({ url: `file:${dbPath}` })
    await ensureKnowledgeSchema(client, '[KnowledgeLedgerTest]')
    repo = new KnowledgeRepository(drizzle(client) as never)
    await repo.createNotebook({ id: 'nb1', name: '本', vaultId: 'vault-a' })
    await repo.upsertSource({
      id: 'src1',
      notebookId: 'nb1',
      title: '资料',
      sourceKind: 'text',
      contentHash: 'file',
      extractedTextHash: 'md5',
      status: 'ready',
      vaultId: 'vault-a'
    })
  })

  afterEach(async () => {
    client.close()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('recordEmbedded 覆盖同一资料一行', async () => {
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceId: 'src1',
      contentHash: 'aaa',
      chunkCount: 2,
      modelId: 'm1',
      dimension: 8
    })
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceId: 'src1',
      contentHash: 'bbb',
      chunkCount: 3,
      modelId: 'm2',
      dimension: 16
    })
    const row = await repo.getEmbedLedger('vault-a', 'src1')
    expect(row).toMatchObject({
      contentHash: 'bbb',
      chunkCount: 3,
      modelId: 'm2',
      dimension: 16,
      status: 'embedded'
    })
  })

  it('有 extracted 正文且账本不是当前 embedded 时计入待嵌入', async () => {
    expect(await repo.countPendingEmbedSources('vault-a', { modelId: 'm1', dimension: 8 })).toBe(1)
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceId: 'src1',
      contentHash: 'aaa',
      chunkCount: 0,
      modelId: 'm1',
      dimension: 8
    })
    expect(await repo.countPendingEmbedSources('vault-a', { modelId: 'm1', dimension: 8 })).toBe(0)
    await repo.recordEmbedFailure({ vaultId: 'vault-a', sourceId: 'src1', lastError: 'boom' })
    expect(await repo.countPendingEmbedSources('vault-a')).toBe(1)
  })

  it('SUM(chunk_count) 与切片数不一致时从切片表重建', async () => {
    await repo.insertChunk({
      chunkId: 'src1_0',
      notebookId: 'nb1',
      sourceId: 'src1',
      chunkIndex: 0,
      chunkText: 'hello',
      embedding: Buffer.from(new Float32Array(2).buffer),
      dimension: 2,
      modelId: 'm1',
      vaultId: 'vault-a'
    })
    await repo.recordEmbedded({
      vaultId: 'vault-a',
      sourceId: 'src1',
      contentHash: 'aaa',
      chunkCount: 9,
      modelId: 'm1',
      dimension: 2
    })
    const result = await repo.reconcileEmbedLedger({ vaultId: 'vault-a' })
    expect(result.rebuilt).toBe(true)
    expect(result.vectorCount).toBe(1)
    const row = await repo.getEmbedLedger('vault-a', 'src1')
    expect(row?.chunkCount).toBe(1)
  })
})
