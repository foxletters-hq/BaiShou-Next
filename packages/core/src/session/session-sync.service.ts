import { SessionRepository } from '@baishou/database'
import { deriveLegacyVaultId } from '@baishou/shared'
import { SessionFileService } from './session-file.service'
import type { DiskResyncOptions } from '../vault/disk-resync.types'

function toEpochMs(value: unknown): number | undefined {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    // Drizzle timestamp 偶发以秒返回
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : undefined
  }
  return undefined
}

export class SessionSyncService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly fileService: SessionFileService
  ) {}

  /**
   * 同步指定的 JSON Session 到 DB 影子表中。
   * @param vaultName 显式指定工作区时从该 vault 的 Sessions/ 读取
   */
  async syncSessionFile(sessionId: string, vaultName?: string | null): Promise<void> {
    const fileContent = await this.fileService.readSession(sessionId, vaultName)

    if (!fileContent) {
      // 该文件已被从别的端删除同步到本地（成了空气），我们需要从 DB 清除幽灵缓存
      // 注意 SessionRepository.deleteSessions 接收的是数组
      await this.sessionRepo.deleteSessions([sessionId])
      return
    }

    // JSON 解析出来后可能会把 Date 变成 string，我们在 upsertAggregate 内部统一恢复了它。
    await this.sessionRepo.upsertAggregate(fileContent)
  }

  /**
   * 在启动、增量同步完成后调用，重建 AI 会话记忆。
   * 传入 diskVaultNames 时扫描全部工作区 Sessions/（跨 vault），否则仅扫活跃 vault。
   */
  async fullScanArchives(options?: DiskResyncOptions): Promise<void> {
    const vaultNames = [
      ...new Set((options?.diskVaultNames ?? []).map((n) => n.trim()).filter(Boolean))
    ]
    const allFiles =
      vaultNames.length > 0
        ? await this.fileService.listSessionsAcrossVaults(vaultNames)
        : await this.fileService.listAllSessions()
    const allDbSessions = await this.sessionRepo.findAllSessionsAcrossVaults(-1)
    const maxBytes = options?.maxSessionJsonReadBytes

    console.warn('[SessionSync][FullScan]', {
      mode: vaultNames.length > 0 ? 'all-vaults' : 'active-vault-only',
      vaultNames: vaultNames.length > 0 ? vaultNames : undefined,
      fileCount: allFiles.length,
      dbCount: allDbSessions.length
    })

    // 逆向覆写：将存在于 File 系统的数据全部更新倒入 SQLite 中
    let upserted = 0
    let skipped = 0
    for (const f of allFiles) {
      const vaultName = 'vaultName' in f ? f.vaultName : undefined
      try {
        if (maxBytes != null) {
          const byteSize = await this.fileService.getSessionFileByteSize(f.id, vaultName)
          if (byteSize != null && byteSize > maxBytes) {
            console.warn(
              `[SessionSyncService] skip oversized session ${f.id} (${byteSize} bytes, limit ${maxBytes})`
            )
            skipped++
            continue
          }
        }
        const sessionData = await this.fileService.readSession(f.id, vaultName)
        if (sessionData) {
          await this.sessionRepo.upsertAggregate(sessionData)
          upserted++
        }
      } catch (e: any) {
        skipped++
        console.warn(`[SessionSyncService] 同步会话 ${f.id} 失败，跳过（非致命）:`, e)
      }
    }

    const deletedGhosts = await this.cleanupGhostSessions(allFiles, allDbSessions, options)

    console.warn('[SessionSync][FullScan] done', {
      upserted,
      skipped,
      deletedGhosts
    })
  }

  /**
   * 冷启动 reconcile：按磁盘 mtime 与 DB updatedAt 比对，仅读入缺失或更新的会话 JSON。
   * 仍对已扫描 vault 做幽灵清理。
   */
  async reconcileFromDisks(options?: DiskResyncOptions): Promise<void> {
    const vaultNames = [
      ...new Set((options?.diskVaultNames ?? []).map((n) => n.trim()).filter(Boolean))
    ]
    const allFiles =
      vaultNames.length > 0
        ? await this.fileService.listSessionsAcrossVaults(vaultNames)
        : await this.fileService.listAllSessions()
    const allDbSessions = await this.sessionRepo.findAllSessionsAcrossVaults(-1)
    const dbById = new Map(allDbSessions.map((s) => [s.id, s]))
    const maxBytes = options?.maxSessionJsonReadBytes

    console.warn('[SessionSync][Reconcile]', {
      mode: vaultNames.length > 0 ? 'all-vaults' : 'active-vault-only',
      vaultNames: vaultNames.length > 0 ? vaultNames : undefined,
      fileCount: allFiles.length,
      dbCount: allDbSessions.length
    })

    let upserted = 0
    let skippedUnchanged = 0
    let skipped = 0

    for (const f of allFiles) {
      const vaultName = 'vaultName' in f ? f.vaultName : undefined
      try {
        if (maxBytes != null) {
          const byteSize = await this.fileService.getSessionFileByteSize(f.id, vaultName)
          if (byteSize != null && byteSize > maxBytes) {
            console.warn(
              `[SessionSyncService] skip oversized session ${f.id} (${byteSize} bytes, limit ${maxBytes})`
            )
            skipped++
            continue
          }
        }

        const dbRecord = dbById.get(f.id)
        if (dbRecord) {
          const diskMtimeMs = await this.fileService.getSessionFileMtimeMs(f.id, vaultName)
          const dbUpdatedMs = toEpochMs(dbRecord.updatedAt)
          if (diskMtimeMs != null && dbUpdatedMs != null && diskMtimeMs <= dbUpdatedMs) {
            skippedUnchanged++
            continue
          }
        }

        const sessionData = await this.fileService.readSession(f.id, vaultName)
        if (sessionData) {
          await this.sessionRepo.upsertAggregate(sessionData)
          upserted++
        }
      } catch (e: any) {
        skipped++
        console.warn(`[SessionSyncService] reconcile 会话 ${f.id} 失败，跳过（非致命）:`, e)
      }
    }

    const deletedGhosts = await this.cleanupGhostSessions(allFiles, allDbSessions, options)

    console.warn('[SessionSync][Reconcile] done', {
      upserted,
      skippedUnchanged,
      skipped,
      deletedGhosts
    })
  }

  private async cleanupGhostSessions(
    allFiles: ReadonlyArray<{ id: string; vaultName?: string }>,
    allDbSessions: ReadonlyArray<{
      id: string
      vaultName?: string | null
      vaultId?: string | null
    }>,
    options?: DiskResyncOptions
  ): Promise<number> {
    // 兜底：全盘一个会话文件都没读到，但库里仍有会话时，几乎一定是工作区目录未挂载 /
    // 路径异常 / 权限失败，而不是用户真的把所有会话删光了。此时禁止按“幽灵”清库。
    if (allFiles.length === 0 && allDbSessions.length > 0) {
      console.warn('[SessionSyncService] skip ghost cleanup: scan found 0 session files', {
        dbCount: allDbSessions.length,
        activeVaultName: options?.activeVaultName ?? null,
        diskVaultNames: options?.diskVaultNames ?? []
      })
      return 0
    }

    const fileIds = new Set(allFiles.map((f) => f.id))
    const preserveIds = new Set(options?.preserveSessionIds ?? [])
    const toDeleteIds: string[] = []
    const activeVaultName = options?.activeVaultName?.trim()
    const activeVaultId = options?.activeVaultId?.trim()
    const vaultNames = [
      ...new Set((options?.diskVaultNames ?? []).map((n) => n.trim()).filter(Boolean))
    ]
    const scannedVaultSet = vaultNames.length > 0 ? new Set(vaultNames) : null
    // 某些工作区目录存在但一个会话文件都没读到：这可能是同步/挂载还没完成，
    // 不能据此把该工作区的库内会话当幽灵删掉。
    const vaultsWithFiles = new Set(
      allFiles
        .map((f) => ('vaultName' in f ? f.vaultName?.trim() : ''))
        .filter((name): name is string => Boolean(name))
    )
    // DB 行只有 vault_id；把扫描目录名映射成 id，才能在跨仓扫描时正确判断归属。
    const vaultNameById = new Map<string, string>()
    const scannedVaultIds = new Set<string>()
    for (const name of vaultNames) {
      const id = options?.vaultIdByName?.[name]?.trim() || deriveLegacyVaultId(name)
      scannedVaultIds.add(id)
      vaultNameById.set(id, name)
    }
    if (activeVaultId && activeVaultName) {
      vaultNameById.set(activeVaultId, activeVaultName)
    }

    for (const dbRecord of allDbSessions) {
      if (fileIds.has(dbRecord.id)) continue
      if (preserveIds.has(dbRecord.id)) continue

      const legacyVaultName = String(dbRecord.vaultName ?? '').trim()
      const rawVaultId = String(dbRecord.vaultId ?? '').trim()
      const recordVaultName =
        legacyVaultName || (rawVaultId ? (vaultNameById.get(rawVaultId) ?? '') : '')

      if (scannedVaultSet) {
        // 跨 vault 全扫：仅清理「归属已扫工作区」且盘上已无文件的记录
        if (recordVaultName && recordVaultName !== 'default') {
          if (!scannedVaultSet.has(recordVaultName)) continue
          if (vaultsWithFiles.size > 0 && !vaultsWithFiles.has(recordVaultName)) {
            console.warn('[SessionSyncService] skip ghost cleanup for vault with 0 files', {
              vaultName: recordVaultName,
              dbCount: allDbSessions.length
            })
            continue
          }
        } else if (rawVaultId && rawVaultId !== activeVaultId) {
          // 有稳定 id 但无法对应到已扫描目录：保守跳过，避免误删未挂载工作区
          if (!scannedVaultIds.has(rawVaultId)) continue
        }
      } else {
        // 只扫活跃仓：其它仓 / 无法判断归属的记录一律保留
        if (!recordVaultName && !rawVaultId) continue
        if (activeVaultName && recordVaultName && recordVaultName !== activeVaultName) continue
        if (activeVaultId && rawVaultId && rawVaultId !== activeVaultId) continue
        if (!activeVaultName && !activeVaultId) continue
      }

      toDeleteIds.push(dbRecord.id)
    }
    if (toDeleteIds.length > 0) {
      await this.sessionRepo.deleteSessions(toDeleteIds)
    }
    return toDeleteIds.length
  }
}
