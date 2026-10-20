import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRandomVaultId, graphNodeCardText } from '@baishou/shared'
import { GraphSyncService } from '../graph-sync.service'
import type { GraphRepository } from '@baishou/database'
import { createGraphSyncHarness, nodeRecord } from './graph-sync.test-helpers'

describe('GraphSyncService write→index order', () => {
  let graphManager: Awaited<ReturnType<typeof createGraphSyncHarness>>['graphManager']
  let cleanup: () => Promise<void>

  beforeEach(async () => {
    const harness = await createGraphSyncHarness()
    graphManager = harness.graphManager
    cleanup = harness.cleanup
  })

  afterEach(async () => {
    await cleanup()
  })

  it('skips embedQuery when the live node already has the same modelId', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(nodeRecord({ id: 'n1', vaultId, name: 'Anson', now }), {
      collection: 'nodes'
    })
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue({
        id: 'n1',
        name: 'Anson',
        aliases: [],
        summary: '',
        shardMonth: '2026-07',
        modelId: 'embed-v1',
        dimension: 2
      }),
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([{ id: 'n1', shardMonth: '2026-07' }]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({
      absentSweep: 'off'
    })
    expect(embedQuery).not.toHaveBeenCalled()
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', embedding: undefined, modelId: 'embed-v1' })
    )
  })

  it('should re-embed when the live node summary changed the card', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(
      nodeRecord({ id: 'n1', vaultId, name: 'Anson', now, summary: '同事' }),
      { collection: 'nodes' }
    )
    const embedQuery = vi.fn().mockResolvedValue([0.3, 0.4])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue({
        id: 'n1',
        name: 'Anson',
        aliases: [],
        summary: '',
        shardMonth: '2026-07',
        modelId: 'embed-v1',
        dimension: 2
      }),
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([{ id: 'n1', shardMonth: '2026-07' }]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({ absentSweep: 'off' })

    expect(embedQuery).toHaveBeenCalledTimes(1)
    expect(embedQuery).toHaveBeenCalledWith(graphNodeCardText('Anson', '同事'))
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', embedding: [0.3, 0.4], modelId: 'embed-v1' })
    )
  })

  it('should re-embed when the live node name changed the card', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(nodeRecord({ id: 'n1', vaultId, name: 'Tony', now }), {
      collection: 'nodes'
    })
    const embedQuery = vi.fn().mockResolvedValue([0.5, 0.6])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue({
        id: 'n1',
        name: 'Anson',
        aliases: [],
        summary: '',
        shardMonth: '2026-07',
        modelId: 'embed-v1',
        dimension: 2
      }),
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([{ id: 'n1', shardMonth: '2026-07' }]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({ absentSweep: 'off' })

    expect(embedQuery).toHaveBeenCalledTimes(1)
    expect(embedQuery).toHaveBeenCalledWith(graphNodeCardText('Tony', ''))
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', embedding: [0.5, 0.6], modelId: 'embed-v1' })
    )
  })

  it('should skip embedQuery when only aliases changed', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(
      nodeRecord({ id: 'n1', vaultId, name: 'Anson', now, aliases: ['Tony'] }),
      { collection: 'nodes' }
    )
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue({
        id: 'n1',
        name: 'Anson',
        aliases: [],
        summary: '',
        shardMonth: '2026-07',
        modelId: 'embed-v1',
        dimension: 2
      }),
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([{ id: 'n1', shardMonth: '2026-07' }]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({ absentSweep: 'off' })

    expect(embedQuery).not.toHaveBeenCalled()
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', embedding: undefined, modelId: 'embed-v1' })
    )
  })

  it('uses a precomputed embedding when the card text matches', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(nodeRecord({ id: 'n1', vaultId, name: 'Anson', now }), {
      collection: 'nodes'
    })
    const embedQuery = vi.fn().mockResolvedValue([0.1, 0.2])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue(null),
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([{ id: 'n1', shardMonth: '2026-07' }]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({
      absentSweep: 'off',
      precomputedNodeEmbeddings: new Map([
        ['n1', { embedding: [1, 0], text: graphNodeCardText('Anson', '') }]
      ])
    })
    expect(embedQuery).not.toHaveBeenCalled()
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', embedding: [1, 0] })
    )
  })

  it('should fall back to embedQuery when the precomputed card text does not match', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(nodeRecord({ id: 'n1', vaultId, name: 'Anson', now }), {
      collection: 'nodes'
    })
    const embedQuery = vi.fn().mockResolvedValue([0.3, 0.4])
    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      getNodeById: vi.fn().mockResolvedValue(null),
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([{ id: 'n1', shardMonth: '2026-07' }]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, {
      embedQuery,
      modelId: 'embed-v1'
    }).syncPendingIndex({
      absentSweep: 'off',
      precomputedNodeEmbeddings: new Map([['n1', { embedding: [9, 9], text: '别人\n不对' }]])
    })
    expect(embedQuery).toHaveBeenCalledTimes(1)
    expect(embedQuery).toHaveBeenCalledWith(graphNodeCardText('Anson', ''))
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', embedding: [0.3, 0.4] })
    )
    expect(applyRawNode).not.toHaveBeenCalledWith(expect.objectContaining({ embedding: [9, 9] }))
  })
})
