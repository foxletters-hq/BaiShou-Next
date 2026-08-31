import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient, type Client } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { GraphRepository } from '../graph.repository'
import {
  GRAPH_EDGES_CREATE_SQL,
  GRAPH_INDEXES_SQL,
  GRAPH_NODE_ALIASES_CREATE_SQL,
  GRAPH_NODES_CREATE_SQL
} from '../../agent-schema-compat'

const VAULT = 'vlt_aaaaaaaaaaaaaaaa'
const OTHER = 'vlt_bbbbbbbbbbbbbbbb'

describe('GraphRepository keyed queries', () => {
  let client: Client
  let repo: GraphRepository

  async function seedNode(
    id: string,
    opts: {
      vaultId?: string
      nodeType?: string
      name: string
      aliases?: string[]
      mentionCount?: number
      shardMonth?: string
      reviewStatus?: 'approved' | 'pending' | 'rejected'
    }
  ) {
    await repo.upsertNode({
      id,
      forceId: true,
      vaultId: opts.vaultId ?? VAULT,
      nodeType: opts.nodeType ?? 'person',
      name: opts.name,
      aliases: opts.aliases ?? [],
      mentionCount: opts.mentionCount ?? 1,
      shardMonth: opts.shardMonth ?? '2026-03',
      reviewStatus: opts.reviewStatus ?? 'approved'
    })
  }

  async function seedEdge(
    id: string,
    fromId: string,
    toId: string,
    opts?: { shardMonth?: string; vaultId?: string }
  ) {
    await repo.upsertEdge({
      id,
      vaultId: opts?.vaultId ?? VAULT,
      fromId,
      toId,
      edgeType: 'relates_to',
      shardMonth: opts?.shardMonth ?? '2026-03',
      isCurrent: true,
      sourceKind: 'diary',
      sourceRef: '2026-03-15',
      origin: 'ai',
      reviewStatus: 'approved'
    })
  }

  beforeEach(async () => {
    client = createClient({ url: ':memory:' })
    await client.execute(GRAPH_NODES_CREATE_SQL)
    await client.execute(GRAPH_NODE_ALIASES_CREATE_SQL)
    await client.execute(GRAPH_EDGES_CREATE_SQL)
    for (const sql of GRAPH_INDEXES_SQL) await client.execute(sql)
    repo = new GraphRepository(drizzle(client) as never)
  })

  afterEach(() => {
    client.close()
  })

  it('findNodeByNameOrAlias uses equality on name_normalized / alias table', async () => {
    await seedNode('n-ming', { name: '小明', aliases: ['小明同学'], mentionCount: 3 })
    await seedNode('n-other-vault', { vaultId: OTHER, name: '小明' })

    const byName = await repo.findNodeByNameOrAlias(VAULT, '  小明  ', 'person')
    expect(byName?.id).toBe('n-ming')

    const byAlias = await repo.findNodeByNameOrAlias(VAULT, '小明同学', 'person')
    expect(byAlias?.id).toBe('n-ming')

    const partial = await repo.findNodeByNameOrAlias(VAULT, '明', 'person')
    expect(partial).toBeNull()

    const otherType = await repo.findNodeByNameOrAlias(VAULT, '小明', 'place')
    expect(otherType).toBeNull()

    const otherVault = await repo.findNodeByNameOrAlias(OTHER, '小明', 'person')
    expect(otherVault?.id).toBe('n-other-vault')
  })

  it('untyped findNodeByNameOrAlias is equality-only and fail-closed across types', async () => {
    await seedNode('n-ming', { name: '小明', aliases: ['小明同学'] })
    await seedNode('n-similar', { name: '小明哥' })
    expect((await repo.findNodeByNameOrAlias(VAULT, '小明'))?.id).toBe('n-ming')
    expect((await repo.findNodeByNameOrAlias(VAULT, '小明同学'))?.id).toBe('n-ming')
    expect(await repo.findNodeByNameOrAlias(VAULT, '明')).toBeNull()

    await seedNode('p-apple', { name: '苹果', nodeType: 'person' })
    await seedNode('t-apple', { name: '苹果', nodeType: 'topic' })
    expect(await repo.findNodeByNameOrAlias(VAULT, '苹果')).toBeNull()
    expect((await repo.findNodeByNameOrAlias(VAULT, '苹果', 'person'))?.id).toBe('p-apple')
  })

  it('getGlobalGraph filters shard_month in SQL and ignores other months', async () => {
    await seedNode('n-a', { name: '甲', shardMonth: '2026-03' })
    await seedNode('n-b', { name: '乙', shardMonth: '2026-03' })
    await seedNode('n-c', { name: '丙', shardMonth: '2026-08' })
    await seedEdge('e-mar', 'n-a', 'n-b', { shardMonth: '2026-03' })
    await seedEdge('e-aug', 'n-b', 'n-c', { shardMonth: '2026-08' })

    const march = await repo.getGlobalGraph({
      vaultId: VAULT,
      monthRange: { startMonth: '2026-03', endMonth: '2026-03' },
      maxNodes: 200
    })
    expect(march.edges.map((e) => e.id)).toEqual(['e-mar'])
    expect(march.nodes.map((n) => n.id).sort()).toEqual(['n-a', 'n-b'])

    const all = await repo.getGlobalGraph({
      vaultId: VAULT,
      monthRange: { startMonth: '2026-03', endMonth: '2026-08' },
      maxNodes: 200
    })
    expect(all.edges.map((e) => e.id).sort()).toEqual(['e-aug', 'e-mar'])
  })

  it('getGlobalGraph includes isolated pending nodes in the month window', async () => {
    await seedNode('n-a', { name: '甲', shardMonth: '2026-03' })
    await seedNode('n-b', { name: '乙', shardMonth: '2026-03' })
    await seedNode('n-pending-alone', {
      name: '待审孤点',
      shardMonth: '2026-03',
      reviewStatus: 'pending'
    })
    await seedNode('n-pending-aug', {
      name: '八月待审',
      shardMonth: '2026-08',
      reviewStatus: 'pending'
    })
    await seedEdge('e-mar', 'n-a', 'n-b', { shardMonth: '2026-03' })

    const march = await repo.getGlobalGraph({
      vaultId: VAULT,
      monthRange: { startMonth: '2026-03', endMonth: '2026-03' },
      maxNodes: 200
    })
    expect(march.edges.map((e) => e.id)).toEqual(['e-mar'])
    expect(march.nodes.map((n) => n.id).sort()).toEqual(['n-a', 'n-b', 'n-pending-alone'])
  })

  it('getGlobalGraph returns isolated pending nodes when the month has no edges', async () => {
    await seedNode('n-pending', {
      name: '孤点',
      shardMonth: '2026-03',
      reviewStatus: 'pending'
    })
    const march = await repo.getGlobalGraph({
      vaultId: VAULT,
      monthRange: { startMonth: '2026-03', endMonth: '2026-03' },
      maxNodes: 200
    })
    expect(march.nodes.map((n) => n.id)).toEqual(['n-pending'])
    expect(march.edges).toEqual([])
  })

  it('getGlobalGraph keeps pending month-window nodes after maxNodes slice', async () => {
    for (let i = 0; i < 5; i++) {
      await seedNode(`n-${i}a`, { name: `甲${i}`, shardMonth: '2026-03', mentionCount: 10 })
      await seedNode(`n-${i}b`, { name: `乙${i}`, shardMonth: '2026-03', mentionCount: 10 })
      await seedEdge(`e-${i}`, `n-${i}a`, `n-${i}b`, { shardMonth: '2026-03' })
    }
    await seedNode('n-pending', {
      name: '待审',
      shardMonth: '2026-03',
      reviewStatus: 'pending'
    })
    const graph = await repo.getGlobalGraph({
      vaultId: VAULT,
      monthRange: { startMonth: '2026-03', endMonth: '2026-03' },
      maxNodes: 4
    })
    expect(graph.nodes.some((n) => n.id === 'n-pending')).toBe(true)
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

  it('getGlobalGraph applies type filter before mention LIMIT', async () => {
    await seedNode('t-hot', { name: '热门主题', nodeType: 'topic', mentionCount: 99 })
    await seedNode('p-cold', { name: '冷门人物', nodeType: 'person', mentionCount: 1 })
    const graph = await repo.getGlobalGraph({
      vaultId: VAULT,
      nodeTypes: ['person'],
      maxNodes: 1
    })
    expect(graph.nodes.map((n) => n.id)).toEqual(['p-cold'])
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
