import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import {
  NOTEBOOK_GRAPH_ALIASES_SQL,
  NOTEBOOK_GRAPH_EDGES_SQL,
  NOTEBOOK_GRAPH_INDEXES_SQL,
  NOTEBOOK_GRAPH_NODES_SQL
} from '../../knowledge-schema.shared'
import { NotebookGraphRepository } from '../notebook-graph.repository'

const VAULT = 'v1'
const NB_A = 'nb-a'
const NB_B = 'nb-b'

function readEmbedding(raw: unknown, dimension: number | null): number[] {
  if (!raw || !dimension) return []
  const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as Uint8Array)
  return Array.from(new Float32Array(buf.buffer, buf.byteOffset, dimension))
}

describe('NotebookGraphRepository embeddings (libsql)', () => {
  let client: Client
  let repo: NotebookGraphRepository

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    await client.execute(NOTEBOOK_GRAPH_NODES_SQL)
    await client.execute(NOTEBOOK_GRAPH_ALIASES_SQL)
    await client.execute(NOTEBOOK_GRAPH_EDGES_SQL)
    for (const sql of NOTEBOOK_GRAPH_INDEXES_SQL) await client.execute(sql)
    repo = new NotebookGraphRepository(drizzle(client) as never)
  })

  afterEach(() => {
    client.close()
  })

  async function seedNode(id: string, notebookId: string, name: string, deletedAt?: number) {
    const now = Date.now()
    await repo.applyRawNode({
      id,
      vaultId: VAULT,
      notebookId,
      nodeType: 'person',
      name,
      summary: `${name} 摘要`,
      createdAt: now,
      updatedAt: now,
      shardMonth: 'src1'
    })
    if (deletedAt != null) {
      await client.execute({
        sql: 'UPDATE notebook_graph_nodes SET deleted_at = ? WHERE id = ?',
        args: [deletedAt, id]
      })
    }
  }

  it('should 读回写入的向量 when 调用 updateNodeEmbedding', async () => {
    await seedNode('n-a', NB_A, '甲')
    const embedding = [0.25, 0.5, 0.75, 1]
    await repo.updateNodeEmbedding('n-a', VAULT, NB_A, embedding, 'mock-embed')
    const row = await repo.getNodeById('n-a', VAULT, NB_A)
    expect(row?.dimension).toBe(4)
    expect(row?.modelId).toBe('mock-embed')
    expect(readEmbedding(row?.embedding, row?.dimension ?? null)).toEqual(embedding)
  })

  it('should 按距离升序返回 when 同笔记本有多个向量节点', async () => {
    await seedNode('n-far', NB_A, '远')
    await seedNode('n-mid', NB_A, '中')
    await seedNode('n-near', NB_A, '近')
    await repo.updateNodeEmbedding('n-far', VAULT, NB_A, [0, 1, 0, 0], 'mock-embed')
    await repo.updateNodeEmbedding('n-mid', VAULT, NB_A, [0.5, 0.5, 0, 0], 'mock-embed')
    await repo.updateNodeEmbedding('n-near', VAULT, NB_A, [1, 0, 0, 0], 'mock-embed')
    const hits = await repo.searchNodesByVector(VAULT, NB_A, [1, 0, 0, 0], 3)
    expect(hits.map((h) => h.id)).toEqual(['n-near', 'n-mid', 'n-far'])
    expect(hits[0]?.distance).toBeLessThan(hits[1]!.distance)
    expect(hits[1]?.distance).toBeLessThan(hits[2]!.distance)
    expect(hits[0]).not.toHaveProperty('embedding')
  })

  it('should 不召回另一本笔记本的节点 when 向量相同', async () => {
    await seedNode('n-a', NB_A, '甲')
    await seedNode('n-b', NB_B, '乙')
    await repo.updateNodeEmbedding('n-a', VAULT, NB_A, [1, 0, 0, 0], 'mock-embed')
    await repo.updateNodeEmbedding('n-b', VAULT, NB_B, [1, 0, 0, 0], 'mock-embed')
    const hits = await repo.searchNodesByVector(VAULT, NB_A, [1, 0, 0, 0], 8)
    expect(hits.map((h) => h.id)).toEqual(['n-a'])
    expect(hits.every((h) => h.notebookId === NB_A)).toBe(true)
  })

  it('should 不召回软删除节点 when 该节点仍有向量', async () => {
    await seedNode('n-live', NB_A, '在')
    await seedNode('n-gone', NB_A, '删', Date.now())
    await repo.updateNodeEmbedding('n-live', VAULT, NB_A, [1, 0, 0, 0], 'mock-embed')
    await client.execute({
      sql: `UPDATE notebook_graph_nodes SET embedding = ?, dimension = 4, model_id = 'mock-embed' WHERE id = ?`,
      args: [Buffer.from(new Float32Array([1, 0, 0, 0]).buffer), 'n-gone']
    })
    const hits = await repo.searchNodesByVector(VAULT, NB_A, [1, 0, 0, 0], 8)
    expect(hits.map((h) => h.id)).toEqual(['n-live'])
  })

  it('should 只返回无向量且带 notebookId 的活节点 when 列出未嵌入', async () => {
    await seedNode('n-empty', NB_A, '空')
    await seedNode('n-ready', NB_A, '齐')
    await seedNode('n-other', NB_B, '另')
    await seedNode('n-gone', NB_A, '删', Date.now())
    await repo.updateNodeEmbedding('n-ready', VAULT, NB_A, [0, 1, 0, 0], 'mock-embed')
    const rows = await repo.listUnembeddedLiveNodes(VAULT)
    expect(rows.map((r) => r.id).sort()).toEqual(['n-empty', 'n-other'])
    expect(rows.find((r) => r.id === 'n-empty')?.notebookId).toBe(NB_A)
    expect(rows.find((r) => r.id === 'n-other')?.notebookId).toBe(NB_B)
    const onlyA = await repo.listUnembeddedLiveNodes(VAULT, NB_A)
    expect(onlyA.map((r) => r.id)).toEqual(['n-empty'])
  })

  it('should persist embedding when applyRawNode receives a new vector', async () => {
    await seedNode('n-a', NB_A, '甲')
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-a',
      vaultId: VAULT,
      notebookId: NB_A,
      nodeType: 'person',
      name: '甲',
      summary: '大学同学',
      createdAt: now,
      updatedAt: now,
      shardMonth: 'src1',
      embedding: [0.25, 0.5, 0.75, 1],
      modelId: 'mock-embed'
    })
    const row = await repo.getNodeById('n-a', VAULT, NB_A)
    expect(row?.summary).toBe('大学同学')
    expect(row?.modelId).toBe('mock-embed')
    expect(readEmbedding(row?.embedding, row?.dimension ?? null)).toEqual([0.25, 0.5, 0.75, 1])
  })

  it('should keep the old vector when applyRawNode omits embedding', async () => {
    await seedNode('n-a', NB_A, '甲')
    await repo.updateNodeEmbedding('n-a', VAULT, NB_A, [1, 0, 0, 0], 'mock-embed')
    const now = Date.now()
    await repo.applyRawNode({
      id: 'n-a',
      vaultId: VAULT,
      notebookId: NB_A,
      nodeType: 'person',
      name: '甲',
      summary: '只改摘要',
      createdAt: now,
      updatedAt: now,
      shardMonth: 'src1'
    })
    const row = await repo.getNodeById('n-a', VAULT, NB_A)
    expect(row?.summary).toBe('只改摘要')
    expect(row?.modelId).toBe('mock-embed')
    expect(readEmbedding(row?.embedding, row?.dimension ?? null)).toEqual([1, 0, 0, 0])
  })

  it('should 保留实体行 when 清掉向量', async () => {
    await seedNode('n-a', NB_A, '甲')
    await repo.updateNodeEmbedding('n-a', VAULT, NB_A, [1, 0, 0, 0], 'mock-embed')
    await repo.clearNodeEmbedding('n-a', VAULT, NB_A)
    const row = await repo.getNodeById('n-a', VAULT, NB_A)
    expect(row?.id).toBe('n-a')
    expect(row?.name).toBe('甲')
    expect(row?.embedding).toBeNull()
    expect(row?.dimension).toBeNull()
    expect(row?.modelId).toBe('')
    const pending = await repo.listUnembeddedLiveNodes(VAULT, NB_A)
    expect(pending.map((r) => r.id)).toEqual(['n-a'])
  })
})
