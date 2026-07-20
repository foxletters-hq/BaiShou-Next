import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { GraphRawManager } from '../managers/graph.raw-manager'
import { GraphSyncService } from '../graph-sync.service'
import type { IStoragePathService } from '../../vault/storage-path.types'
import type { GraphRepository } from '@baishou/database'

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
    const now = Date.now()
    await graphManager.writeRecord(
      {
        id: 'n1',
        schemaVersion: 1,
        vaultName: 'Personal',
        nodeType: 'person',
        name: 'Anson',
        aliases: [],
        summary: '',
        props: {},
        mentionCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        origin: 'ai',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        reviewStatus: 'pending'
      },
      { collection: 'nodes' }
    )

    const applyRawNode = vi.fn().mockResolvedValue(undefined)
    const softDeleteNode = vi.fn()
    const applyRawEdge = vi.fn()
    const softDeleteEdge = vi.fn()
    const listNodeIds = vi.fn().mockResolvedValue(['n1', 'orphan'])
    const listEdgeIds = vi.fn().mockResolvedValue([])
    const repo = {
      applyRawNode,
      softDeleteNode,
      applyRawEdge,
      softDeleteEdge,
      listNodeIds,
      listEdgeIds
    } as unknown as GraphRepository

    const sync = new GraphSyncService(graphManager, repo, null)
    const result = await sync.syncPendingIndex()

    expect(result.nodesUpserted).toBe(1)
    expect(applyRawNode).toHaveBeenCalledWith(expect.objectContaining({ id: 'n1', name: 'Anson' }))
    expect(listNodeIds).toHaveBeenCalledWith('Personal')
    expect(softDeleteNode).toHaveBeenCalledWith('orphan')
    expect(result.deleted).toBe(1)
    expect(await graphManager.listPendingIndex('nodes')).toHaveLength(0)
  })

  it('orphan-scans even when pending-index is empty', async () => {
    const now = Date.now()
    const written = await graphManager.writeRecord(
      {
        id: 'n1',
        schemaVersion: 1,
        vaultName: 'Personal',
        nodeType: 'person',
        name: 'Anson',
        aliases: [],
        summary: '',
        props: {},
        mentionCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        origin: 'ai',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        reviewStatus: 'pending'
      },
      { collection: 'nodes' }
    )
    await graphManager.commitIndexed('nodes', written.relativePath, written.contentHash)

    const softDeleteNode = vi.fn().mockResolvedValue(undefined)
    const softDeleteEdge = vi.fn().mockResolvedValue(undefined)
    const listNodeIds = vi.fn().mockResolvedValue(['n1', 'ghost'])
    const listEdgeIds = vi.fn().mockResolvedValue(['e-orphan'])
    const repo = {
      applyRawNode: vi.fn(),
      softDeleteNode,
      applyRawEdge: vi.fn(),
      softDeleteEdge,
      listNodeIds,
      listEdgeIds
    } as unknown as GraphRepository

    const sync = new GraphSyncService(graphManager, repo, null)
    const result = await sync.syncPendingIndex()

    expect(result.shards).toBe(0)
    expect(listNodeIds).toHaveBeenCalledWith('Personal')
    expect(listEdgeIds).toHaveBeenCalledWith('Personal')
    expect(softDeleteNode).toHaveBeenCalledWith('ghost')
    expect(softDeleteEdge).toHaveBeenCalledWith('e-orphan')
    expect(result.deleted).toBe(2)
  })
})
