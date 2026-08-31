import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { collapseJsonlById, MonthlyJsonlStore } from '../raw-data/stores/monthly-jsonl.store'
import { isValidShardMonth } from '../raw-data/raw-data-month.util'
import {
  isValidNotebookGraphShardKey,
  NOTEBOOK_GRAPH_LEGACY_SHARD_KEY
} from '../raw-data/notebook-graph-shard-key.util'
import type {
  NotebookGraphCollection,
  NotebookGraphEdgeRawRecord,
  NotebookGraphExtractStateRawRecord,
  NotebookGraphNodeRawRecord
} from '@baishou/shared'
import { logger } from '@baishou/shared'
import type { IStoragePathService } from '../vault/storage-path.types'
import type { NotebookGraphExtractRaw } from './notebook-graph-extract-raw'
import type { NotebookGraphIndexSource } from './notebook-graph-index-source'
import {
  groupLegacyNotebookGraphRows,
  resolveNotebookGraphShardKey
} from './notebook-graph-legacy-migrate.util'

const COLLECTIONS: NotebookGraphCollection[] = ['nodes', 'edges', 'extract-state']

function toJsonl(records: unknown[]): string {
  if (records.length === 0) return ''
  return `${records.map((row) => JSON.stringify(row)).join('\n')}\n`
}

export class NotebookGraphRawManager implements NotebookGraphIndexSource, NotebookGraphExtractRaw {
  private stores = new Map<string, MonthlyJsonlStore>()
  private migratedNotebooks = new Set<string>()

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fs: IFileSystem
  ) {}

  private async rootFor(notebookId: string): Promise<string> {
    const base = await this.pathService.getNotebooksBaseDirectory()
    return path.join(base, notebookId, 'graph')
  }

  private async getStore(
    notebookId: string,
    collection: NotebookGraphCollection
  ): Promise<MonthlyJsonlStore> {
    const key = `${notebookId}:${collection}`
    const cached = this.stores.get(key)
    if (cached) return cached
    const root = await this.rootFor(notebookId)
    const store = new MonthlyJsonlStore({
      fs: this.fs,
      rootDir: path.join(root, collection),
      isValidShardKey: isValidNotebookGraphShardKey
    })
    this.stores.set(key, store)
    return store
  }

  resetCache(): void {
    this.stores.clear()
    this.migratedNotebooks.clear()
  }

  async migrateLegacyMonthShards(notebookId: string): Promise<{ migrated: boolean }> {
    const id = notebookId.trim()
    if (!id) return { migrated: false }
    if (this.migratedNotebooks.has(id)) return { migrated: false }

    const monthStems = new Map<NotebookGraphCollection, string[]>()
    let hasLegacy = false
    for (const collection of COLLECTIONS) {
      const store = await this.getStore(id, collection)
      const months = (await store.listJsonlStems()).filter(isValidShardMonth)
      monthStems.set(collection, months)
      if (months.length > 0) hasLegacy = true
    }
    if (!hasLegacy) {
      this.migratedNotebooks.add(id)
      return { migrated: false }
    }

    const readMonthRows = async <T>(collection: NotebookGraphCollection): Promise<T[]> => {
      const store = await this.getStore(id, collection)
      const rows: T[] = []
      for (const month of monthStems.get(collection) ?? []) {
        rows.push(...((await store.readRecords(month)) as T[]))
      }
      return collapseJsonlById(
        rows as Array<{ id: string; updatedAt: number; deletedAt?: number | null }>
      ) as T[]
    }

    const grouped = groupLegacyNotebookGraphRows({
      nodes: await readMonthRows<NotebookGraphNodeRawRecord>('nodes'),
      edges: await readMonthRows<NotebookGraphEdgeRawRecord>('edges'),
      extractStates: await readMonthRows<NotebookGraphExtractStateRawRecord>('extract-state')
    })

    const mergeAndReplace = async (
      collection: NotebookGraphCollection,
      bySource: Map<string, unknown[]>
    ) => {
      const store = await this.getStore(id, collection)
      for (const [sourceId, incoming] of bySource) {
        if (!isValidNotebookGraphShardKey(sourceId)) continue
        const existing = collapseJsonlById(
          (await store.readRecords(sourceId)) as Array<{
            id: string
            updatedAt: number
            deletedAt?: number | null
          }>
        )
        const merged = collapseJsonlById([
          ...existing,
          ...(incoming as Array<{ id: string; updatedAt: number; deletedAt?: number | null }>)
        ]).filter((row) => !row.deletedAt)
        await store.replaceShardContent(sourceId, toJsonl(merged))
      }
    }

    await mergeAndReplace('edges', grouped.edgesBySource)
    await mergeAndReplace('nodes', grouped.nodesBySource)
    await mergeAndReplace('extract-state', grouped.extractStatesBySource)

    for (const collection of COLLECTIONS) {
      const store = await this.getStore(id, collection)
      for (const month of monthStems.get(collection) ?? []) {
        await store.removeShardFile(month)
      }
    }

    this.migratedNotebooks.add(id)
    logger.info('[NotebookGraph] migrated month shards to source shards', { notebookId: id })
    return { migrated: true }
  }

  async writeRecord(
    notebookId: string,
    collection: NotebookGraphCollection,
    record: {
      id: string
      shardMonth?: string
      sourceId?: string
      sourceRef?: string | null
      createdAt?: number
      firstSeenAt?: number
    }
  ): Promise<void> {
    await this.migrateLegacyMonthShards(notebookId)
    const store = await this.getStore(notebookId, collection)
    const shardKey =
      resolveNotebookGraphShardKey(record) ??
      (record.shardMonth?.trim() === NOTEBOOK_GRAPH_LEGACY_SHARD_KEY
        ? NOTEBOOK_GRAPH_LEGACY_SHARD_KEY
        : null)
    if (!shardKey || !isValidNotebookGraphShardKey(shardKey)) {
      throw new Error(`Invalid notebook graph shard key for ${collection}:${record.id}`)
    }
    ;(record as { shardMonth?: string }).shardMonth = shardKey
    await store.appendRecord(shardKey, record)
  }

  async replaceShard(
    notebookId: string,
    collection: NotebookGraphCollection,
    sourceId: string,
    records: unknown[]
  ): Promise<void> {
    await this.migrateLegacyMonthShards(notebookId)
    const key = sourceId.trim()
    if (!isValidNotebookGraphShardKey(key)) {
      throw new Error(`Invalid notebook graph shard key: ${sourceId}`)
    }
    const store = await this.getStore(notebookId, collection)
    const stamped = records.map((row) =>
      row && typeof row === 'object'
        ? { ...(row as Record<string, unknown>), shardMonth: key }
        : row
    )
    await store.replaceShardContent(key, toJsonl(stamped))
  }

  async replaceSourceGraph(input: {
    notebookId: string
    sourceId: string
    nodes: NotebookGraphNodeRawRecord[]
    edges: NotebookGraphEdgeRawRecord[]
    extractState: NotebookGraphExtractStateRawRecord
  }): Promise<void> {
    const sourceId = input.sourceId.trim()
    if (!isValidNotebookGraphShardKey(sourceId) || sourceId === NOTEBOOK_GRAPH_LEGACY_SHARD_KEY) {
      throw new Error(`Invalid notebook graph sourceId: ${input.sourceId}`)
    }
    await this.replaceShard(
      input.notebookId,
      'nodes',
      sourceId,
      input.nodes.map((row) => ({ ...row, shardMonth: sourceId, deletedAt: null }))
    )
    await this.replaceShard(
      input.notebookId,
      'edges',
      sourceId,
      input.edges.map((row) => ({ ...row, shardMonth: sourceId, deletedAt: null }))
    )
    await this.replaceShard(input.notebookId, 'extract-state', sourceId, [
      { ...input.extractState, shardMonth: sourceId, deletedAt: null }
    ])
  }

  async deleteSourceShards(notebookId: string, sourceId: string): Promise<void> {
    const key = sourceId.trim()
    if (!isValidNotebookGraphShardKey(key)) return
    for (const collection of COLLECTIONS) {
      const store = await this.getStore(notebookId, collection)
      await store.deleteShard(key)
    }
  }

  async readCollapsed<T extends { id: string; updatedAt: number; deletedAt?: number | null }>(
    notebookId: string,
    collection: NotebookGraphCollection
  ): Promise<T[]> {
    await this.migrateLegacyMonthShards(notebookId)
    const store = await this.getStore(notebookId, collection)
    const shards = await store.listShards()
    const rows: T[] = []
    for (const shard of shards) {
      const raw = (await store.readRecords(shard.shardMonth)) as T[]
      rows.push(...raw)
    }
    return collapseJsonlById(rows).filter((r) => !r.deletedAt)
  }

  async listShardMonths(notebookId: string, collection: NotebookGraphCollection): Promise<string[]> {
    await this.migrateLegacyMonthShards(notebookId)
    const store = await this.getStore(notebookId, collection)
    const shards = await store.listShards()
    return shards.map((s) => s.shardMonth)
  }

  async invalidateIndexedHashes(notebookId: string): Promise<void> {
    await this.migrateLegacyMonthShards(notebookId)
    for (const collection of COLLECTIONS) {
      const store = await this.getStore(notebookId, collection)
      await store.invalidateIndexedHashes()
    }
  }

  async listPendingIndex(
    notebookId: string
  ): Promise<Array<{ collection: NotebookGraphCollection; shardMonth: string; contentHash: string }>> {
    await this.migrateLegacyMonthShards(notebookId)
    const out: Array<{
      collection: NotebookGraphCollection
      shardMonth: string
      contentHash: string
    }> = []
    for (const collection of COLLECTIONS) {
      const store = await this.getStore(notebookId, collection)
      const pending = await store.listPendingIndex()
      for (const shard of pending) {
        out.push({ collection, shardMonth: shard.shardMonth, contentHash: shard.contentHash })
      }
    }
    return out
  }

  async commitIndexed(
    notebookId: string,
    collection: NotebookGraphCollection,
    shardMonth: string,
    contentHash: string
  ): Promise<void> {
    const store = await this.getStore(notebookId, collection)
    await store.markIndexed(`${shardMonth}.jsonl`, contentHash)
  }

  async readShardRecords(
    notebookId: string,
    collection: NotebookGraphCollection,
    shardMonth: string
  ): Promise<unknown[]> {
    await this.migrateLegacyMonthShards(notebookId)
    const store = await this.getStore(notebookId, collection)
    return store.readRecords(shardMonth)
  }

  async getExtractState(
    notebookId: string,
    sourceId: string
  ): Promise<NotebookGraphExtractStateRawRecord | null> {
    await this.migrateLegacyMonthShards(notebookId)
    const key = sourceId.trim()
    if (!isValidNotebookGraphShardKey(key)) return null
    const rows = collapseJsonlById(
      (await this.readShardRecords(notebookId, 'extract-state', key)) as Array<
        NotebookGraphExtractStateRawRecord & { updatedAt: number }
      >
    )
    return rows.find((row) => row.sourceId === key && !row.deletedAt) ?? null
  }

  async writeExtractState(record: NotebookGraphExtractStateRawRecord): Promise<void> {
    await this.writeRecord(record.notebookId, 'extract-state', record)
  }

  async writeNode(record: NotebookGraphNodeRawRecord): Promise<void> {
    await this.writeRecord(record.notebookId, 'nodes', record)
  }

  async writeEdge(record: NotebookGraphEdgeRawRecord): Promise<void> {
    await this.writeRecord(record.notebookId, 'edges', record)
  }

  async removeRecordsFromShard(
    notebookId: string,
    collection: NotebookGraphCollection,
    shardKey: string,
    ids: readonly string[]
  ): Promise<number> {
    const idSet = new Set(ids.map((id) => id.trim()).filter(Boolean))
    if (idSet.size === 0 || !isValidNotebookGraphShardKey(shardKey)) return 0
    await this.migrateLegacyMonthShards(notebookId)
    const store = await this.getStore(notebookId, collection)
    const rows = collapseJsonlById(
      (await store.readRecords(shardKey)) as Array<{
        id: string
        updatedAt: number
        deletedAt?: number | null
      }>
    )
    const kept = rows.filter((row) => !idSet.has(row.id) && !row.deletedAt)
    const hadTarget = rows.some((row) => idSet.has(row.id))
    if (!hadTarget && kept.length === rows.filter((row) => !row.deletedAt).length) return 0
    await store.replaceShardContent(shardKey, toJsonl(kept))
    return rows.length - kept.length
  }

  async tombstone(
    notebookId: string,
    collection: NotebookGraphCollection,
    id: string,
    shardMonth?: string
  ): Promise<void> {
    const hint = shardMonth?.trim() || undefined
    if (hint && isValidNotebookGraphShardKey(hint)) {
      const removed = await this.removeRecordsFromShard(notebookId, collection, hint, [id])
      if (removed > 0) return
    }
    await this.migrateLegacyMonthShards(notebookId)
    const store = await this.getStore(notebookId, collection)
    for (const shard of [...(await store.listShards())].reverse()) {
      if (hint && shard.shardMonth === hint) continue
      const removed = await this.removeRecordsFromShard(
        notebookId,
        collection,
        shard.shardMonth,
        [id]
      )
      if (removed > 0) return
    }
    throw new Error(`Notebook graph delete: id not found: ${id}`)
  }

  async tombstoneAiEdgesBySourcePrefix(
    notebookId: string,
    sourceRefPrefix: string,
    exceptIds: ReadonlySet<string>
  ): Promise<number> {
    const prefix = sourceRefPrefix.trim()
    if (!prefix) return 0
    const edges = await this.readCollapsed<NotebookGraphEdgeRawRecord>(notebookId, 'edges')
    let n = 0
    for (const edge of edges) {
      if (edge.origin !== 'ai') continue
      if (exceptIds.has(edge.id)) continue
      if (!(edge.sourceRef ?? '').startsWith(prefix)) continue
      try {
        await this.tombstone(notebookId, 'edges', edge.id, edge.shardMonth || undefined)
        n += 1
      } catch (error) {
        logger.warn('[NotebookGraph] tombstone skip', {
          id: edge.id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }
    return n
  }
}
