import {
  MEMORY_EMBED_GROUP_ID,
  MEMORY_SOURCE_TYPE,
  buildMemoryMetadataJson,
  isVaultId,
  resolveVaultIdFromRecord,
  type MemoryRawRecord
} from '@baishou/shared'
import type { MemoryRawManager } from './managers/memory.raw-manager'
import { collapseJsonlById } from './stores/monthly-jsonl.store'
import { shardMonthFromInstant } from './raw-data-month.util'

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
}

export interface MemoryConsistencyMissingItem {
  id: string
  content: string
  createdAt: number
  updatedAt: number
  vaultName: string
  tags: string[]
  sourceSessionId: string | null
}

export interface MemoryConsistencyReport {
  jsonlLiveCount: number
  vectorCount: number
  missing: MemoryConsistencyMissingItem[]
  orphans: string[]
}

export interface MemoryConsistencyRepairOptions {
  /** JSONL live + no vector → user confirms historical delete: write tombstone. */
  confirmDeleteIds?: string[]
  /** JSONL live + no vector → user wants index back: re-embed. */
  restoreIds?: string[]
  /** Vector has + JSONL has no live row → drop derived rows. */
  cleanOrphans?: boolean
  /** 路径/活跃上下文推导名（兼容） */
  vaultName?: string
  vaultId?: string
}

export interface MemoryConsistencyRepairResult {
  tombstoned: number
  restored: number
  orphansCleaned: number
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
  }): Promise<{ shards: number; upserted: number; deleted: number }> {
    const pending = await this.memoryManager.listPendingIndex()
    let upserted = 0
    let deleted = 0
    let inferredVault = options?.vaultName

    for (const shard of pending) {
      const rows = collapseJsonlById(
        (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
      )

      for (const row of rows) {
        if (!row?.id) continue
        if (!inferredVault && row.vaultName) inferredVault = row.vaultName
        if (row.deletedAt != null) {
          await this.sink.deleteBySource?.(MEMORY_SOURCE_TYPE, row.id)
          deleted += 1
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

      await this.memoryManager.commitIndexed(shard.relativePath, shard.contentHash)
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
   * Diff JSONL live rows vs vector source ids.
   * Missing (JSONL live, no vector) is NOT auto-fixed — caller must let the user choose.
   * Orphans are listed here; syncPendingIndex / repairConsistency(cleanOrphans) can remove them.
   */
  async checkConsistency(options?: {
    vaultName?: string
    vaultId?: string
  }): Promise<MemoryConsistencyReport> {
    const { liveById, liveIdsByVault, inferredVault } = await this.collectLiveState()
    const vaults = this.resolveVaults(liveIdsByVault, {
      inferredVaultName: options?.vaultName ?? inferredVault,
      vaultId: options?.vaultId
    })

    const missing: MemoryConsistencyMissingItem[] = []
    const orphans: string[] = []
    let vectorCount = 0

    if (!this.sink.listSourceIdsByType) {
      return {
        jsonlLiveCount: liveById.size,
        vectorCount: 0,
        missing: [...liveById.values()].map((row) => this.toMissingItem(row)),
        orphans: []
      }
    }

    for (const vault of vaults) {
      const liveIds = liveIdsByVault.get(vault) ?? new Set<string>()
      // liveIdsByVault keys are already stable vault ids after collectLiveState
      const vaultId = vault
      const dbIds = await this.sink.listSourceIdsByType(MEMORY_SOURCE_TYPE, {
        groupId: MEMORY_EMBED_GROUP_ID,
        vaultId
      })
      const dbSet = new Set(dbIds)
      vectorCount += dbIds.length
      for (const id of dbIds) {
        if (!liveIds.has(id)) orphans.push(id)
      }
      for (const id of liveIds) {
        if (!dbSet.has(id)) {
          const row = liveById.get(id)
          if (row) missing.push(this.toMissingItem(row))
        }
      }
    }

    if (vaults.size === 0) {
      for (const row of liveById.values()) {
        missing.push(this.toMissingItem(row))
      }
    }

    return {
      jsonlLiveCount: liveById.size,
      vectorCount,
      missing,
      orphans
    }
  }

  async repairConsistency(
    options: MemoryConsistencyRepairOptions
  ): Promise<MemoryConsistencyRepairResult> {
    let tombstoned = 0
    let restored = 0
    let orphansCleaned = 0

    const confirmDeleteIds = [...new Set(options.confirmDeleteIds ?? [])]
    for (const id of confirmDeleteIds) {
      const live = await this.findLiveRecord(id)
      try {
        await this.memoryManager.tombstone(id, {
          shardMonth: live ? shardMonthFromInstant(live.createdAt) : undefined
        })
        tombstoned += 1
      } catch {
        // already absent
      }
      await this.sink.deleteBySource?.(MEMORY_SOURCE_TYPE, id)
    }

    const restoreIds = [...new Set(options.restoreIds ?? [])]
    for (const id of restoreIds) {
      const live = await this.findLiveRecord(id)
      if (!live || live.deletedAt != null) continue
      await this.sink.embedText({
        text: live.content,
        sourceType: MEMORY_SOURCE_TYPE,
        sourceId: live.id,
        groupId: MEMORY_EMBED_GROUP_ID,
        vaultId: resolveVaultIdFromRecord({
          vaultId: live.vaultId,
          vaultName: live.vaultName
        }),
        metadataJson: buildMemoryMetadataJson(live),
        sourceCreatedAt: live.createdAt
      })
      restored += 1
    }

    if (options.cleanOrphans) {
      orphansCleaned = await this.sweepOrphans({
        inferredVaultName: options.vaultName,
        vaultId: options.vaultId
      })
    }

    return { tombstoned, restored, orphansCleaned }
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
    liveById: Map<string, MemoryRawRecord>
    liveIdsByVault: Map<string, Set<string>>
    inferredVault?: string
  }> {
    const liveById = new Map<string, MemoryRawRecord>()
    const liveIdsByVault = new Map<string, Set<string>>()
    let inferredVault: string | undefined

    for (const shard of await this.memoryManager.listShards()) {
      const rows = collapseJsonlById(
        (await this.memoryManager.readShardRecords(shard.relativePath)) as MemoryRawRecord[]
      )
      for (const row of rows) {
        if (!row?.id || row.deletedAt != null) continue
        liveById.set(row.id, row)
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

    return { liveById, liveIdsByVault, inferredVault }
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

  private toMissingItem(row: MemoryRawRecord): MemoryConsistencyMissingItem {
    return {
      id: row.id,
      content: row.content,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      vaultName: row.vaultName,
      tags: row.tags ?? [],
      sourceSessionId: row.sourceSessionId ?? null
    }
  }

  private async findLiveRecord(id: string): Promise<MemoryRawRecord | undefined> {
    for (const shard of await this.memoryManager.listShards()) {
      const rows = await this.memoryManager.readCollapsedShard(shard.shardMonth)
      const hit = rows.find((r) => r.id === id && r.deletedAt == null)
      if (hit) return hit
    }
    return undefined
  }
}
