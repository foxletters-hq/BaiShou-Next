import type { IFileSystem } from '../../fs/file-system.types'
import type { IStoragePathService } from '../../vault/storage-path.types'
import * as path from '../../fs/path.util'
import { shardMonthFromInstant } from '../raw-data-month.util'
import { MonthlyJsonlStore, collapseJsonlById } from '../stores/monthly-jsonl.store'
import type { DerivedFreshnessService } from '../derived-freshness.service'
import type {
  GraphCollection,
  GraphEdgeRawRecord,
  GraphExtractStateRawRecord,
  GraphNodeRawRecord,
  RecordCollectionKindManager,
  ShardInfo,
  WriteOpts
} from '../raw-data-source.types'
import { graphDiaryInstant, isValidGraphMonth } from '@baishou/shared'
import type { GraphIndexSource } from '../graph-index-source'
import type { GraphExtractRawWriter } from '../graph-extract-raw'

const COLLECTIONS: GraphCollection[] = ['nodes', 'edges', 'extract-state']

function shardMonthForNode(row: GraphNodeRawRecord): string {
  if (row.shardMonth && isValidGraphMonth(row.shardMonth)) return row.shardMonth
  return shardMonthFromInstant(row.firstSeenAt || row.createdAt)
}

function shardMonthForEdge(row: GraphEdgeRawRecord): string {
  if (row.shardMonth && isValidGraphMonth(row.shardMonth)) return row.shardMonth
  if (row.sourceKind === 'diary' && row.sourceRef) {
    return graphDiaryInstant(row.sourceRef).shardMonth
  }
  if (row.validFrom != null) return shardMonthFromInstant(row.validFrom)
  return shardMonthFromInstant(row.createdAt)
}

/**
 * Graph JSONL: Graph/{nodes|edges|extract-state}/YYYY-MM.jsonl
 * Each collection has its own shards.manifest.json under the subdir.
 * Node shardMonth lives on the record (nodes.idmap.json is no longer written).
 */
export class GraphRawManager implements RecordCollectionKindManager, GraphIndexSource, GraphExtractRawWriter {
  readonly kind = 'graph' as const
  readonly shape = 'record-collection' as const

  private stores: Partial<Record<GraphCollection, MonthlyJsonlStore>> = {}
  private rootDir: string | null = null

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fs: IFileSystem,
    private readonly freshness: DerivedFreshnessService
  ) {}

  resetCache(): void {
    this.stores = {}
    this.rootDir = null
  }

  private async getRoot(): Promise<string> {
    if (this.rootDir) return this.rootDir
    this.rootDir = await this.pathService.getGraphBaseDirectory()
    return this.rootDir
  }

  private async getStore(collection: GraphCollection): Promise<MonthlyJsonlStore> {
    const cached = this.stores[collection]
    if (cached) return cached
    const root = await this.getRoot()
    const store = new MonthlyJsonlStore({
      fs: this.fs,
      rootDir: path.join(root, collection)
    })
    this.stores[collection] = store
    this.freshness.registerStore(`graph:${collection}`, store)
    return store
  }

  private resolveCollection(opts?: { collection?: GraphCollection }): GraphCollection {
    return opts?.collection ?? 'nodes'
  }

  /**
   * Previously rebuilt nodes.idmap.json. Idmap is retired; kept as no-op for sync callers.
   */
  async rebuildIdmap(): Promise<number> {
    return 0
  }

  async writeRecord(
    record: unknown,
    opts?: { collection?: GraphCollection } & WriteOpts
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string }> {
    const collection = this.resolveCollection(opts)
    const store = await this.getStore(collection)
    let shardMonth: string
    if (collection === 'nodes') {
      const row = record as GraphNodeRawRecord
      if (!row?.id || !row.name) {
        throw new Error('GraphRawManager.writeRecord(nodes): invalid node record')
      }
      shardMonth = shardMonthForNode(row)
      if (!row.shardMonth) (record as GraphNodeRawRecord).shardMonth = shardMonth
    } else if (collection === 'edges') {
      const row = record as GraphEdgeRawRecord
      if (!row?.id || !row.fromId || !row.toId) {
        throw new Error('GraphRawManager.writeRecord(edges): invalid edge record')
      }
      shardMonth = shardMonthForEdge(row)
      if (!row.shardMonth) (record as GraphEdgeRawRecord).shardMonth = shardMonth
    } else {
      const row = record as GraphExtractStateRawRecord
      if (!row?.id || !row.filePath || !String(row.vaultId ?? '').trim()) {
        throw new Error('GraphRawManager.writeRecord(extract-state): vaultId is required')
      }
      shardMonth = shardMonthFromInstant(row.extractedAt || row.updatedAt)
    }
    const written = await store.appendRecord(shardMonth, record)
    return {
      ...written,
      relativePath: `${collection}/${written.relativePath}`
    }
  }

  async tombstone(
    id: string,
    opts: WriteOpts & { collection?: GraphCollection; shardMonth?: string }
  ): Promise<void> {
    const collection = this.resolveCollection(opts)
    const hinted = opts.shardMonth?.trim()
    if (hinted && isValidGraphMonth(hinted)) {
      const removed = await this.removeRecordsFromShard(collection, hinted, [id])
      if (removed > 0) return
    }
    const store = await this.getStore(collection)
    for (const shard of [...(await store.listShards())].reverse()) {
      if (hinted && shard.shardMonth === hinted) continue
      const removed = await this.removeRecordsFromShard(collection, shard.shardMonth, [id])
      if (removed > 0) return
    }
    throw new Error(
      hinted
        ? `Graph delete: id not found in ${collection}/${hinted}`
        : `Graph delete: id not found: ${id}`
    )
  }

  /** Atomically rewrite a collection monthly shard (e.g. sync LWW merge). */
  async replaceShardContent(
    collection: GraphCollection,
    shardMonth: string,
    content: string
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string }> {
    const store = await this.getStore(collection)
    const written = await store.replaceShardContent(shardMonth, content)
    return {
      ...written,
      relativePath: `${collection}/${written.relativePath}`
    }
  }

  /** Drop ids from a month shard. Does not append deletedAt. */
  async removeRecordsFromShard(
    collection: GraphCollection,
    shardMonth: string,
    ids: readonly string[]
  ): Promise<number> {
    const idSet = new Set(ids.map((id) => id.trim()).filter(Boolean))
    if (idSet.size === 0 || !isValidGraphMonth(shardMonth)) return 0
    const store = await this.getStore(collection)
    const rows = collapseJsonlById(
      (await store.readRecords(shardMonth)) as Array<{
        id: string
        updatedAt: number
        deletedAt?: number | null
      }>
    )
    const kept = rows.filter((row) => !idSet.has(row.id) && !row.deletedAt)
    const hadTarget = rows.some((row) => idSet.has(row.id))
    if (!hadTarget && kept.length === rows.filter((row) => !row.deletedAt).length) return 0
    const content = kept.length === 0 ? '' : `${kept.map((row) => JSON.stringify(row)).join('\n')}\n`
    await store.replaceShardContent(shardMonth, content)
    return rows.length - kept.length
  }

  /**
   * Collapse append-only history for a monthly shard into live LWW winners only.
   */
  async compactShard(
    collection: GraphCollection,
    shardMonth: string
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string; rows: number }> {
    const store = await this.getStore(collection)
    const collapsed = collapseJsonlById(
      (await store.readRecords(shardMonth)) as Array<{
        id: string
        updatedAt: number
        deletedAt?: number | null
      }>
    ).filter((row) => !row.deletedAt)
    const content = collapsed.map((r) => JSON.stringify(r)).join('\n')
    const written = await store.replaceShardContent(shardMonth, content)
    return {
      ...written,
      relativePath: `${collection}/${written.relativePath}`,
      rows: collapsed.length
    }
  }

  async listShards(): Promise<ShardInfo[]> {
    const all: ShardInfo[] = []
    for (const collection of COLLECTIONS) {
      const store = await this.getStore(collection)
      const shards = await store.listShards()
      for (const s of shards) {
        all.push({
          ...s,
          relativePath: `${collection}/${s.relativePath}`
        })
      }
    }
    return all
  }

  async readShardRecords(relativePath: string): Promise<unknown[]> {
    const [collection, file] = relativePath.split(/[/\\]/)
    if (!collection || !file || !COLLECTIONS.includes(collection as GraphCollection)) {
      return []
    }
    const store = await this.getStore(collection as GraphCollection)
    return store.readRecordsByRelativePath(file)
  }

  async invalidateIndexedHashes(): Promise<void> {
    for (const collection of COLLECTIONS) {
      const store = await this.getStore(collection)
      await store.invalidateIndexedHashes()
    }
  }

  async listPendingIndex(collection?: GraphCollection): Promise<ShardInfo[]> {
    if (collection) {
      const store = await this.getStore(collection)
      const shards = await store.listPendingIndex()
      return shards.map((s) => ({
        ...s,
        relativePath: `${collection}/${s.relativePath}`
      }))
    }
    const all: ShardInfo[] = []
    for (const c of COLLECTIONS) {
      all.push(...(await this.listPendingIndex(c)))
    }
    return all
  }

  async commitIndexed(
    collection: string,
    relativePath: string,
    contentHash: string
  ): Promise<void> {
    const file = relativePath.includes('/') ? relativePath.split(/[/\\]/).pop()! : relativePath
    const store = await this.getStore(collection as GraphCollection)
    await store.markIndexed(file, contentHash)
  }

  async readCollapsedNodes(shardMonth: string): Promise<GraphNodeRawRecord[]> {
    const store = await this.getStore('nodes')
    return collapseJsonlById((await store.readRecords(shardMonth)) as GraphNodeRawRecord[])
  }

  async readCollapsedEdges(shardMonth: string): Promise<GraphEdgeRawRecord[]> {
    const store = await this.getStore('edges')
    return collapseJsonlById((await store.readRecords(shardMonth)) as GraphEdgeRawRecord[])
  }

  async readAllCollapsedExtractStates(): Promise<GraphExtractStateRawRecord[]> {
    const store = await this.getStore('extract-state')
    const shards = await store.listShards()
    const all: GraphExtractStateRawRecord[] = []
    for (const shard of shards) {
      const rows = collapseJsonlById(
        (await store.readRecords(shard.shardMonth)) as GraphExtractStateRawRecord[]
      )
      for (const row of rows) {
        if (row && row.deletedAt == null) all.push(row as GraphExtractStateRawRecord)
      }
    }
    return all
  }

  async readAllCollapsedEdges(): Promise<GraphEdgeRawRecord[]> {
    const store = await this.getStore('edges')
    const shards = await store.listShards()
    const all: GraphEdgeRawRecord[] = []
    for (const shard of shards) {
      const rows = collapseJsonlById(
        (await store.readRecords(shard.shardMonth)) as GraphEdgeRawRecord[]
      )
      for (const row of rows) {
        if (row && row.deletedAt == null) all.push(row as GraphEdgeRawRecord)
      }
    }
    return all
  }

  /**
   * File-side replace: mark prior AI edges for this diary sourceRef as not current.
   * Only reads the month shard derived from sourceRef (not all edge shards).
   */
  async supersedeAiEdgesBySourceRef(
    sourceRef: string,
    opts?: { exceptIds?: ReadonlySet<string>; shardMonth?: string }
  ): Promise<number> {
    const now = Date.now()
    const shardMonth = opts?.shardMonth || graphDiaryInstant(sourceRef).shardMonth
    const edges = await this.readCollapsedEdges(shardMonth)
    let count = 0
    for (const edge of edges) {
      if (edge.sourceRef !== sourceRef) continue
      if (!edge.isCurrent) continue
      if (edge.origin === 'user') continue
      if (opts?.exceptIds?.has(edge.id)) continue
      await this.writeRecord(
        {
          ...edge,
          isCurrent: false,
          validTo: now,
          updatedAt: now
        },
        { collection: 'edges' }
      )
      count += 1
    }
    if (count > 0) {
      await this.compactShard('edges', shardMonth)
    }
    return count
  }
}
