import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { Client } from '@libsql/client'
import type { GraphRepository } from '../graph.repository'
import {
  OTHER,
  VAULT,
  createGraphFixture,
  disposeGraphFixture,
  type GraphFixture
} from './graph.repository.test-helpers'

describe('GraphRepository mutations', () => {
  let fixture: GraphFixture
  let client: Client
  let repo: GraphRepository
  let seedNode: GraphFixture['seedNode']
  let seedEdge: GraphFixture['seedEdge']

  beforeEach(async () => {
    fixture = await createGraphFixture()
    client = fixture.client
    repo = fixture.repo
    seedNode = fixture.seedNode
    seedEdge = fixture.seedEdge
  })

  afterEach(() => {
    disposeGraphFixture(fixture)
  })

  it('findShortestPath expands by frontier IN, not a full-edge load', async () => {
    await seedNode('p-a', { name: '路A' })
    await seedNode('p-b', { name: '路B' })
    await seedNode('p-c', { name: '路C' })
    await seedNode('p-noise', { name: '噪声' })
    await seedNode('n-ming', { name: '小明' })
    await seedEdge('pe-ab', 'p-a', 'p-b')
    await seedEdge('pe-bc', 'p-b', 'p-c')
    await seedEdge('pe-noise', 'p-noise', 'n-ming')

    const path = await repo.findShortestPath(VAULT, 'p-a', 'p-c', { maxHops: 3 })
    expect(path?.nodeIds).toEqual(['p-a', 'p-b', 'p-c'])
    expect(path?.edges.map((e) => e.id)).toEqual(['pe-ab', 'pe-bc'])
  })

  it('recountMentions writes endpoint counts and does not increment blindly', async () => {
    await seedNode('n-a', { name: '甲', mentionCount: 99 })
    await seedNode('n-b', { name: '乙', mentionCount: 99 })
    await seedNode('n-c', { name: '丙', mentionCount: 99 })
    await seedEdge('e-mar', 'n-a', 'n-b', { shardMonth: '2026-03' })
    await seedEdge('e-aug', 'n-b', 'n-c', { shardMonth: '2026-08' })

    await repo.recountMentions(VAULT, ['n-a', 'n-b', 'n-c'])
    const a = await repo.getNodeById('n-a', VAULT)
    const b = await repo.getNodeById('n-b', VAULT)
    const c = await repo.getNodeById('n-c', VAULT)
    expect(a?.mentionCount).toBe(1)
    expect(b?.mentionCount).toBe(2)
    expect(c?.mentionCount).toBe(1)
    await repo.recountMentions(VAULT, ['n-a', 'n-b', 'n-c'])
    const a2 = await repo.getNodeById('n-a', VAULT)
    expect(a2?.mentionCount).toBe(1)
  })

  it('upsertNode without a new vector leaves the existing embedding', async () => {
    const embedding = [0.1, 0.2, 0.3, 0.4]
    await repo.upsertNode({
      id: 'n-vec',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '有向量',
      embedding,
      modelId: 'mock-embed',
      shardMonth: '2026-03'
    })
    const before = await client.execute({
      sql: 'SELECT dimension, model_id, length(embedding) AS elen FROM graph_nodes WHERE id = ?',
      args: ['n-vec']
    })
    expect(before.rows[0]?.dimension).toBe(4)
    expect(before.rows[0]?.model_id).toBe('mock-embed')
    expect(Number(before.rows[0]?.elen)).toBeGreaterThan(0)

    await repo.upsertNode({
      id: 'n-vec',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '有向量',
      summary: '无新向量的回写',
      shardMonth: '2026-03'
    })
    const after = await client.execute({
      sql: 'SELECT dimension, model_id, length(embedding) AS elen, summary FROM graph_nodes WHERE id = ?',
      args: ['n-vec']
    })
    expect(after.rows[0]?.dimension).toBe(4)
    expect(after.rows[0]?.model_id).toBe('mock-embed')
    expect(Number(after.rows[0]?.elen)).toBe(Number(before.rows[0]?.elen))
    expect(after.rows[0]?.summary).toBe('无新向量的回写')
  })

  it('upsertNode keeps origin=user when incoming origin is ai', async () => {
    await repo.upsertNode({
      id: 'n-user',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '手工',
      origin: 'user',
      shardMonth: '2026-03'
    })
    await repo.upsertNode({
      id: 'n-user',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '手工',
      origin: 'ai',
      shardMonth: '2026-03'
    })
    const row = await repo.getNodeById('n-user', VAULT)
    expect(row?.origin).toBe('user')
  })

  it('applyRawNode merges unique name conflict onto the file id and remaps edges', async () => {
    const { graphNodeIdForEntity } = await import('@baishou/shared')
    const stable = graphNodeIdForEntity(VAULT, 'person', '小明')
    await repo.upsertNode({
      id: 'legacy-random',
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '小明',
      aliases: ['明明'],
      shardMonth: '2026-03'
    })
    await seedEdge('e-legacy', 'legacy-random', 'legacy-random')
    await repo.applyRawNode({
      id: stable,
      vaultId: VAULT,
      nodeType: 'person',
      name: '小明',
      aliases: ['小明同学'],
      summary: '文件优先',
      props: {},
      mentionCount: 2,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      origin: 'ai',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      shardMonth: '2026-03'
    })
    expect(await repo.getNodeById('legacy-random', VAULT)).toBeNull()
    const kept = await repo.getNodeById(stable, VAULT)
    expect(kept?.name).toBe('小明')
    expect(kept?.aliases).toEqual(expect.arrayContaining(['明明', '小明同学']))
    const edge = await repo.getEdgeById('e-legacy', VAULT)
    expect(edge?.fromId).toBe(stable)
    expect(edge?.toId).toBe(stable)
  })

  it('applyRawNode keeps an existing content-addressable id when incoming is random', async () => {
    const { graphNodeIdForEntity } = await import('@baishou/shared')
    const stable = graphNodeIdForEntity(VAULT, 'person', '小明')
    await repo.upsertNode({
      id: stable,
      forceId: true,
      vaultId: VAULT,
      nodeType: 'person',
      name: '小明',
      aliases: ['张三'],
      shardMonth: '2026-03'
    })
    const result = await repo.applyRawNode({
      id: 'legacy-random',
      vaultId: VAULT,
      nodeType: 'person',
      name: '小明',
      aliases: ['小张'],
      summary: '',
      props: {},
      mentionCount: 1,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      origin: 'ai',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      shardMonth: '2026-04'
    })
    expect(result.id).toBe(stable)
    expect(result.remappedFrom).toBe('legacy-random')
    expect(await repo.getNodeById('legacy-random', VAULT)).toBeNull()
    const kept = await repo.getNodeById(stable, VAULT)
    expect(kept?.aliases).toEqual(expect.arrayContaining(['张三', '小张']))
  })

  it('should keep a discriminated applyRawNode beside the bare-name row without remapping', async () => {
    await repo.applyRawNode({
      id: 'n-bare',
      vaultId: VAULT,
      nodeType: 'person',
      name: '张三',
      aliases: [],
      summary: '',
      props: {},
      mentionCount: 1,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      origin: 'ai',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      shardMonth: '2026-03'
    })
    const result = await repo.applyRawNode({
      id: 'n-split',
      vaultId: VAULT,
      nodeType: 'person',
      name: '张三',
      aliases: [],
      summary: '',
      props: {},
      mentionCount: 1,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      origin: 'ai',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: null,
      shardMonth: '2026-03',
      discriminator: '同事'
    })
    expect(result.remappedFrom).toBeUndefined()
    expect(result.id).toBe('n-split')
    expect(await repo.getNodeById('n-bare', VAULT)).not.toBeNull()
    expect((await repo.getNodeById('n-split', VAULT))?.discriminator).toBe('同事')
  })

  it('softDeleteNode removes the node and incident edges from the table', async () => {
    await seedNode('n-a', { name: '甲' })
    await seedNode('n-b', { name: '乙' })
    await seedEdge('e-ab', 'n-a', 'n-b')
    await repo.softDeleteNode('n-a')
    expect(await repo.getNodeById('n-a', VAULT)).toBeNull()
    expect(await repo.getEdgeById('e-ab', VAULT)).toBeNull()
    expect(await repo.getNodeById('n-b', VAULT)).not.toBeNull()
    const leftoverNode = await client.execute("SELECT id FROM graph_nodes WHERE id = 'n-a'")
    const leftoverEdge = await client.execute("SELECT id FROM graph_edges WHERE id = 'e-ab'")
    expect(leftoverNode.rows).toHaveLength(0)
    expect(leftoverEdge.rows).toHaveLength(0)
  })

  it('deleteAllForVault removes only this vault and leaves the other vault', async () => {
    await seedNode('n-a', { name: '甲' })
    await seedNode('n-b', { name: '乙' })
    await seedEdge('e-ab', 'n-a', 'n-b')
    await seedNode('n-other', { vaultId: OTHER, name: '另一库' })
    await seedEdge('e-other', 'n-other', 'n-other', { vaultId: OTHER })
    await repo.deleteAllForVault(VAULT)
    expect(await repo.getNodeById('n-a', VAULT)).toBeNull()
    expect(await repo.getEdgeById('e-ab', VAULT)).toBeNull()
    expect(await repo.getNodeById('n-other', OTHER)).not.toBeNull()
    expect(await repo.getEdgeById('e-other', OTHER)).not.toBeNull()
    const leftoverAlias = await client.execute(
      `SELECT id FROM graph_node_aliases WHERE vault_id = '${VAULT}'`
    )
    expect(leftoverAlias.rows).toHaveLength(0)
  })

  it('softDeleteEdge removes the edge row', async () => {
    await seedNode('n-a', { name: '甲' })
    await seedNode('n-b', { name: '乙' })
    await seedEdge('e-ab', 'n-a', 'n-b')
    await repo.softDeleteEdge('e-ab')
    const leftover = await client.execute("SELECT id FROM graph_edges WHERE id = 'e-ab'")
    expect(leftover.rows).toHaveLength(0)
    expect(await repo.getNodeById('n-a', VAULT)).not.toBeNull()
  })

  it('applyRawNode with deletedAt removes the row instead of marking deleted_at', async () => {
    await seedNode('n-gone', { name: '将删' })
    await repo.applyRawNode({
      id: 'n-gone',
      vaultId: VAULT,
      nodeType: 'person',
      name: '将删',
      aliases: [],
      summary: '',
      props: {},
      mentionCount: 1,
      firstSeenAt: Date.now(),
      lastSeenAt: Date.now(),
      origin: 'ai',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      deletedAt: Date.now(),
      shardMonth: '2026-03'
    })
    const leftover = await client.execute("SELECT id FROM graph_nodes WHERE id = 'n-gone'")
    expect(leftover.rows).toHaveLength(0)
  })
})
