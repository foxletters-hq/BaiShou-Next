import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRandomVaultId } from '@baishou/shared'
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

  it('unique-index loser is removed from the month shard without deletedAt', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    const loser = await graphManager.writeRecord(
      nodeRecord({ id: 'n-loser', vaultId, name: '同名', now }),
      { collection: 'nodes' }
    )
    await graphManager.commitIndexed('nodes', loser.relativePath, loser.contentHash)
    await graphManager.writeRecord(
      nodeRecord({ id: 'n-winner', vaultId, name: '同名', now: now + 1 }),
      { collection: 'nodes' }
    )

    const tombstone = vi.spyOn(graphManager, 'tombstone')
    const applyRawNode = vi.fn().mockResolvedValue({
      id: 'n-winner',
      remappedFrom: 'n-loser',
      remappedFromShardMonth: '2026-07',
      writeBackSurvivor: true
    })
    const repo = {
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn(),
      listLiveEdgeRefs: vi.fn()
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, null).syncPendingIndex({ absentSweep: 'off' })

    const rows = await graphManager.readCollapsedNodes('2026-07')
    expect(rows.map((r) => r.id)).toEqual(['n-winner'])
    expect(rows.some((r) => r.deletedAt != null)).toBe(false)
    expect(tombstone).not.toHaveBeenCalled()
    expect(await graphManager.listPendingIndex('nodes')).toHaveLength(0)
  })

  it('empty sqlite force-rescans shards that another device already marked indexed', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    const written = await graphManager.writeRecord(
      nodeRecord({ id: 'n1', vaultId, name: 'Anson', now }),
      { collection: 'nodes' }
    )
    await graphManager.commitIndexed('nodes', written.relativePath, written.contentHash)
    expect(await graphManager.listPendingIndex('nodes')).toHaveLength(0)

    const applyRawNode = vi.fn().mockResolvedValue({ id: 'n1' })
    const repo = {
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    const result = await new GraphSyncService(graphManager, repo, null).syncPendingIndex({
      vaultId
    })
    expect(applyRawNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1', vaultId }))
    expect(result.nodesUpserted).toBe(1)
  })
})
