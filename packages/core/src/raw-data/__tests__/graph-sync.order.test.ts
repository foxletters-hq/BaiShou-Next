import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createRandomVaultId } from '@baishou/shared'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { GraphRawManager } from '../managers/graph.raw-manager'
import { GraphSyncService } from '../graph-sync.service'
import type { IStoragePathService } from '../../vault/storage-path.types'
import type { GraphRepository } from '@baishou/database'

function nodeRecord(opts: { id: string; vaultId: string; name: string; now: number; shardMonth?: string }) {
  return {
    id: opts.id,
    schemaVersion: 1 as const,
    vaultId: opts.vaultId,
    vaultName: 'Personal',
    nodeType: 'person',
    name: opts.name,
    aliases: [] as string[],
    summary: '',
    props: {},
    mentionCount: 1,
    firstSeenAt: opts.now,
    lastSeenAt: opts.now,
    origin: 'ai' as const,
    shardMonth: opts.shardMonth ?? '2026-07',
    createdAt: opts.now,
    updatedAt: opts.now,
    deletedAt: null,
    reviewStatus: 'pending' as const
  }
}

describe('GraphSyncService write→index order', () => {
  let tmpDir: string
  let graphManager: GraphRawManager

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-sync-'))
    const freshness = new DerivedFreshnessService()
    const pathService = {
      getGraphBaseDirectory: async () => path.join(tmpDir, 'Graph')
    } as unknown as IStoragePathService
    graphManager = new GraphRawManager(pathService, new NodeFileSystem(), freshness)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
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
    expect(applyRawNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1', name: 'Anson', vaultId }))
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
    const listLiveEdgeRefs = vi.fn().mockResolvedValue([
      { id: 'e-unseen', shardMonth: '2026-01' }
    ])
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

    await new GraphSyncService(graphManager, repo, { embedQuery, modelId: 'embed-v1' }).syncPendingIndex({
      absentSweep: 'off'
    })
    expect(embedQuery).not.toHaveBeenCalled()
    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', embedding: undefined, modelId: 'embed-v1' })
    )
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
