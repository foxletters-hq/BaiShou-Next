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

  it('applies file rows to repo then commits indexed', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(nodeRecord({ id: 'n1', vaultId, name: 'Anson', now }), {
      collection: 'nodes'
    })

    const applyRawNode = vi.fn().mockResolvedValue(undefined)
    const softDeleteNode = vi.fn()
    const listLiveNodeRefs = vi.fn().mockResolvedValue([
      { id: 'n1', shardMonth: '2026-07' },
      { id: 'orphan', shardMonth: '2026-07' }
    ])
    const listLiveEdgeRefs = vi.fn().mockResolvedValue([])
    const repo = {
      applyRawNode,
      softDeleteNode,
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs,
      listLiveEdgeRefs
    } as unknown as GraphRepository

    const sync = new GraphSyncService(graphManager, repo, null)
    const result = await sync.syncPendingIndex()

    expect(result.nodesUpserted).toBe(1)
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', name: 'Anson', vaultId })
    )
    expect(listLiveNodeRefs).toHaveBeenCalledWith(vaultId)
    expect(softDeleteNode).toHaveBeenCalledWith('orphan')
    expect(result.deleted).toBe(1)
    expect(await graphManager.listPendingIndex('nodes')).toHaveLength(0)
  })

  it('skips rows without vaultId and does not orphan-delete via name-derived id', async () => {
    const now = Date.now()
    await graphManager.writeRecord(
      {
        ...nodeRecord({ id: 'n-bug', vaultId: '', name: '小红', now }),
        vaultId: undefined
      } as never,
      { collection: 'nodes' }
    )

    const applyRawNode = vi.fn().mockResolvedValue(undefined)
    const softDeleteNode = vi.fn()
    const listLiveNodeRefs = vi.fn()
    const repo = {
      applyRawNode,
      softDeleteNode,
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs,
      listLiveEdgeRefs: vi.fn()
    } as unknown as GraphRepository

    const result = await new GraphSyncService(graphManager, repo, null).syncPendingIndex()

    expect(result.skippedNoVaultId).toBeGreaterThanOrEqual(1)
    expect(applyRawNode).not.toHaveBeenCalled()
    expect(listLiveNodeRefs).not.toHaveBeenCalled()
    expect(softDeleteNode).not.toHaveBeenCalled()
  })

  it('absence-deletes ghosts only when their shard file is present', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    const written = await graphManager.writeRecord(
      nodeRecord({ id: 'n1', vaultId, name: 'Anson', now }),
      { collection: 'nodes' }
    )
    await graphManager.commitIndexed('nodes', written.relativePath, written.contentHash)

    const softDeleteNode = vi.fn().mockResolvedValue(undefined)
    const softDeleteEdge = vi.fn().mockResolvedValue(undefined)
    const listLiveNodeRefs = vi.fn().mockResolvedValue([
      { id: 'n1', shardMonth: '2026-07' },
      { id: 'ghost-present', shardMonth: '2026-07' },
      { id: 'ghost-unseen', shardMonth: '2026-01' }
    ])
    const listLiveEdgeRefs = vi.fn().mockResolvedValue([{ id: 'e-unseen', shardMonth: '2026-01' }])
    const repo = {
      applyRawNode: vi.fn(),
      softDeleteNode,
      applyRawEdge: vi.fn(),
      softDeleteEdge,
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs,
      listLiveEdgeRefs
    } as unknown as GraphRepository

    const result = await new GraphSyncService(graphManager, repo, null).syncPendingIndex()

    expect(result.shards).toBe(0)
    expect(softDeleteNode).toHaveBeenCalledWith('ghost-present')
    expect(softDeleteNode).not.toHaveBeenCalledWith('ghost-unseen')
    expect(softDeleteEdge).not.toHaveBeenCalled()
    expect(result.deleted).toBe(1)
  })

  it('treats deletedLocal shard paths as present-and-empty', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    const written = await graphManager.writeRecord(
      nodeRecord({ id: 'n1', vaultId, name: 'Anson', now }),
      { collection: 'nodes' }
    )
    await graphManager.commitIndexed('nodes', written.relativePath, written.contentHash)

    const softDeleteNode = vi.fn().mockResolvedValue(undefined)
    const repo = {
      applyRawNode: vi.fn(),
      softDeleteNode,
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([
        { id: 'n1', shardMonth: '2026-07' },
        { id: 'ghost-deleted-month', shardMonth: '2026-01' }
      ]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    const result = await new GraphSyncService(graphManager, repo, null).syncPendingIndex({
      vaultId,
      deletedShardPaths: ['Graph/nodes/2026-01.jsonl']
    })

    expect(softDeleteNode).toHaveBeenCalledWith('ghost-deleted-month')
    expect(result.deleted).toBe(1)
  })

  it('applying one month does not delete nodes that still live in another month', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(
      nodeRecord({ id: 'jan', vaultId, name: '一月', now, shardMonth: '2026-01' }),
      { collection: 'nodes' }
    )
    const july = await graphManager.writeRecord(
      nodeRecord({ id: 'jul', vaultId, name: '七月', now, shardMonth: '2026-07' }),
      { collection: 'nodes' }
    )
    await graphManager.commitIndexed('nodes', july.relativePath, july.contentHash)

    const softDeleteNode = vi.fn().mockResolvedValue(undefined)
    const repo = {
      applyRawNode: vi.fn(),
      softDeleteNode,
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([
        { id: 'jan', shardMonth: '2026-01' },
        { id: 'jul', shardMonth: '2026-07' }
      ]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, null).syncPendingIndex()
    expect(softDeleteNode).not.toHaveBeenCalledWith('jan')
    expect(softDeleteNode).not.toHaveBeenCalledWith('jul')
  })

  it('skips absence sweep when absentSweep is off', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(nodeRecord({ id: 'n1', vaultId, name: 'Anson', now }), {
      collection: 'nodes'
    })
    const listLiveNodeRefs = vi.fn()
    const repo = {
      applyRawNode: vi.fn(),
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs,
      listLiveEdgeRefs: vi.fn()
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, null).syncPendingIndex({ absentSweep: 'off' })
    expect(listLiveNodeRefs).not.toHaveBeenCalled()
  })

  it('should not skip batch upsert when origin=user raw node removes stale aliases on existing row with same updatedAt', async () => {
    const vaultId = createRandomVaultId()
    const now = Date.now()
    await graphManager.writeRecord(
      {
        ...nodeRecord({ id: 'n-alias-fix', vaultId, name: '小李', now, shardMonth: '2026-07' }),
        aliases: ['李某'],
        origin: 'user',
        updatedAt: now
      },
      { collection: 'nodes' }
    )

    const existingRow = {
      id: 'n-alias-fix',
      vaultId,
      nodeType: 'person',
      name: '小李',
      nameNormalized: '小李',
      discriminator: '',
      aliases: ['小李', '李某', '被删掉的旧别名'],
      summary: '',
      propsJson: '{}',
      mentionCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      origin: 'user' as const,
      shardMonth: '2026-07',
      reviewStatus: 'approved' as const,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      embedding: null,
      dimension: null,
      modelId: null
    }

    const applyRawNodesBatch = vi.fn().mockResolvedValue([{ id: 'n-alias-fix' }])
    const repo = {
      getNodesByIds: vi.fn().mockResolvedValue(new Map([['n-alias-fix', existingRow]])),
      applyRawNodesBatch,
      applyRawNode: vi.fn(),
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn(),
      listEdgeIds: vi.fn(),
      listLiveNodeRefs: vi.fn().mockResolvedValue([]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    const result = await new GraphSyncService(graphManager, repo, null).syncPendingIndex({
      absentSweep: 'off'
    })

    expect(result.nodesUpserted).toBe(1)
    expect(applyRawNodesBatch).toHaveBeenCalledTimes(1)
  })
})
