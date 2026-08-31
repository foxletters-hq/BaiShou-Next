import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { createNodeFileSystem } from '../../fs/create-node-file-system'
import type { IStoragePathService } from '../../vault/storage-path.types'
import { NotebookGraphRawManager } from '../notebook-graph-raw.manager'
import { NotebookGraphIndexService } from '../notebook-graph-index.service'
import type { NotebookGraphEdgeRawRecord, NotebookGraphNodeRawRecord } from '@baishou/shared'

function canOpenBetterSqlite3(): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Database = require('better-sqlite3') as typeof import('better-sqlite3')
    const db = new Database(':memory:')
    db.close()
    return true
  } catch {
    return false
  }
}

const describeIndex = canOpenBetterSqlite3() ? describe : describe.skip

function makeEdge(
  id: string,
  opts: { sourceRef: string; now: number; notebookId?: string; fromId?: string; toId?: string }
): NotebookGraphEdgeRawRecord {
  const now = opts.now
  const sourceId = opts.sourceRef.split('#')[0] ?? 'src1'
  return {
    id,
    schemaVersion: 1,
    vaultId: 'v1',
    vaultName: 'Personal',
    notebookId: opts.notebookId ?? 'nb1',
    fromId: opts.fromId ?? 'n1',
    toId: opts.toId ?? 'n2',
    edgeType: 'mentions',
    props: {},
    validFrom: now,
    validTo: null,
    isCurrent: true,
    sourceKind: 'knowledge',
    sourceRef: opts.sourceRef,
    sourceExcerpt: '',
    sourceContentHash: null,
    confidence: 80,
    origin: 'ai',
    reviewStatus: 'approved',
    shardMonth: sourceId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null
  }
}

function makeNode(
  id: string,
  name: string,
  now: number,
  opts?: { sourceId?: string; nodeType?: string }
): NotebookGraphNodeRawRecord {
  const sourceId = opts?.sourceId ?? 'src1'
  return {
    id,
    schemaVersion: 1,
    vaultId: 'v1',
    vaultName: 'Personal',
    notebookId: 'nb1',
    nodeType: opts?.nodeType ?? 'person',
    name,
    aliases: [],
    summary: '',
    props: opts?.nodeType === 'source' ? { sourceId } : {},
    mentionCount: 1,
    firstSeenAt: now,
    lastSeenAt: now,
    origin: 'ai',
    shardMonth: sourceId,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    reviewStatus: 'approved'
  }
}

describe('NotebookGraphRawManager source shards', () => {
  let tempDir: string
  let notebooksDir: string
  let raw: NotebookGraphRawManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-nb-graph-raw-'))
    notebooksDir = path.join(tempDir, 'Notebooks')
    await fs.mkdir(notebooksDir, { recursive: true })
    raw = new NotebookGraphRawManager(
      {
        getNotebooksBaseDirectory: async () => notebooksDir
      } as unknown as IStoragePathService,
      createNodeFileSystem()
    )
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('writeRecord 拒绝回退到日历月', async () => {
    await expect(
      raw.writeEdge({
        ...makeEdge('e-month', { sourceRef: 'x#0', now: Date.now() }),
        sourceRef: '',
        shardMonth: '2026-08'
      })
    ).rejects.toThrow(/Invalid notebook graph shard key/)
  })

  it('replaceSourceGraph 只写该资料三个分片', async () => {
    const now = Date.now()
    await raw.replaceSourceGraph({
      notebookId: 'nb1',
      sourceId: 'src5',
      nodes: [makeNode('n-src5', '戊', now, { sourceId: 'src5' })],
      edges: [makeEdge('e-src5', { sourceRef: 'src5#0', now })],
      extractState: {
        id: 'st5',
        schemaVersion: 1,
        vaultId: 'v1',
        vaultName: 'Personal',
        notebookId: 'nb1',
        sourceId: 'src5',
        extractedTextHash: 'h5',
        windowsDone: 1,
        windowsTotal: 1,
        extractedAt: now,
        updatedAt: now,
        deletedAt: null
      }
    })
    const edges = await raw.readCollapsed<NotebookGraphEdgeRawRecord>('nb1', 'edges')
    expect(edges.map((e) => e.id)).toEqual(['e-src5'])
    const state = await raw.getExtractState('nb1', 'src5')
    expect(state?.extractedTextHash).toBe('h5')
    await expect(fs.stat(path.join(notebooksDir, 'nb1', 'graph', 'edges', 'src5.jsonl'))).resolves.toBeTruthy()
  })

  it('重抽资料 5 不改资料 1 的边文件', async () => {
    const now = Date.now()
    await raw.writeEdge(makeEdge('e1', { sourceRef: 'src1#0', now }))
    await raw.writeEdge(makeEdge('e5', { sourceRef: 'src5#0', now }))
    await raw.replaceShard('nb1', 'edges', 'src5', [
      makeEdge('e5-new', { sourceRef: 'src5#0', now: now + 1 })
    ])
    const src1 = (await raw.readShardRecords('nb1', 'edges', 'src1')) as Array<{ id: string }>
    const src5 = (await raw.readShardRecords('nb1', 'edges', 'src5')) as Array<{ id: string }>
    expect(src1.map((e) => e.id)).toEqual(['e1'])
    expect(src5.map((e) => e.id)).toEqual(['e5-new'])
  })

  it('tombstone 从分片物理去掉该行，不追加 deletedAt', async () => {
    const now = Date.now()
    await raw.writeEdge(makeEdge('e-keep', { sourceRef: 'src1#0', now }))
    await raw.writeEdge(makeEdge('e-drop', { sourceRef: 'src1#1', now }))
    await raw.tombstone('nb1', 'edges', 'e-drop', 'src1')
    const rows = await raw.readCollapsed<NotebookGraphEdgeRawRecord>('nb1', 'edges')
    expect(rows.map((e) => e.id)).toEqual(['e-keep'])
    const parsed = (
      await fs.readFile(path.join(notebooksDir, 'nb1', 'graph', 'edges', 'src1.jsonl'), 'utf8')
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as { id: string; deletedAt?: number | null })
    expect(parsed.map((row) => row.id)).toEqual(['e-keep'])
    expect(parsed.every((row) => row.deletedAt == null)).toBe(true)
  })

  it('删除资料分片后该 sourceId 文件不在', async () => {
    const now = Date.now()
    await raw.writeEdge(makeEdge('e5', { sourceRef: 'src5#0', now }))
    await raw.deleteSourceShards('nb1', 'src5')
    expect(await raw.readShardRecords('nb1', 'edges', 'src5')).toEqual([])
    await expect(fs.stat(path.join(notebooksDir, 'nb1', 'graph', 'edges', 'src5.jsonl'))).rejects.toThrow()
  })

  it('把 YYYY-MM.jsonl 按 sourceRef 重写为资料分片', async () => {
    const now = Date.now()
    const edgesDir = path.join(notebooksDir, 'nb1', 'graph', 'edges')
    const nodesDir = path.join(notebooksDir, 'nb1', 'graph', 'nodes')
    await fs.mkdir(edgesDir, { recursive: true })
    await fs.mkdir(nodesDir, { recursive: true })
    await fs.writeFile(
      path.join(edgesDir, '2026-08.jsonl'),
      `${JSON.stringify({
        ...makeEdge('e-old', { sourceRef: 'src1#0', now }),
        shardMonth: '2026-08'
      })}\n`,
      'utf8'
    )
    await fs.writeFile(
      path.join(nodesDir, '2026-08.jsonl'),
      `${JSON.stringify({
        ...makeNode('n1', '甲', now),
        shardMonth: '2026-08'
      })}\n${JSON.stringify({
        ...makeNode('orphan', '无主', now),
        shardMonth: '2026-08'
      })}\n`,
      'utf8'
    )
    const result = await raw.migrateLegacyMonthShards('nb1')
    expect(result.migrated).toBe(true)
    await expect(fs.stat(path.join(edgesDir, '2026-08.jsonl'))).rejects.toThrow()
    const src1Edges = (await raw.readShardRecords('nb1', 'edges', 'src1')) as Array<{
      id: string
      shardMonth: string
    }>
    expect(src1Edges).toEqual([expect.objectContaining({ id: 'e-old', shardMonth: 'src1' })])
    const leftover = (await raw.readShardRecords('nb1', 'nodes', '_legacy')) as Array<{ id: string }>
    expect(leftover.map((n) => n.id)).toEqual(['orphan'])
  })
})

describeIndex('NotebookGraph source index', () => {
  let tempDir: string
  let dbManager: { connect: (d: string) => Promise<void>; disconnect: () => void; getDb: () => unknown }

  beforeEach(async () => {
    const { KnowledgeConnectionManager } = await import('@baishou/database')
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-nb-graph-idx-'))
    dbManager = new KnowledgeConnectionManager()
    await dbManager.connect(tempDir)
  })

  afterEach(async () => {
    dbManager?.disconnect()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('重抽资料 5 后资料 1 的边仍在；只属于 5 的边被缺席删除', async () => {
    const { NotebookGraphRepository } = await import('@baishou/database')
    const notebooksDir = path.join(tempDir, 'Notebooks')
    await fs.mkdir(notebooksDir, { recursive: true })
    const raw = new NotebookGraphRawManager(
      {
        getNotebooksBaseDirectory: async () => notebooksDir
      } as unknown as IStoragePathService,
      createNodeFileSystem()
    )
    const repo = new NotebookGraphRepository(dbManager.getDb() as never)
    const index = new NotebookGraphIndexService(raw, repo)
    const now = Date.now()
    const shared = makeNode('person-shared', '甲', now, { sourceId: 'src1' })
    const only5 = makeNode('person-5', '戊', now, { sourceId: 'src5' })
    await raw.writeNode({ ...shared, shardMonth: 'src1' })
    await raw.writeNode({ ...shared, shardMonth: 'src5' })
    await raw.writeNode(only5)
    await raw.writeNode(makeNode('n-src1', '资料1', now, { sourceId: 'src1', nodeType: 'source' }))
    await raw.writeEdge(
      makeEdge('e1', { sourceRef: 'src1#0', now, fromId: 'person-shared', toId: 'n-src1' })
    )
    await raw.writeEdge(
      makeEdge('e5', { sourceRef: 'src5#0', now, fromId: 'person-shared', toId: 'person-5' })
    )
    await index.syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1' })

    await raw.replaceShard('nb1', 'edges', 'src5', [])
    await raw.replaceShard('nb1', 'nodes', 'src5', [])
    await index.syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1' })

    const view = await repo.getView({ vaultId: 'v1', notebookId: 'nb1' })
    expect(view.edges.map((e) => e.id)).toEqual(['e1'])
    expect(view.nodes.map((n) => n.id).sort()).toEqual(['n-src1', 'person-shared'])
  })
})

describe('NotebookGraphIndexService source isolation', () => {
  let tempDir: string
  let notebooksDir: string
  let raw: NotebookGraphRawManager

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baishou-nb-graph-idx-mock-'))
    notebooksDir = path.join(tempDir, 'Notebooks')
    await fs.mkdir(notebooksDir, { recursive: true })
    raw = new NotebookGraphRawManager(
      {
        getNotebooksBaseDirectory: async () => notebooksDir
      } as unknown as IStoragePathService,
      createNodeFileSystem()
    )
  })

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined)
  })

  it('重抽资料 5 后资料 1 的边仍在；只属于 5 的边被缺席删除', async () => {
    const nodes = new Map<string, { id: string; shardMonth: string }>()
    const edges = new Map<string, { id: string; shardMonth: string }>()
    const repo = {
      applyRawNode: vi.fn(async (row: { id: string; shardMonth?: string }) => {
        nodes.set(row.id, { id: row.id, shardMonth: row.shardMonth ?? '' })
      }),
      applyRawEdge: vi.fn(async (row: { id: string; shardMonth: string }) => {
        edges.set(row.id, { id: row.id, shardMonth: row.shardMonth })
      }),
      listLiveIds: vi.fn(async () => ({
        nodeIds: [...nodes.keys()],
        edgeIds: [...edges.keys()],
        nodes: [...nodes.values()],
        edges: [...edges.values()]
      })),
      softDeleteNode: vi.fn(async (id: string) => {
        nodes.delete(id)
      }),
      softDeleteEdge: vi.fn(async (id: string) => {
        edges.delete(id)
      })
    }
    const index = new NotebookGraphIndexService(raw, repo)
    const now = Date.now()
    const shared = makeNode('person-shared', '甲', now, { sourceId: 'src1' })
    const only5 = makeNode('person-5', '戊', now, { sourceId: 'src5' })
    await raw.writeNode({ ...shared, shardMonth: 'src1' })
    await raw.writeNode({ ...shared, shardMonth: 'src5' })
    await raw.writeNode(only5)
    await raw.writeNode(makeNode('n-src1', '资料1', now, { sourceId: 'src1', nodeType: 'source' }))
    await raw.writeEdge(
      makeEdge('e1', { sourceRef: 'src1#0', now, fromId: 'person-shared', toId: 'n-src1' })
    )
    await raw.writeEdge(
      makeEdge('e5', { sourceRef: 'src5#0', now, fromId: 'person-shared', toId: 'person-5' })
    )
    await index.syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1' })

    await raw.replaceShard('nb1', 'edges', 'src5', [])
    await raw.replaceShard('nb1', 'nodes', 'src5', [])
    await index.syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1' })

    expect([...edges.keys()]).toEqual(['e1'])
    expect([...nodes.keys()].sort()).toEqual(['n-src1', 'person-shared'])
    expect(repo.softDeleteEdge).toHaveBeenCalledWith('e5', 'nb1')
    expect(repo.softDeleteNode).toHaveBeenCalledWith('person-5', 'nb1')
    expect(repo.softDeleteNode).not.toHaveBeenCalledWith('person-shared', 'nb1')
  })

  it('同名写回后第二次 sync 不再追加分片', async () => {
    const now = Date.now()
    await raw.writeNode(makeNode('n-random', '甲', now, { sourceId: 'src1' }))
    const writeRecord = raw.writeRecord.bind(raw)
    let extraWrites = 0
    raw.writeRecord = async (...args: Parameters<typeof writeRecord>) => {
      extraWrites += 1
      return writeRecord(...args)
    }
    const repo = {
      applyRawNode: vi.fn(async () => ({
        id: 'n-stable',
        remappedFrom: 'n-random',
        remappedFromShardMonth: 'src1',
        writeBackSurvivor: true
      })),
      applyRawEdge: vi.fn(),
      listLiveIds: vi.fn(async () => ({
        nodeIds: [],
        edgeIds: [],
        nodes: [],
        edges: []
      })),
      softDeleteNode: vi.fn(),
      softDeleteEdge: vi.fn(),
      getNodeById: vi.fn(async () => null)
    }
    const index = new NotebookGraphIndexService(raw, repo)
    await index.syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1', absentSweep: 'off' })
    expect(extraWrites).toBe(1)
    expect(await raw.listPendingIndex('nb1')).toEqual([])
    extraWrites = 0
    await index.syncPendingIndex({ vaultId: 'v1', notebookId: 'nb1', absentSweep: 'off' })
    expect(extraWrites).toBe(0)
    expect(await raw.listPendingIndex('nb1')).toEqual([])
  })

  it('empty sqlite force-rescans shards that another device already marked indexed', async () => {
    const now = Date.now()
    await raw.writeNode(makeNode('n1', '甲', now, { sourceId: 'src1' }))
    const pending = await raw.listPendingIndex('nb1')
    expect(pending).toHaveLength(1)
    await raw.commitIndexed(
      'nb1',
      pending[0]!.collection,
      pending[0]!.shardMonth,
      pending[0]!.contentHash
    )
    expect(await raw.listPendingIndex('nb1')).toEqual([])

    const repo = {
      applyRawNode: vi.fn(async () => ({ id: 'n1' })),
      applyRawEdge: vi.fn(),
      listLiveIds: vi.fn(async () => ({
        nodeIds: [],
        edgeIds: [],
        nodes: [],
        edges: []
      })),
      softDeleteNode: vi.fn(),
      softDeleteEdge: vi.fn(),
      getNodeById: vi.fn(async () => null)
    }
    const result = await new NotebookGraphIndexService(raw, repo).syncPendingIndex({
      vaultId: 'v1',
      notebookId: 'nb1'
    })
    expect(repo.applyRawNode).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'n1', notebookId: 'nb1' })
    )
    expect(result.nodes).toBe(1)
  })
})
