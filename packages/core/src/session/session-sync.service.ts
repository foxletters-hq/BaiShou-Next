import { SessionRepository } from '@baishou/database'
import { SessionFileService } from './session-file.service'
import type { DiskResyncOptions } from '../vault/disk-resync.types'

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
    const allDbSessions = await this.sessionRepo.findAllSessions(-1)
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

    // 顺向清理：SQLite 中存在但对应的实体文件已销毁（可能是被彻底孤立淘汰了）
    const fileIds = new Set(allFiles.map((f) => f.id))
    const preserveIds = new Set(options?.preserveSessionIds ?? [])
    const toDeleteIds: string[] = []
    const activeVaultName = options?.activeVaultName
    const scannedVaultSet = vaultNames.length > 0 ? new Set(vaultNames) : null

    for (const dbRecord of allDbSessions) {
      if (fileIds.has(dbRecord.id)) continue
      if (preserveIds.has(dbRecord.id)) continue

      if (scannedVaultSet) {
        // 跨 vault 全扫：仅清理「归属已扫工作区」且盘上已无文件的记录
        const recordVault = dbRecord.vaultName?.trim()
        if (recordVault && recordVault !== 'default' && !scannedVaultSet.has(recordVault)) {
          continue
        }
      } else if (activeVaultName && dbRecord.vaultName !== activeVaultName) {
        continue
      }

      toDeleteIds.push(dbRecord.id)
    }
    if (toDeleteIds.length > 0) {
      await this.sessionRepo.deleteSessions(toDeleteIds)
    }

    console.warn('[SessionSync][FullScan] done', {
      upserted,
      skipped,
      deletedGhosts: toDeleteIds.length
    })
  }
}
