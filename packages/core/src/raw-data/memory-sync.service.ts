import {
  MEMORY_EMBED_GROUP_ID,
  MEMORY_SOURCE_TYPE,
  buildMemoryMetadataJson,
  countPendingMemoriesAgainstLedger,
  hashEmbedSourceContent,
  isVaultId,
  resolveVaultIdFromRecord,
  type MemoryRawRecord
} from '@baishou/shared'
import type { MemoryRawManager } from './managers/memory.raw-manager'
import { collapseJsonlById } from './stores/monthly-jsonl.store'

export { MEMORY_SOURCE_TYPE }

export interface MemoryEmbedItemInput {
  text: string
  sourceType: string
  sourceId: string
  groupId: string
  vaultId: string
  metadataJson?: string
  sourceCreatedAt?: number
}

export interface MemoryEmbedSink {
  embedText(options: MemoryEmbedItemInput): Promise<void>
  embedTextsBatch?(items: ReadonlyArray<MemoryEmbedItemInput>): Promise<void>
  deleteBySource?(sourceType: string, sourceId: string): Promise<void>
  listSourceIdsByType?(
    sourceType: string,
    options?: { groupId?: string; vaultId?: string }
  ): Promise<string[]>
  listLedgerBySource?(
    sourceType: string,
    options?: { vaultId?: string }
  ): Promise<Array<{ sourceId: string; contentHash: string; status: string }>>
}

const MEMORY_EMBED_CONCURRENCY = 4
const MEMORY_EMBED_BATCH_SIZE = 16

/**
 * pending-index → differential embed into memory_embeddings.
 */
export class MemorySyncService {
  private readonly shardRowsCache = new Map<
    string,
    { contentHash: string; rows: MemoryRawRecord[] }
  >()

  constructor(
    private readonly memoryManager: MemoryRawManager,
    private readonly sink: MemoryEmbedSink
  ) {}

  private async readCollapsedShardCached(shard: {
    relativePath: string
    contentHash: string
  }): Promise<MemoryRawRecord[]> {
    const hash = shard.contentHash
    if (hash && hash !== 'dirty') {
      const cached = this.shardRowsCache.get(shard.relativePath)
      if (cached && cached.contentHash === hash) {
        return cached.rows
      }
    }
    const rows = collapseJsonlById(
      (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
    )
    if (hash && hash !== 'dirty') {
      this.shardRowsCache.set(shard.relativePath, { contentHash: hash, rows })
    }
    return rows
  }

  private async embedSingleWithRetry(
    payload: MemoryEmbedItemInput,
    onBeforeItem?: () => Promise<void>
  ): Promise<void> {
    let lastErr: unknown
    for (let attempt = 0; attempt <= 1; attempt++) {
      try {
        await this.sink.embedText(payload)
        lastErr = undefined
        break
      } catch (err) {
        lastErr = err
        if (attempt < 1) {
          await onBeforeItem?.()
        }
      }
    }
    if (lastErr !== undefined) {
      throw lastErr
    }
  }

  async syncPendingIndex(options?: {
    vaultName?: string
    vaultId?: string
    /**
     * 默认 true，保持手动补齐路径仍嵌入缺失行。
     * 同步下载传 false：跳过 embedText，含待嵌入活行的分片不 commitIndexed。
     */
    embedMissing?: boolean
    /** 嵌入每条记忆前调用的钩子（用于取消/暂停检查） */
    onBeforeItem?: () => Promise<void>
  }): Promise<{ shards: number; upserted: number; deleted: number }> {
    const embedMissing = options?.embedMissing !== false
    const pending = await this.memoryManager.listPendingIndex()
    let upserted = 0
    let deleted = 0
    let inferredVault = options?.vaultName

    let ledgerBySourceId: Map<string, { contentHash: string; status: string }> | null = null
    if (embedMissing && pending.length > 0 && this.sink.listLedgerBySource) {
      try {
        const ledgerRows = await this.sink.listLedgerBySource(MEMORY_SOURCE_TYPE, {
          vaultId: options?.vaultId?.trim() || undefined
        })
        ledgerBySourceId = new Map(
          ledgerRows.map((row) => [
            row.sourceId,
            { contentHash: row.contentHash, status: row.status }
          ])
        )
      } catch {
        ledgerBySourceId = null
      }
    }

    for (const shard of pending) {
      await options?.onBeforeItem?.()
      const rows = await this.readCollapsedShardCached(shard)

      let hasPendingLiveRows = false
      const toEmbed: MemoryEmbedItemInput[] = []
      for (const row of rows) {
        if (!row?.id) continue
        await options?.onBeforeItem?.()
        if (!inferredVault && row.vaultName) inferredVault = row.vaultName
        if (row.deletedAt != null) {
          await this.sink.deleteBySource?.(MEMORY_SOURCE_TYPE, row.id)
          deleted += 1
          continue
        }
        if (!embedMissing) {
          hasPendingLiveRows = true
          continue
        }
        if (ledgerBySourceId) {
          const existing = ledgerBySourceId.get(row.id)
          const rowHash = hashEmbedSourceContent(row.content ?? '')
          if (existing?.status === 'embedded' && existing.contentHash === rowHash) {
            continue
          }
        }
        toEmbed.push({
          text: row.content,
          sourceType: MEMORY_SOURCE_TYPE,
          sourceId: row.id,
          groupId: MEMORY_EMBED_GROUP_ID,
          vaultId: resolveVaultIdFromRecord({
            vaultId: row.vaultId,
            vaultName: row.vaultName,
            inferredVaultName: inferredVault
          }),
          metadataJson: buildMemoryMetadataJson(row),
          sourceCreatedAt: row.createdAt
        })
      }

      if (toEmbed.length > 0) {
        if (typeof this.sink.embedTextsBatch === 'function' && toEmbed.length > 1) {
          for (let i = 0; i < toEmbed.length; i += MEMORY_EMBED_BATCH_SIZE) {
            await options?.onBeforeItem?.()
            const slice = toEmbed.slice(i, i + MEMORY_EMBED_BATCH_SIZE)
            try {
              await this.sink.embedTextsBatch(slice)
              upserted += slice.length
            } catch {
              for (const item of slice) {
                await options?.onBeforeItem?.()
                await this.embedSingleWithRetry(item, options?.onBeforeItem)
                upserted += 1
              }
            }
          }
        } else {
          let cursor = 0
          const workerCount = Math.min(MEMORY_EMBED_CONCURRENCY, toEmbed.length)
          await Promise.all(
            Array.from({ length: workerCount }, async () => {
              while (cursor < toEmbed.length) {
                const item = toEmbed[cursor++]!
                await options?.onBeforeItem?.()
                await this.embedSingleWithRetry(item, options?.onBeforeItem)
                upserted += 1
              }
            })
          )
        }
      }

      if (embedMissing || !hasPendingLiveRows) {
        await this.memoryManager.commitIndexed(shard.relativePath, shard.contentHash)
      }
    }

    await options?.onBeforeItem?.()
    const orphansCleaned = await this.sweepOrphans({
      inferredVaultName: inferredVault,
      vaultId: options?.vaultId,
      vaultName: options?.vaultName
    })
    deleted += orphansCleaned

    return { shards: pending.length, upserted, deleted }
  }

  /**
   * 待嵌入记忆条数：只读 pending 分片，再和账本比。
   */
  async countPendingFromShards(options?: { vaultId?: string }): Promise<number> {
    const pending = await this.memoryManager.listPendingIndex()
    const liveRows: Array<{ id: string; content: string }> = []
    const vaultId = options?.vaultId?.trim()

    for (const shard of pending) {
      const rows = await this.readCollapsedShardCached(shard)
      for (const row of rows) {
        if (!row?.id || row.deletedAt != null) continue
        if (vaultId) {
          const rowVaultId = resolveVaultIdFromRecord({
            vaultId: row.vaultId,
            vaultName: row.vaultName
          })
          if (rowVaultId !== vaultId) continue
        }
        liveRows.push({ id: row.id, content: row.content })
      }
    }

    const ledgerRows = this.sink.listLedgerBySource
      ? await this.sink.listLedgerBySource(MEMORY_SOURCE_TYPE, {
          vaultId: vaultId || undefined
        })
      : []
    const ledgerBySourceId = new Map(
      ledgerRows.map((row) => [row.sourceId, { contentHash: row.contentHash, status: row.status }])
    )
    return countPendingMemoriesAgainstLedger(liveRows, ledgerBySourceId)
  }

  private async sweepOrphans(scope?: {
    inferredVaultName?: string
    vaultId?: string
    vaultName?: string
  }): Promise<number> {
    if (!this.sink.listSourceIdsByType || !this.sink.deleteBySource) return 0

    const { liveIdsByVault, inferredVault: fromJsonl } = await this.collectLiveState()
    const vaults = this.resolveVaults(liveIdsByVault, {
      inferredVaultName: scope?.inferredVaultName ?? scope?.vaultName ?? fromJsonl,
      vaultId: scope?.vaultId
    })
    let deleted = 0

    for (const vault of vaults) {
      const liveIds = liveIdsByVault.get(vault) ?? new Set<string>()
      const vaultId = vault
      const dbIds = await this.sink.listSourceIdsByType(MEMORY_SOURCE_TYPE, {
        groupId: MEMORY_EMBED_GROUP_ID,
        vaultId
      })
      for (const id of dbIds) {
        if (!liveIds.has(id)) {
          await this.sink.deleteBySource(MEMORY_SOURCE_TYPE, id)
          deleted += 1
        }
      }
    }
    return deleted
  }

  private async collectLiveState(): Promise<{
    liveIdsByVault: Map<string, Set<string>>
    inferredVault?: string
  }> {
    const liveIdsByVault = new Map<string, Set<string>>()
    let inferredVault: string | undefined

    const liveShardPaths = new Set<string>()
    for (const shard of await this.memoryManager.listShards()) {
      liveShardPaths.add(shard.relativePath)
      const rows = await this.readCollapsedShardCached(shard)
      for (const row of rows) {
        if (!row?.id || row.deletedAt != null) continue
        const vaultKey = resolveVaultIdFromRecord({
          vaultId: row.vaultId,
          vaultName: row.vaultName
        })
        if (!inferredVault && row.vaultName) inferredVault = row.vaultName
        let set = liveIdsByVault.get(vaultKey)
        if (!set) {
          set = new Set()
          liveIdsByVault.set(vaultKey, set)
        }
        set.add(row.id)
      }
    }
    for (const cachedPath of this.shardRowsCache.keys()) {
      if (!liveShardPaths.has(cachedPath)) {
        this.shardRowsCache.delete(cachedPath)
      }
    }

    return { liveIdsByVault, inferredVault }
  }

  private resolveVaults(
    liveIdsByVault: Map<string, Set<string>>,
    scope?: { inferredVaultName?: string; vaultId?: string }
  ): Set<string> {
    const vaults = new Set<string>(liveIdsByVault.keys())
    const explicitId = scope?.vaultId?.trim()
    if (explicitId) {
      vaults.add(explicitId)
      return vaults
    }
    const inferred = scope?.inferredVaultName?.trim()
    if (inferred) {
      vaults.add(
        resolveVaultIdFromRecord({
          vaultId: isVaultId(inferred) ? inferred : undefined,
          inferredVaultName: isVaultId(inferred) ? undefined : inferred
        })
      )
    }
    return vaults
  }
}
