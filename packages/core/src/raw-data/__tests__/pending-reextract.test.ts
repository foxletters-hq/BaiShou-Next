import { describe, it, expect, beforeEach } from 'vitest'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { NodeFileSystem } from '../../fs/node-file-system'
import { DerivedFreshnessService } from '../derived-freshness.service'
import { GraphRawManager } from '../managers/graph.raw-manager'
import { bindPendingReextractCollaborators } from '../bind-pending-reextract'
import type { IStoragePathService } from '../../vault/storage-path.types'
import {
  clampGraphExtractEnumsForTest,
  entryNodeIdForFilePath
} from '../../graph/graph-llm-extraction.service'

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

describe('pending-reextract + extract-state', () => {
  let tmp: string
  let freshness: DerivedFreshnessService
  let graphManager: GraphRawManager
  let journals: Array<{ filePath: string; contentHash: string; date?: string }>

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pending-re-'))
    freshness = new DerivedFreshnessService()
    graphManager = new GraphRawManager(makePathService(tmp), new NodeFileSystem(), freshness)
    journals = [
      { filePath: 'Journals/2026-07-01.md', contentHash: 'hash-a', date: '2026-07-01' },
      { filePath: 'Journals/2026-07-02.md', contentHash: 'hash-b', date: '2026-07-02' }
    ]
    bindPendingReextractCollaborators({
      freshness,
      graphManager,
      shadowRepo: {
        listAll: async () => journals
      } as never,
      getVaultName: () => 'Personal'
    })
  })

  it('lists never-extracted journals as pending', async () => {
    const pending = await freshness.listPendingReextract()
    expect(pending).toHaveLength(2)
    expect(pending.map((p) => p.filePath).sort()).toEqual([
      'Journals/2026-07-01.md',
      'Journals/2026-07-02.md'
    ])
  })

  it('commitReextract clears pending for matching hash (LWW cursor)', async () => {
    await freshness.commitReextract('Journals/2026-07-01.md', 'hash-a')
    const pending = await freshness.listPendingReextract()
    expect(pending).toHaveLength(1)
    expect(pending[0]!.filePath).toBe('Journals/2026-07-02.md')

    // rewrite cursor with newer hash via another commit
    journals[0]!.contentHash = 'hash-a2'
    freshness.markPendingReextract('Journals/2026-07-01.md', 'hash-a2')
    const again = await freshness.listPendingReextract()
    expect(again.some((p) => p.filePath === 'Journals/2026-07-01.md')).toBe(true)

    await freshness.commitReextract('Journals/2026-07-01.md', 'hash-a2')
    const after = await freshness.listPendingReextract()
    expect(after.every((p) => p.filePath !== 'Journals/2026-07-01.md')).toBe(true)
  })

  it('markPendingReextract surfaces dirty diary even before shadow list updates', async () => {
    await freshness.commitReextract('Journals/2026-07-01.md', 'hash-a')
    freshness.markPendingReextract('Journals/2026-07-01.md', 'hash-changed')
    const pending = await freshness.listPendingReextract()
    const hit = pending.find((p) => p.filePath === 'Journals/2026-07-01.md')
    expect(hit?.contentHash).toBe('hash-changed')
  })
})

describe('graph extract helpers', () => {
  it('clamps node/edge enums to whitelist', () => {
    expect(clampGraphExtractEnumsForTest({ nodeType: 'PERSON', edgeType: 'FOO' })).toEqual({
      nodeType: 'person',
      edgeType: 'relates_to'
    })
    expect(clampGraphExtractEnumsForTest({ nodeType: 'place', edgeType: 'located_at' })).toEqual({
      nodeType: 'place',
      edgeType: 'located_at'
    })
  })

  it('entry node id is stable for path', () => {
    const a = entryNodeIdForFilePath('Journals/2026-07-01.md')
    const b = entryNodeIdForFilePath('Journals\\2026-07-01.md')
    expect(a).toBe(b)
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/
    )
  })
})

describe('supersede AI edges by sourceRef (file side)', () => {
  it('marks prior AI edges isCurrent=false and keeps user edges', async () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'supersede-'))
    const freshness = new DerivedFreshnessService()
    const manager = new GraphRawManager(makePathService(tmp), new NodeFileSystem(), freshness)
    const now = Date.now()
    await manager.writeRecord(
      {
        id: 'e-ai',
        schemaVersion: 1,
        vaultName: 'Personal',
        fromId: 'n1',
        toId: 'n2',
        edgeType: 'mentions',
        props: {},
        validFrom: now,
        validTo: null,
        isCurrent: true,
        sourceKind: 'diary',
        sourceRef: '2026-07-01',
        sourceExcerpt: '',
        sourceContentHash: 'h1',
        confidence: 80,
        origin: 'ai',
        reviewStatus: 'approved',
        shardMonth: '2026-07',
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      { collection: 'edges' }
    )
    await manager.writeRecord(
      {
        id: 'e-user',
        schemaVersion: 1,
        vaultName: 'Personal',
        fromId: 'n1',
        toId: 'n3',
        edgeType: 'relates_to',
        props: {},
        validFrom: now,
        validTo: null,
        isCurrent: true,
        sourceKind: 'manual',
        sourceRef: '2026-07-01',
        sourceExcerpt: '',
        sourceContentHash: null,
        confidence: 100,
        origin: 'user',
        reviewStatus: 'approved',
        shardMonth: '2026-07',
        createdAt: now,
        updatedAt: now,
        deletedAt: null
      },
      { collection: 'edges' }
    )

    const n = await manager.supersedeAiEdgesBySourceRef('2026-07-01')
    expect(n).toBe(1)
    const edges = await manager.readAllCollapsedEdges()
    const ai = edges.find((e) => e.id === 'e-ai')!
    const user = edges.find((e) => e.id === 'e-user')!
    expect(ai.isCurrent).toBe(false)
    expect(user.isCurrent).toBe(true)
  })
})
