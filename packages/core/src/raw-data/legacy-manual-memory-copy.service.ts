import type { MemoryRawRecord } from '@baishou/shared'
import type { MemoryRawManager } from './managers/memory.raw-manager'

export interface LegacyManualMemoryVaultRef {
  id: string
  name: string
}

export interface LegacyManualMemoryCopyResult {
  originals: number
  copied: number
  skipped: number
}

export interface LegacyManualMemoryCopyOptions {
  vaults: LegacyManualMemoryVaultRef[]
  /** 返回绑定到该仓库 Memory/ 目录的 manager（调用方可复用活跃仓库实例） */
  getManager: (vault: LegacyManualMemoryVaultRef) => MemoryRawManager
  /**
   * 某仓库写入副本后回调（通常跑 MemorySyncService.syncPendingIndex 排队/触发嵌入）。
   * 未配置嵌入时可不传。
   */
  afterWrite?: (
    vault: LegacyManualMemoryVaultRef,
    manager: MemoryRawManager
  ) => Promise<void>
  newId?: () => string
}

function defaultNewId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `mem_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

/** JSONL 口径：有 legacySourceId、无会话、非副本、未删除 */
export function isLegacyManualMemoryOriginal(row: MemoryRawRecord): boolean {
  if (row.deletedAt != null) return false
  if (row.sourceSessionId !== null) return false
  if (typeof row.legacySourceId !== 'string' || row.legacySourceId.length === 0) return false
  if (typeof row.derivedFromLegacyId === 'string' && row.derivedFromLegacyId.length > 0) {
    return false
  }
  return true
}

async function collectLiveRows(manager: MemoryRawManager): Promise<MemoryRawRecord[]> {
  const out: MemoryRawRecord[] = []
  for (const shard of await manager.listShards()) {
    const rows = await manager.readCollapsedShard(shard.shardMonth)
    for (const row of rows) {
      if (!row?.id || row.deletedAt != null) continue
      out.push(row)
    }
  }
  return out
}

/**
 * V-D7 / V1.6：将遗留手动记忆原件复制到除所属仓库外的每个仓库。
 * 原件不动；幂等靠目标仓库 derivedFromLegacyId；新建仓库不走此路径（仅冷启动一次性）。
 */
export class LegacyManualMemoryCopyService {
  async copyToOtherVaults(
    options: LegacyManualMemoryCopyOptions
  ): Promise<LegacyManualMemoryCopyResult> {
    const vaults = options.vaults.filter((v) => v.id.trim().length > 0 && v.name.trim().length > 0)
    if (vaults.length <= 1) {
      return { originals: 0, copied: 0, skipped: 0 }
    }

    const newId = options.newId ?? defaultNewId
    const managers = new Map<string, MemoryRawManager>()
    const liveByVault = new Map<string, MemoryRawRecord[]>()
    const derivedIndexByVault = new Map<string, Set<string>>()

    for (const vault of vaults) {
      const manager = options.getManager(vault)
      managers.set(vault.id, manager)
      const live = await collectLiveRows(manager)
      liveByVault.set(vault.id, live)
      const derived = new Set<string>()
      for (const row of live) {
        if (typeof row.derivedFromLegacyId === 'string' && row.derivedFromLegacyId.length > 0) {
          derived.add(row.derivedFromLegacyId)
        }
      }
      derivedIndexByVault.set(vault.id, derived)
    }

    type OriginalHit = { vault: LegacyManualMemoryVaultRef; record: MemoryRawRecord }
    const originals: OriginalHit[] = []
    for (const vault of vaults) {
      for (const row of liveByVault.get(vault.id) ?? []) {
        if (isLegacyManualMemoryOriginal(row)) {
          originals.push({ vault, record: row })
        }
      }
    }

    let copied = 0
    let skipped = 0
    const dirtyVaultIds = new Set<string>()

    for (const { vault: sourceVault, record } of originals) {
      for (const target of vaults) {
        if (target.id === sourceVault.id) continue
        const derived = derivedIndexByVault.get(target.id)!
        if (derived.has(record.id)) {
          skipped += 1
          continue
        }

        const now = Date.now()
        const copy: MemoryRawRecord = {
          id: newId(),
          schemaVersion: 1,
          vaultId: target.id,
          vaultName: target.name,
          content: record.content,
          tags: Array.isArray(record.tags) ? [...record.tags] : [],
          sourceSessionId: null,
          createdAt: record.createdAt,
          updatedAt: now,
          deletedAt: null,
          derivedFromLegacyId: record.id
        }

        const manager = managers.get(target.id)!
        await manager.writeRecord(copy)
        derived.add(record.id)
        dirtyVaultIds.add(target.id)
        copied += 1
      }
    }

    if (options.afterWrite) {
      for (const vault of vaults) {
        if (!dirtyVaultIds.has(vault.id)) continue
        await options.afterWrite(vault, managers.get(vault.id)!)
      }
    }

    return { originals: originals.length, copied, skipped }
  }
}
