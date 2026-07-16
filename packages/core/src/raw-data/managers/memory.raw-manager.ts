import type { IFileSystem } from '../../fs/file-system.types'
import type { IStoragePathService } from '../../vault/storage-path.types'
import { shardMonthFromInstant } from '../raw-data-month.util'
import {
  MonthlyJsonlStore,
  collapseJsonlById
} from '../stores/monthly-jsonl.store'
import type { MemoryRawRecord } from '@baishou/shared'
import type {
  RecordCollectionKindManager,
  ShardInfo,
  WriteOpts
} from '../raw-data-source.types'
import type { DerivedFreshnessService } from '../derived-freshness.service'

export class MemoryRawManager implements RecordCollectionKindManager {
  readonly kind = 'memory' as const
  readonly shape = 'record-collection' as const

  private store: MonthlyJsonlStore | null = null

  constructor(
    private readonly pathService: IStoragePathService,
    private readonly fs: IFileSystem,
    private readonly freshness: DerivedFreshnessService
  ) {}

  private async getStore(): Promise<MonthlyJsonlStore> {
    if (this.store) return this.store
    const rootDir = await this.pathService.getMemoryBaseDirectory()
    this.store = new MonthlyJsonlStore({ fs: this.fs, rootDir })
    this.freshness.registerStore('memory', this.store)
    return this.store
  }

  /** Invalidate cached store when vault switches. */
  resetCache(): void {
    this.store = null
  }

  async writeRecord(
    record: unknown,
    _opts?: WriteOpts
  ): Promise<{ shardPath: string; relativePath: string; contentHash: string }> {
    const row = record as MemoryRawRecord
    if (!row?.id || typeof row.content !== 'string') {
      throw new Error('MemoryRawManager.writeRecord: invalid memory record')
    }
    const shardMonth = shardMonthFromInstant(row.createdAt)
    const store = await this.getStore()
    return store.appendRecord(shardMonth, row)
  }

  async tombstone(id: string, opts: WriteOpts & { shardMonth?: string }): Promise<void> {
    const store = await this.getStore()
    const now = Date.now()
    let shardMonth = opts.shardMonth
    if (!shardMonth) {
      // Scan shards for latest row with this id
      const shards = await store.listShards()
      for (const shard of [...shards].reverse()) {
        const rows = collapseJsonlById(
          (await store.readRecords(shard.shardMonth)) as MemoryRawRecord[]
        )
        const hit = rows.find((r) => r.id === id)
        if (hit) {
          shardMonth = shard.shardMonth
          await store.appendRecord(shardMonth, {
            ...hit,
            updatedAt: now,
            deletedAt: now
          })
          return
        }
      }
      throw new Error(`Memory tombstone: id not found: ${id}`)
    }
    const rows = collapseJsonlById(
      (await store.readRecords(shardMonth)) as MemoryRawRecord[]
    )
    const hit = rows.find((r) => r.id === id)
    if (!hit) throw new Error(`Memory tombstone: id not found in ${shardMonth}: ${id}`)
    await store.appendRecord(shardMonth, {
      ...hit,
      updatedAt: now,
      deletedAt: now
    })
  }

  async listShards(): Promise<ShardInfo[]> {
    return (await this.getStore()).listShards()
  }

  async readShardRecords(relativePath: string): Promise<unknown[]> {
    return (await this.getStore()).readRecordsByRelativePath(relativePath)
  }

  async listPendingIndex(): Promise<ShardInfo[]> {
    return (await this.getStore()).listPendingIndex()
  }

  async commitIndexed(relativePath: string, contentHash: string): Promise<void> {
    await (await this.getStore()).markIndexed(relativePath, contentHash)
  }

  async readCollapsedShard(shardMonth: string): Promise<MemoryRawRecord[]> {
    const rows = (await (await this.getStore()).readRecords(shardMonth)) as MemoryRawRecord[]
    return collapseJsonlById(rows)
  }
}
