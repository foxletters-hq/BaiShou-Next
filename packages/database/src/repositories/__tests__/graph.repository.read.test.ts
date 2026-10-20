import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import type { GraphRepository } from '../graph.repository'
import {
  OTHER,
  VAULT,
  createGraphFixture,
  disposeGraphFixture,
  type GraphFixture
} from './graph.repository.test-helpers'

describe('GraphRepository graph reads', () => {
  let fixture: GraphFixture
  let repo: GraphRepository
  let seedNode: GraphFixture['seedNode']
  let seedEdge: GraphFixture['seedEdge']

  beforeEach(async () => {
    fixture = await createGraphFixture()
    repo = fixture.repo
    seedNode = fixture.seedNode
    seedEdge = fixture.seedEdge
  })

  afterEach(() => {
    disposeGraphFixture(fixture)
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

  it('getGlobalGraph returns every month-window node when maxNodes is unlimited', async () => {
    for (let i = 0; i < 6; i++) {
      await seedNode(`unlim-${i}`, { name: `点${i}`, shardMonth: '2026-03', mentionCount: 10 })
    }
    const graph = await repo.getGlobalGraph({
      vaultId: VAULT,
      monthRange: { startMonth: '2026-03', endMonth: '2026-03' },
      maxNodes: -1
    })
    expect(graph.nodes).toHaveLength(6)
  })

  it('getGlobalGraph returns every connected month-window node when maxNodes is unlimited', async () => {
    for (let i = 0; i < 6; i++) {
      await seedNode(`unlim-a-${i}`, { name: `甲${i}`, shardMonth: '2026-03', mentionCount: 10 })
      await seedNode(`unlim-b-${i}`, { name: `乙${i}`, shardMonth: '2026-03', mentionCount: 10 })
      await seedEdge(`unlim-e-${i}`, `unlim-a-${i}`, `unlim-b-${i}`, { shardMonth: '2026-03' })
    }
    const graph = await repo.getGlobalGraph({
      vaultId: VAULT,
      monthRange: { startMonth: '2026-03', endMonth: '2026-03' },
      maxNodes: -1
    })
    expect(graph.nodes).toHaveLength(12)
    expect(graph.edges).toHaveLength(6)
  })

  it('getGlobalGraph returns every node without a month range when maxNodes is unlimited', async () => {
    for (let i = 0; i < 6; i++) {
      await seedNode(`unlim-g-${i}`, { name: `全${i}`, mentionCount: 10 })
    }
    const graph = await repo.getGlobalGraph({ vaultId: VAULT, maxNodes: -1 })
    expect(graph.nodes).toHaveLength(6)
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

  it('listPendingGraph includes approved endpoint names for pending edges', async () => {
    await seedNode('n-from', { name: '海边小屋', reviewStatus: 'approved' })
    await seedNode('n-to', { name: '小明', reviewStatus: 'approved' })
    await seedNode('n-pending', { name: '待审人', reviewStatus: 'pending' })
    await seedNode('n-other-vault', { vaultId: OTHER, name: '别馆节点' })
    await seedEdge('e-pending', 'n-from', 'n-to', { reviewStatus: 'pending' })
    await seedEdge('e-approved', 'n-from', 'n-pending', { reviewStatus: 'approved' })

    const pending = await repo.listPendingGraph(VAULT)
    expect(pending.edges.map((edge) => edge.id)).toEqual(['e-pending'])
    expect(pending.nodes.map((node) => node.id)).toEqual(['n-pending'])
    expect(pending.endpointNodes.map((node) => node.name).sort()).toEqual(['小明', '海边小屋'])
    expect(pending.endpointNodes.some((node) => node.id === 'n-other-vault')).toBe(false)
  })

  it('should page live nodes across months and hide rejected rows', async () => {
    await seedNode('n-old', {
      name: '两年前的人',
      shardMonth: '2024-01',
      mentionCount: 9,
      discriminator: '同事'
    })
    await seedNode('n-new', { name: '最近的人', shardMonth: '2026-09', mentionCount: 2 })
    await seedNode('n-rejected', {
      name: '已拒绝',
      shardMonth: '2026-09',
      reviewStatus: 'rejected',
      mentionCount: 20
    })
    await seedEdge('e-old', 'n-old', 'n-new', { shardMonth: '2024-01' })
    await seedEdge('e-rej', 'n-old', 'n-rejected', {
      shardMonth: '2026-09',
      reviewStatus: 'rejected'
    })

    const page = await repo.listLiveNodesPage(VAULT, { limit: 1, offset: 0 })
    expect(page.map((row) => row.id)).toEqual(['n-old'])
    expect(page[0]?.discriminator).toBe('同事')
    const second = await repo.listLiveNodesPage(VAULT, { limit: 1, offset: 1 })
    expect(second.map((row) => row.id)).toEqual(['n-new'])
    expect(await repo.countLiveNodes(VAULT)).toBe(2)
    expect(await repo.countLiveCurrentEdges(VAULT)).toBe(1)

    const keyed = await repo.listLiveNodesPage(VAULT, { keyword: '同事', limit: 10, offset: 0 })
    expect(keyed.map((row) => row.id)).toEqual(['n-old'])
    expect(await repo.countLiveNodes(VAULT, '同事')).toBe(1)
  })
})
