import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createRandomVaultId, deriveLegacyVaultId } from '@baishou/shared'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { GraphRawManager } from '../managers/graph.raw-manager'
import { GraphSyncService } from '../graph-sync.service'
import type { IStoragePathService } from '../../vault/storage-path.types'
import type { GraphRepository } from '@baishou/database'

/**
 * P0：随机 ID 仓库审核写回必须带 vaultId，否则 sync 跳过该行且不会用名字派生仓删除本仓。
 */
describe('graph review vaultId preservation', () => {
  let tmpDir: string
  let graphManager: GraphRawManager

  beforeEach(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'graph-review-vault-'))
    const freshness = new DerivedFreshnessService()
    const pathService = {
      getGraphBaseDirectory: async () => path.join(tmpDir, 'Graph')
    } as unknown as IStoragePathService
    graphManager = new GraphRawManager(pathService, new NodeFileSystem(), freshness)
  })

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true })
  })

  it('随机 ID 仓：审核写入带 vaultId 后同步仍属原仓', async () => {
    const randomId = createRandomVaultId()
    const displayName = 'TravelNotes'
    expect(deriveLegacyVaultId(displayName)).not.toBe(randomId)

    const now = Date.now()
    await graphManager.writeRecord(
      {
        id: 'n-pending',
        schemaVersion: 1,
        vaultId: randomId,
        vaultName: displayName,
        nodeType: 'person',
        name: '小明',
        aliases: [],
        summary: '',
        props: {},
        mentionCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        origin: 'ai',
        shardMonth: '2026-07',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        reviewStatus: 'pending'
      },
      { collection: 'nodes' }
    )

    const applyRawNode = vi.fn().mockResolvedValue(undefined)
    const repo = {
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn().mockResolvedValue(['n-pending']),
      listEdgeIds: vi.fn().mockResolvedValue([]),
      listLiveNodeRefs: vi.fn().mockResolvedValue([{ id: 'n-pending', shardMonth: '2026-07' }]),
      listLiveEdgeRefs: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    const sync = new GraphSyncService(graphManager, repo, null)
    await sync.syncPendingIndex()

    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n-pending', vaultId: randomId, reviewStatus: 'pending' })
    )

    await graphManager.writeRecord(
      {
        id: 'n-pending',
        schemaVersion: 1,
        vaultId: randomId,
        vaultName: displayName,
        nodeType: 'person',
        name: '小明',
        aliases: [],
        summary: '',
        props: {},
        mentionCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        origin: 'ai',
        shardMonth: '2026-07',
        createdAt: now,
        updatedAt: now + 1,
        deletedAt: null,
        reviewStatus: 'approved'
      },
      { collection: 'nodes' }
    )

    applyRawNode.mockClear()
    await sync.syncPendingIndex()

    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n-pending', vaultId: randomId, reviewStatus: 'approved' })
    )
    expect(applyRawNode).not.toHaveBeenCalledWith(
      expect.objectContaining({ vaultId: deriveLegacyVaultId(displayName) })
    )
  })

  it('缺少 vaultId 的写回会被跳过，不会落到名字派生仓', async () => {
    const displayName = 'TravelNotes'
    const now = Date.now()

    await graphManager.writeRecord(
      {
        id: 'n-bug',
        schemaVersion: 1,
        vaultName: displayName,
        nodeType: 'person',
        name: '小红',
        aliases: [],
        summary: '',
        props: {},
        mentionCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        origin: 'ai',
        shardMonth: '2026-07',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        reviewStatus: 'approved'
      } as never,
      { collection: 'nodes' }
    )

    const applyRawNode = vi.fn().mockResolvedValue(undefined)
    const softDeleteNode = vi.fn()
    const listNodeIds = vi.fn().mockResolvedValue(['sqlite-live'])
    const listLiveNodeRefs = vi.fn()
    const repo = {
      applyRawNode,
      softDeleteNode,
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds,
      listEdgeIds: vi.fn().mockResolvedValue([]),
      listLiveNodeRefs,
      listLiveEdgeRefs: vi.fn()
    } as unknown as GraphRepository

    const result = await new GraphSyncService(graphManager, repo, null).syncPendingIndex()

    expect(result.skippedNoVaultId).toBeGreaterThanOrEqual(1)
    expect(applyRawNode).not.toHaveBeenCalled()
    expect(applyRawNode).not.toHaveBeenCalledWith(
      expect.objectContaining({ vaultId: deriveLegacyVaultId(displayName) })
    )
    expect(listNodeIds).not.toHaveBeenCalled()
    expect(listLiveNodeRefs).not.toHaveBeenCalled()
    expect(softDeleteNode).not.toHaveBeenCalled()
  })
})
