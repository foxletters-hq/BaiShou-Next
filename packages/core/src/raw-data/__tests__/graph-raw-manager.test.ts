import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { GraphRawManager } from '../managers/graph.raw-manager'
import { commitNewlyDirtyGraphShardsIndexed } from '../graph-surgical-delete'
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
        vaultId: 'vlt_test',
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
        shardMonth: '2026-07',
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
        vaultId: 'vlt_test',
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

  it('removes a node from its month shard without writing deletedAt', async () => {
    const now = Date.now()
    await manager.writeRecord(
      {
        id: 'n-map',
        schemaVersion: 1,
        vaultId: 'vlt_test',
        vaultName: 'Personal',
        nodeType: 'person',
        name: 'Mapped',
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

    const idmapPath = path.join(tmp, 'Graph', 'nodes.idmap.json')
    expect(fs.existsSync(idmapPath)).toBe(false)

    await manager.removeRecordsFromShard('nodes', '2026-07', ['n-map'])
    const rows = await manager.readCollapsedNodes('2026-07')
    expect(rows.find((r) => r.id === 'n-map')).toBeUndefined()
  })

  it('tombstone physically drops the row instead of appending deletedAt', async () => {
    const now = Date.now()
    await manager.writeRecord(
      {
        id: 'n-keep',
        schemaVersion: 1,
        vaultId: 'vlt_test',
        vaultName: 'Personal',
        nodeType: 'person',
        name: 'Keep',
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
      },
      { collection: 'nodes' }
    )
    await manager.writeRecord(
      {
        id: 'n-drop',
        schemaVersion: 1,
        vaultId: 'vlt_test',
        vaultName: 'Personal',
        nodeType: 'person',
        name: 'Drop',
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
      },
      { collection: 'nodes' }
    )

    await manager.tombstone('n-drop', { collection: 'nodes', shardMonth: '2026-07' })
    const rows = await manager.readCollapsedNodes('2026-07')
    expect(rows.map((row) => row.id)).toEqual(['n-keep'])
    const shardPath = path.join(tmp, 'Graph', 'nodes', '2026-07.jsonl')
    const parsed = fs
      .readFileSync(shardPath, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { id: string; deletedAt?: number | null })
    expect(parsed.map((row) => row.id)).toEqual(['n-keep'])
    expect(parsed.every((row) => row.deletedAt == null)).toBe(true)
  })

  it('compacts a shard to LWW winners only', async () => {
    const now = Date.now()
    const base = {
      id: 'n-c',
      schemaVersion: 1 as const,
      vaultId: 'vlt_test',
      vaultName: 'Personal',
      nodeType: 'person',
      name: 'C',
      aliases: [] as string[],
      summary: '',
      props: {},
      mentionCount: 1,
      firstSeenAt: now,
      lastSeenAt: now,
      origin: 'ai' as const,
      shardMonth: '2026-08',
      createdAt: now,
      updatedAt: now,
      deletedAt: null as number | null,
      reviewStatus: 'approved' as const
    }
    await manager.writeRecord(base, { collection: 'nodes' })
    await manager.writeRecord({ ...base, updatedAt: now + 1, summary: 'v2' }, { collection: 'nodes' })
    const compacted = await manager.compactShard('nodes', '2026-08')
    expect(compacted.rows).toBe(1)
    const rows = await manager.readCollapsedNodes('2026-08')
    expect(rows).toHaveLength(1)
    expect(rows[0]?.summary).toBe('v2')
  })

  it('listShards does not rewrite manifest when hashes are unchanged', async () => {
    const now = Date.now()
    await manager.writeRecord(
      {
        id: 'n-mtime',
        schemaVersion: 1,
        vaultId: 'vlt_test',
        vaultName: 'Personal',
        nodeType: 'person',
        name: 'Mtime',
        aliases: [],
        summary: '',
        props: {},
        mentionCount: 1,
        firstSeenAt: now,
        lastSeenAt: now,
        origin: 'ai',
        shardMonth: '2026-08',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        reviewStatus: 'approved'
      },
      { collection: 'nodes' }
    )
    await manager.listShards()
    const manifestPath = path.join(tmp, 'Graph', 'nodes', 'shards.manifest.json')
    expect(fs.existsSync(manifestPath)).toBe(true)
    const before = fs.statSync(manifestPath)
    const beforeText = fs.readFileSync(manifestPath, 'utf8')
    await new Promise((r) => setTimeout(r, 30))
    await manager.listShards()
    const after = fs.statSync(manifestPath)
    expect(fs.readFileSync(manifestPath, 'utf8')).toBe(beforeText)
    expect(after.mtimeMs).toBe(before.mtimeMs)
  })

  it('marks a previously indexed shard clean after a surgical row remove', async () => {
    const now = Date.now()
    const writeNode = async (id: string, name: string) =>
      manager.writeRecord(
        {
          id,
          schemaVersion: 1,
          vaultId: 'vlt_test',
          vaultName: 'Personal',
          nodeType: 'person',
          name,
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
        },
        { collection: 'nodes' }
      )

    const first = await writeNode('n-keep', 'Keep')
    await writeNode('n-drop', 'Drop')
    await manager.commitIndexed('nodes', first.relativePath, first.contentHash)
    expect(await manager.listPendingIndex('nodes')).toHaveLength(0)

    const pendingBefore = await manager.listPendingIndex()
    await manager.removeRecordsFromShard('nodes', '2026-07', ['n-drop'])
    const committed = await commitNewlyDirtyGraphShardsIndexed(manager, pendingBefore)
    expect(committed).toBe(1)
    expect(await manager.listPendingIndex('nodes')).toHaveLength(0)
    const rows = await manager.readCollapsedNodes('2026-07')
    expect(rows.map((row) => row.id)).toEqual(['n-keep'])
  })

  it('leaves a shard pending when it already had unindexed rows', async () => {
    const now = Date.now()
    await manager.writeRecord(
      {
        id: 'n-a',
        schemaVersion: 1,
        vaultId: 'vlt_test',
        vaultName: 'Personal',
        nodeType: 'person',
        name: 'A',
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
      },
      { collection: 'nodes' }
    )
    await manager.writeRecord(
      {
        id: 'n-b',
        schemaVersion: 1,
        vaultId: 'vlt_test',
        vaultName: 'Personal',
        nodeType: 'person',
        name: 'B',
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
      },
      { collection: 'nodes' }
    )
    const pendingBefore = await manager.listPendingIndex()
    expect(pendingBefore.length).toBeGreaterThan(0)
    await manager.removeRecordsFromShard('nodes', '2026-07', ['n-a'])
    const committed = await commitNewlyDirtyGraphShardsIndexed(manager, pendingBefore)
    expect(committed).toBe(0)
    expect((await manager.listPendingIndex('nodes')).length).toBeGreaterThan(0)
  })
})
