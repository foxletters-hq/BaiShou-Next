import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { GraphRawManager } from '../managers/graph.raw-manager'
import type { IStoragePathService } from '../../vault/storage-path.types'

function makePathService(root: string): IStoragePathService {
  return {
    getGraphBaseDirectory: async () => path.join(root, 'Graph'),
    getMemoryBaseDirectory: async () => path.join(root, 'Memory'),
    getJournalsBaseDirectory: async () => path.join(root, 'Journals'),
    getSummariesBaseDirectory: async () => path.join(root, 'Summaries'),
    getSessionsBaseDirectory: async () => path.join(root, 'Sessions'),
    getActiveVaultPath: async () => root
  } as unknown as IStoragePathService
}

describe('GraphRawManager', () => {
  let tmp: string
  let manager: GraphRawManager

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'graph-raw-'))
    const freshness = new DerivedFreshnessService()
    manager = new GraphRawManager(makePathService(tmp), new NodeFileSystem(), freshness)
  })

  it('writes node then lists pending-index until commit', async () => {
    const now = Date.now()
    const written = await manager.writeRecord(
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

    expect(written.relativePath).toMatch(/^nodes\/\d{4}-\d{2}\.jsonl$/)
    const pending = await manager.listPendingIndex('nodes')
    expect(pending.length).toBe(1)

    await manager.commitIndexed('nodes', written.relativePath, written.contentHash)
    const pendingAfter = await manager.listPendingIndex('nodes')
    expect(pendingAfter.length).toBe(0)
  })

  it('writes edge into edges shard', async () => {
    const now = Date.now()
    const written = await manager.writeRecord(
      {
        id: 'e1',
        schemaVersion: 1,
        vaultName: 'Personal',
        fromId: 'n1',
        toId: 'n2',
        edgeType: 'mentions',
        props: {},
        validFrom: now,
        validTo: null,
        isCurrent: true,
        sourceKind: 'manual',
        sourceRef: null,
        sourceExcerpt: '',
        sourceContentHash: null,
        confidence: 80,
        origin: 'ai',
        reviewStatus: 'pending',
        shardMonth: '2026-07',
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      { collection: 'edges' }
    )
    expect(written.relativePath).toBe('edges/2026-07.jsonl')
    const rows = await manager.readShardRecords(written.relativePath)
    expect(rows).toHaveLength(1)
  })
})
