import type { IFileSystem } from '../../fs/file-system.types'
import type { IStoragePathService } from '../../vault/storage-path.types'
import * as path from '../../fs/path.util'
import { shardMonthFromInstant } from '../raw-data-month.util'
import {
  MonthlyJsonlStore,
  collapseJsonlById
} from '../stores/monthly-jsonl.store'
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

const COLLECTIONS: GraphCollection[] = ['nodes', 'edges', 'extract-state']
const NODES_IDMAP_FILE = 'nodes.idmap.json'

export interface NodesIdMapFile {
  schemaVersion: 1
  updatedAt: number
  map: Record<string, string>
}

function shardMonthForNode(row: GraphNodeRawRecord): string {
  return shardMonthFromInstant(row.firstSeenAt || row.createdAt)
}

function shardMonthForEdge(row: GraphEdgeRawRecord): string {
  if (row.shardMonth) return row.shardMonth
  if (row.sourceKind === 'diary' && row.sourceRef) {
    const m = row.sourceRef.match(/(\d{4})[-/](\d{2})[-/]\d{2}/)
    if (m) return `${m[1]}-${m[2]}`
  }
  if (row.validFrom != null) return shardMonthFromInstant(row.validFrom)
  return shardMonthFromInstant(row.createdAt)
}

/**
 * Graph JSONL: Graph/{nodes|edges|extract-state}/YYYY-MM.jsonl
 * Each collection has its own shards.manifest.json under the subdir.
 * Optional Graph/nodes.idmap.json: nodeId → shardMonth.
 */
export class GraphRawManager implements RecordCollectionKindManager {
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

  private async idmapPath(): Promise<string> {
    return path.join(await this.getRoot(), NODES_IDMAP_FILE)
  }

  private async readIdmap(): Promise<NodesIdMapFile> {
    const file = await this.idmapPath()
    if (!(await this.fs.exists(file))) {
      return { schemaVersion: 1, updatedAt: Date.now(), map: {} }
    }
    try {
      const raw = await this.fs.readFile(file, 'utf8')
      const parsed = JSON.parse(raw) as NodesIdMapFile
      if (!parsed || typeof parsed !== 'object' || typeof parsed.map !== 'object' || !parsed.map) {
        return { schemaVersion: 1, updatedAt: Date.now(), map: {} }
      }
      return {
        schemaVersion: 1,
        updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
        map: parsed.map
      }
    } catch {
      return { schemaVersion: 1, updatedAt: Date.now(), map: {} }
    }
  }

  private async writeIdmap(idmap: NodesIdMapFile): Promise<void> {
    const root = await this.getRoot()
    await this.fs.mkdir(root, { recursive: true })
    await this.fs.writeFile(
      await this.idmapPath(),
      JSON.stringify(
        { schemaVersion: 1 as const, updatedAt: Date.now(), map: idmap.map },
        null,
        2
      ),
      'utf8'
    )
  }

  private async upsertNodeIdmapEntry(id: string, shardMonth: string): Promise<void> {
    const idmap = await this.readIdmap()
    if (idmap.map[id] === shardMonth) return
    idmap.map[id] = shardMonth
    await this.writeIdmap(idmap)
  }

  /** Lookup nodeId → shardMonth from nodes.idmap.json (null if missing). */
  async lookupNodeShardMonth(id: string): Promise<string | null> {
    const idmap = await this.readIdmap()
    return idmap.map[id] ?? null
  }

  /** Rebuild Graph/nodes.idmap.json by scanning all node shards. */
  async rebuildIdmap(): Promise<number> {
    const store = await this.getStore('nodes')
    const shards = await store.listShards()
    const map: Record<string, string> = {}
    for (const shard of shards) {
      const rows = collapseJsonlById(
        (await store.readRecords(shard.shardMonth)) as GraphNodeRawRecord[]
      )
      for (const row of rows) {
        if (row?.id) map[row.id] = shard.shardMonth
      }
    }
    await this.writeIdmap({ schemaVersion: 1, updatedAt: Date.now(), map })
    return Object.keys(map).length
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
    } else if (collection === 'edges') {
      const row = record as GraphEdgeRawRecord
      if (!row?.id || !row.fromId || !row.toId) {
        throw new Error('GraphRawManager.writeRecord(edges): invalid edge record')
      }
      shardMonth = shardMonthForEdge(row)
      if (!row.shardMonth) (record as GraphEdgeRawRecord).shardMonth = shardMonth
    } else {
      const row = record as GraphExtractStateRawRecord
      if (!row?.id || !row.filePath) {
        throw new Error('GraphRawManager.writeRecord(extract-state): invalid record')
      }
      shardMonth = shardMonthFromInstant(row.extractedAt || row.updatedAt)
    }
    const written = await store.appendRecord(shardMonth, record)
    if (collection === 'nodes') {
      const row = record as GraphNodeRawRecord
      await this.upsertNodeIdmapEntry(row.id, shardMonth)
    }
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
    const store = await this.getStore(collection)
    const now = Date.now()
    let shardMonth = opts.shardMonth
    if (!shardMonth && collection === 'nodes') {
      shardMonth = (await this.lookupNodeShardMonth(id)) ?? undefined
    }
    if (!shardMonth) {
      const shards = await store.listShards()
      for (const shard of [...shards].reverse()) {
        const rows = collapseJsonlById(
          (await store.readRecords(shard.shardMonth)) as Array<{
            id: string
            updatedAt: number
          }>
        )
        const hit = rows.find((r) => r.id === id) as Record<string, unknown> | undefined
        if (hit) {
          await store.appendRecord(shard.shardMonth, {
            ...hit,
            updatedAt: now,
            deletedAt: now
          })
          // Keep idmap entry so future lookups still find the shard
          return
        }
      }
      throw new Error(`Graph tombstone: id not found: ${id}`)
    }
    const rows = collapseJsonlById(
      (await store.readRecords(shardMonth)) as Array<{ id: string; updatedAt: number }>
    )
    const hit = rows.find((r) => r.id === id) as Record<string, unknown> | undefined
    if (!hit) throw new Error(`Graph tombstone: id not found in ${collection}/${shardMonth}`)
    await store.appendRecord(shardMonth, {
      ...hit,
      updatedAt: now,
      deletedAt: now
    })
  }

  /** Atomically rewrite a collection monthly shard (e.g. sync LWW merge). */
  async replaceShardContent(
    collection: GraphCollection,
    shardMonth: string,
    content: string
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string }> {
    const store = await this.getStore(collection)
    const written = await store.replaceShardContent(shardMonth, content)
    if (collection === 'nodes') {
      // Refresh idmap entries for ids present in this shard (full rebuild is safer after LWW)
      await this.rebuildIdmap()
    }
    return {
      ...written,
      relativePath: `${collection}/${written.relativePath}`
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
    const file = relativePath.includes('/')
      ? relativePath.split(/[/\\]/).pop()!
      : relativePath
    const store = await this.getStore(collection as GraphCollection)
    await store.markIndexed(file, contentHash)
  }

  async readCollapsedNodes(shardMonth: string): Promise<GraphNodeRawRecord[]> {
    const store = await this.getStore('nodes')
    return collapseJsonlById(
      (await store.readRecords(shardMonth)) as GraphNodeRawRecord[]
    )
  }

  async readCollapsedEdges(shardMonth: string): Promise<GraphEdgeRawRecord[]> {
    const store = await this.getStore('edges')
    return collapseJsonlById(
      (await store.readRecords(shardMonth)) as GraphEdgeRawRecord[]
    )
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
   * Keeps user-origin edges. Optionally skip newly written edge ids.
   */
  async supersedeAiEdgesBySourceRef(
    sourceRef: string,
    opts?: { exceptIds?: ReadonlySet<string> }
  ): Promise<number> {
    const now = Date.now()
    const edges = await this.readAllCollapsedEdges()
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
    return count
  }
}
