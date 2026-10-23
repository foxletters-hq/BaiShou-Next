import { MissingSummaryDetector } from './missing-summary-detector.service'
import { SummaryGeneratorService } from './summary-generator.service'
import { SummaryRepository } from '@baishou/database'
import { deriveLegacyVaultId, isVaultId, MissingSummary, SummaryType } from '@baishou/shared'
import { SummaryFileService } from '../vault/summary-file.service'
import type { DiskResyncOptions } from '../vault/disk-resync.types'

export interface SummarySyncCallbacks {
  onProgress?: (missing: MissingSummary, status: string) => void
  onCompleted?: () => void
  onError?: (error: any) => void
}

export type SyncSummaryFileOptions = {
  /** 冷启动 reconcile：盘 mtime 未新于 DB 时跳过读文件 */
  skipUnchangedByMtime?: boolean
  /** listAllSummaries 已解析的路径，避免重复搜盘 */
  diskPath?: string
  /** 写入/查找时的 vault_id（跨仓扫描时必传） */
  vaultId?: string
}

function toEpochMs(value: unknown): number | undefined {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : undefined
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value
  }
  if (typeof value === 'string' && value.trim()) {
    const ms = Date.parse(value)
    return Number.isFinite(ms) ? ms : undefined
  }
  return undefined
}

function dbRecordTimeMs(record: {
  updatedAt?: unknown
  generatedAt?: unknown
  endDate?: unknown
}): number | undefined {
  return toEpochMs(record.updatedAt) ?? toEpochMs(record.generatedAt) ?? toEpochMs(record.endDate)
}

function normalizeVaultId(raw: string | null | undefined): string | null {
  const value = String(raw ?? '').trim()
  if (!value) return null
  return isVaultId(value) ? value : deriveLegacyVaultId(value)
}

export class SummarySyncService {
  private isSyncing = false

  constructor(
    private readonly detector: MissingSummaryDetector | null,
    private readonly generator: SummaryGeneratorService | null,
    private readonly summaryRepo: SummaryRepository,
    private readonly fileService: SummaryFileService,
    private readonly resolveVaultId?: () => string | null | undefined
  ) {}

  private requireVaultId(override?: string | null): string {
    const id = normalizeVaultId(override) ?? normalizeVaultId(this.resolveVaultId?.())
    if (!id) {
      throw new Error('SummarySyncService: vault_id is required')
    }
    return id
  }

  private resolveVaultIdForName(vaultName: string, options?: DiskResyncOptions): string {
    const mapped = normalizeVaultId(options?.vaultIdByName?.[vaultName])
    if (mapped) return mapped
    return deriveLegacyVaultId(vaultName)
  }

  /**
   * 自动发现所有遗失的总结并调用 AI 补全。
   * @param callbacks 用于 UI 层反馈当前进度的回调。
   */
  async syncMissingSummaries(callbacks?: SummarySyncCallbacks): Promise<void> {
    if (this.isSyncing || !this.detector || !this.generator) return
    this.isSyncing = true

    try {
      const missingList = await this.detector.getAllMissing()

      for (const missing of missingList) {
        let finalContent = ''

        const stringStream = this.generator.generate(missing)

        for await (const chunk of stringStream) {
          if (chunk.startsWith('STATUS:')) {
            callbacks?.onProgress?.(missing, chunk.replace('STATUS:', ''))
          } else {
            finalContent += chunk
          }
        }

        if (finalContent.trim().length > 0) {
          await this.fileService.writeSummary(missing.type, missing.startDate, finalContent)
          await this.syncSummaryFile(missing.type, missing.startDate, missing.endDate)
        }
      }

      callbacks?.onCompleted?.()
    } catch (e: any) {
      callbacks?.onError?.(e)
      console.error('[SummarySyncService] Synchronization stopped due to error', e)
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * 针对单一文件执行与缓存表 DB 之间的对比与同步（脏检查/孤立清理）。
   * 查找记录时不能只依赖 endDate 毫秒级相等：UI 常把周日 23:59:59 收成午夜，
   * 精确 getByDateRange 会失败，导致删文件后幽灵行残留、缺失检测仍认为「已有」。
   */
  async syncSummaryFile(
    type: SummaryType,
    startDate: Date,
    endDate: Date,
    options?: SyncSummaryFileOptions
  ): Promise<void> {
    const vaultId = this.requireVaultId(options?.vaultId)
    let existingDb = await this.summaryRepo.getByDateRange(type, startDate, endDate, vaultId)
    if (!existingDb) {
      const sameDay = await this.summaryRepo.findAllByTypeAndStartDay(type, startDate, vaultId)
      existingDb = sameDay[0] ?? null
    }

    if (options?.skipUnchangedByMtime && existingDb) {
      const diskMtimeMs = await this.fileService.getSummaryFileMtimeMs(
        type,
        startDate,
        options.diskPath
      )
      const dbMs = dbRecordTimeMs(existingDb)
      if (diskMtimeMs != null && dbMs != null && diskMtimeMs <= dbMs) {
        return
      }
    }

    const fileContent = options?.diskPath?.trim()
      ? await this.fileService.readSummaryAtAbsolutePath(options.diskPath.trim())
      : await this.fileService.readSummary(type, startDate)

    if (fileContent == null) {
      const ghosts = await this.summaryRepo.findAllByTypeAndStartDay(type, startDate, vaultId)
      for (const ghost of ghosts) {
        if (ghost.id != null) {
          await this.summaryRepo.delete(ghost.id)
        }
      }
      return
    }

    if (!existingDb) {
      await this.summaryRepo.upsert({
        type,
        startDate,
        endDate,
        content: fileContent,
        vaultId
      })
      return
    }

    const endMismatch =
      existingDb.endDate instanceof Date ? existingDb.endDate.getTime() !== endDate.getTime() : true
    if (existingDb.content !== fileContent || endMismatch) {
      if (endMismatch && existingDb.id != null) {
        await this.summaryRepo.delete(existingDb.id)
        await this.summaryRepo.upsert({
          type,
          startDate,
          endDate,
          content: fileContent,
          vaultId
        })
      } else if (existingDb.id != null) {
        await this.summaryRepo.update(existingDb.id, { content: fileContent })
      } else {
        await this.summaryRepo.upsert({
          type,
          startDate,
          endDate,
          content: fileContent,
          vaultId
        })
      }
    }
  }

  private async pruneGhostsForVault(
    vaultId: string,
    allFiles: ReadonlyArray<{ type: SummaryType; startDate: Date }>
  ): Promise<void> {
    const allDb = await this.summaryRepo.getSummaries({ vaultId })
    if (allDb.length === 0) return

    for (const record of allDb) {
      const isFileExist = allFiles.some(
        (f) => f.type === record.type && f.startDate.getTime() === record.startDate.getTime()
      )
      if (!isFileExist && record.id != null) {
        await this.summaryRepo.delete(record.id)
      }
    }
  }

  /**
   * 网盘启动、重建全库或者数据漫游使用的主动补齐。
   * 传入 diskVaultNames 时跨仓水合；ghost 清理仅限本仓/已扫仓。
   */
  async fullScanArchives(options?: DiskResyncOptions): Promise<void> {
    const vaultNames = [
      ...new Set((options?.diskVaultNames ?? []).map((n) => n.trim()).filter(Boolean))
    ]
    const syncOptsBase: SyncSummaryFileOptions | undefined = options?.skipUnchangedByMtime
      ? { skipUnchangedByMtime: true }
      : undefined

    if (vaultNames.length > 0) {
      const allFiles = await this.fileService.listSummariesAcrossVaults(vaultNames)
      const byVault = new Map<string, typeof allFiles>()
      for (const f of allFiles) {
        const vaultId = this.resolveVaultIdForName(f.vaultName, options)
        const list = byVault.get(vaultId) ?? []
        list.push(f)
        byVault.set(vaultId, list)
      }

      for (const [vaultId, files] of byVault) {
        for (const f of files) {
          await this.syncSummaryFile(f.type, f.startDate, f.endDate, {
            ...syncOptsBase,
            diskPath: f.fullPath,
            vaultId
          })
        }
        await this.pruneGhostsForVault(vaultId, files)
      }
      return
    }

    const vaultId =
      normalizeVaultId(options?.activeVaultId) ??
      (options?.activeVaultName
        ? this.resolveVaultIdForName(options.activeVaultName, options)
        : normalizeVaultId(this.resolveVaultId?.()))

    const allFiles = await this.fileService.listAllSummaries()
    for (const f of allFiles) {
      await this.syncSummaryFile(f.type, f.startDate, f.endDate, {
        ...syncOptsBase,
        diskPath: f.fullPath,
        ...(vaultId ? { vaultId } : {})
      })
    }

    // 仅在明确指定活跃仓时做本仓 ghost 清理（避免无参冷启动误清）
    if (!options?.activeVaultId && !options?.activeVaultName) return
    if (!vaultId) return
    await this.pruneGhostsForVault(vaultId, allFiles)
  }

  isCurrentlySyncing(): boolean {
    return this.isSyncing
  }
}
