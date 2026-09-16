import {
  MEMORY_EMBED_GROUP_ID,
  MEMORY_SOURCE_TYPE,
  buildMemoryMetadataJson,
  countPendingMemoriesAgainstLedger,
  isVaultId,
  resolveVaultIdFromRecord,
  type MemoryRawRecord
} from '@baishou/shared'
import type { MemoryRawManager } from './managers/memory.raw-manager'
import { collapseJsonlById } from './stores/monthly-jsonl.store'

export { MEMORY_SOURCE_TYPE }

export interface MemoryEmbedSink {
  embedText(options: {
    text: string
    sourceType: string
    sourceId: string
    groupId: string
    vaultId: string
    metadataJson?: string
    sourceCreatedAt?: number
  }): Promise<void>
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

/**
 * pending-index → differential embed into memory_embeddings.
 */
export class MemorySyncService {
  constructor(
    private readonly memoryManager: MemoryRawManager,
    private readonly sink: MemoryEmbedSink
  ) {}

  async syncPendingIndex(options?: {
    vaultName?: string
    vaultId?: string
    /**
     * 默认 true，保持手动补齐路径仍嵌入缺失行。
     * 同步下载传 false：跳过 embedText，含待嵌入活行的分片不 commitIndexed。
     */
    embedMissing?: boolean
  }): Promise<{ shards: number; upserted: number; deleted: number }> {
    const embedMissing = options?.embedMissing !== false
    const pending = await this.memoryManager.listPendingIndex()
    let upserted = 0
    let deleted = 0
    let inferredVault = options?.vaultName

    for (const shard of pending) {
      const rows = collapseJsonlById(
        (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
      )

      let hasPendingLiveRows = false
      for (const row of rows) {
        if (!row?.id) continue
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
        await this.sink.embedText({
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
        upserted += 1
      }

      if (embedMissing || !hasPendingLiveRows) {
        await this.memoryManager.commitIndexed(shard.relativePath, shard.contentHash)
      }
    }

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
      const rows = collapseJsonlById(
        (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
      )
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

    for (const shard of await this.memoryManager.listShards()) {
      const rows = collapseJsonlById(
        (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
      )
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
