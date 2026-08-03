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
 * P0：随机 ID 仓库审核写回必须带 vaultId，否则 sync 会用名字派生成另一仓。
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
    // Sanity: name-derived id must differ from the random vault id.
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
      listEdgeIds: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    const sync = new GraphSyncService(graphManager, repo, null)
    await sync.syncPendingIndex()

    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n-pending', vaultId: randomId, reviewStatus: 'pending' })
    )

    // Simulate desktop review write that preserves vaultId (fixed path).
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
    // Must NOT fall back to name-derived id.
    expect(applyRawNode).not.toHaveBeenCalledWith(
      expect.objectContaining({ vaultId: deriveLegacyVaultId(displayName) })
    )
  })

  it('缺少 vaultId 的审核写回会落到名字派生仓（对照回归）', async () => {
    const randomId = createRandomVaultId()
    const displayName = 'TravelNotes'
    const now = Date.now()

    await graphManager.writeRecord(
      {
        id: 'n-bug',
        schemaVersion: 1,
        vaultName: displayName,
        // intentionally omit vaultId — old desktop review path
        nodeType: 'person',
        name: '小红',
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
        reviewStatus: 'approved'
      },
      { collection: 'nodes' }
    )

    const applyRawNode = vi.fn().mockResolvedValue(undefined)
    const repo = {
      applyRawNode,
      softDeleteNode: vi.fn(),
      applyRawEdge: vi.fn(),
      softDeleteEdge: vi.fn(),
      listNodeIds: vi.fn().mockResolvedValue([]),
      listEdgeIds: vi.fn().mockResolvedValue([])
    } as unknown as GraphRepository

    await new GraphSyncService(graphManager, repo, null).syncPendingIndex()

    expect(applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'n-bug',
        vaultId: deriveLegacyVaultId(displayName)
      })
    )
    expect(applyRawNode).not.toHaveBeenCalledWith(expect.objectContaining({ vaultId: randomId }))
  })
})
