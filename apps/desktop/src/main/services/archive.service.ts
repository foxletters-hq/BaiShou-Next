import { app, dialog, BrowserWindow } from 'electron'
import i18n from 'i18next'
import { translateMain, logger } from '@baishou/shared'
import { assertArchiveExportOutputPathSafe, estimateArchiveExportSize } from '@baishou/core-desktop'
import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'

import {
  IArchiveService,
  ImportResult,
  VaultService,
  createNodeFileSystem
} from '@baishou/core-desktop'
import { targetDirectoryHasData } from '@baishou/core/shared'
import {
  connectionManager,
  shadowConnectionManager,
  SettingsRepository,
  installDatabaseSchema,
  backfillAgentDatabaseFts,
  enterAgentMigrationArchiveImport,
  exitAgentMigrationArchiveImport
} from '@baishou/database-desktop'
import { getAppDb, resetAppDb } from '../db'
import { DesktopStoragePathService } from './path.service'
import { ZipExporter } from './ZipExporter'
import { SnapshotManager } from './SnapshotManager'
import {
  broadcastArchiveImportState,
  formatExportBytes,
  resolveDefaultExportSavePath,
  formatArchiveExportPathError
} from './archive.service.utils'
import { executeArchiveImportFromZip } from './archive-import.executor'

export class DesktopArchiveService implements IArchiveService {
  private readonly fileSystem = createNodeFileSystem()

  constructor(
    private pathService: DesktopStoragePathService,
    private vaultService: VaultService
  ) {}

  public async exportToTempFile(): Promise<string | null> {
    return new ZipExporter(this.pathService).exportToTempFile()
  }

  public async exportToUserDevice(
    locale?: string,
    parentWindow?: BrowserWindow | null
  ): Promise<string | null> {
    const dt = new Date()
    const ts = `${dt.getFullYear()}${(dt.getMonth() + 1).toString().padStart(2, '0')}${dt.getDate().toString().padStart(2, '0')}_${dt.getHours().toString().padStart(2, '0')}${dt.getMinutes().toString().padStart(2, '0')}`
    const defaultName = `BaiShou_Vault_Backup_${ts}.zip`
    const rootDir = await this.pathService.getRootDirectory()
    const defaultSavePath = resolveDefaultExportSavePath(defaultName, rootDir)

    const { canceled, filePath } = await dialog.showSaveDialog((parentWindow || undefined) as any, {
      title: translateMain(
        locale,
        'settings.archive_export_save_title',
        'Export BaiShou data backup'
      ),
      defaultPath: defaultSavePath,
      filters: [
        {
          name: translateMain(locale, 'settings.archive_zip_filter_name', 'ZIP Archives'),
          extensions: ['zip']
        }
      ]
    })

    if (canceled || !filePath) return null

    try {
      assertArchiveExportOutputPathSafe(filePath, rootDir)
    } catch (e: unknown) {
      const code = e instanceof Error ? e.message : String(e)
      throw new Error(formatArchiveExportPathError(locale, code))
    }

    const estimate = await estimateArchiveExportSize(rootDir, filePath)
    logger.info(
      `[ArchiveService] Export scope: ${estimate.fileCount} files, ${formatExportBytes(estimate.totalBytes)} from ${estimate.rootDir}`
    )

    const warnThresholdBytes = 500 * 1024 * 1024
    if (estimate.totalBytes > warnThresholdBytes) {
      const sizeLabel = formatExportBytes(estimate.totalBytes)
      const { response } = await dialog.showMessageBox((parentWindow || undefined) as any, {
        type: 'warning',
        title: translateMain(
          locale,
          'settings.archive_export_large_title',
          i18n.t('auto.apps.desktop.src.main.services.archive.service.L145', '导出体积异常')
        ),
        message: translateMain(
          locale,
          'settings.archive_export_large_message',
          `即将打包约 ${sizeLabel}（${estimate.fileCount} 个文件），是否继续？`
        ),
        detail: translateMain(
          locale,
          'settings.archive_export_large_detail',
          `数据来源：${estimate.rootDir}\n\n若远大于你在白守里看到的数据量，请取消并在设置中检查存储根目录是否指向了过大的文件夹。`
        ),
        buttons: [
          translateMain(
            locale,
            'settings.archive_export_large_continue',
            i18n.t('auto.apps.desktop.src.main.services.archive.service.L157', '继续导出')
          ),
          translateMain(
            locale,
            'common.cancel',
            i18n.t('auto.apps.desktop.src.main.services.archive.service.L158', '取消')
          )
        ],
        defaultId: 1,
        cancelId: 1
      })
      if (response !== 0) return null
    }

    try {
      await new ZipExporter(this.pathService).exportToPath(filePath)
      return filePath
    } catch (e: unknown) {
      await fsp.unlink(filePath).catch(() => {})
      const msg = e instanceof Error ? e.message : String(e)
      logger.error('[ArchiveService] Export failed:', msg)
      throw e instanceof Error ? e : new Error(msg)
    }
  }

  public async createSnapshot(): Promise<string | null> {
    const zipPath = await this.exportToTempFile()
    if (!zipPath) return null
    return new SnapshotManager().create(zipPath)
  }

  public async importFromZip(
    zipFilePath: string,
    createSnapshotBefore: boolean = true
  ): Promise<ImportResult> {
    let snapshotPath: string | undefined

    if (createSnapshotBefore && (await this.shouldCreatePreImportSnapshot())) {
      logger.info(
        '[ArchiveService] Creating pre-import snapshot to protect existing workspace data…'
      )
      const snap = await this.createSnapshot()
      if (snap) snapshotPath = snap
    } else if (createSnapshotBefore) {
      logger.info(
        '[ArchiveService] Skipping pre-import snapshot: workspace is empty, nothing to protect.'
      )
    }

    broadcastArchiveImportState(true)

    try {
      try {
        const { diaryWatcher } = await import('./diary-watcher.service')
        const { summaryWatcher } = await import('./summary-watcher.service')
        const { sessionWatcher } = await import('./session-watcher.service')
        diaryWatcher.stop()
        summaryWatcher.stop()
        sessionWatcher.stop()
        logger.info('[ArchiveService] File watchers stopped successfully before import.')
      } catch (e: any) {
        logger.error('[ArchiveService] Failed to stop file watchers before import:', e)
      }

      let currentCloudSyncConfig: any = null
      try {
        const settingsRepo = new SettingsRepository(getAppDb())
        currentCloudSyncConfig = await settingsRepo.get<any>('cloud_sync_config')
      } catch (e: any) {
        logger.warn(
          '[ArchiveService] 无法在导入前读取本地的 cloud_sync_config (可能尚无配置):',
          e.message || e
        )
      }

      await connectionManager.disconnect()
      resetAppDb()
      try {
        await shadowConnectionManager.disconnect()
      } catch (e: any) {
        logger.warn('Failed to disconnect shadow DB:', e)
      }

      enterAgentMigrationArchiveImport()
      let importSucceeded = false
      try {
        const result = await executeArchiveImportFromZip(
          {
            pathService: this.pathService,
            vaultService: this.vaultService,
            scheduleBootstrapResyncAfterImport: () => this.scheduleBootstrapResyncAfterImport()
          },
          zipFilePath,
          snapshotPath,
          currentCloudSyncConfig
        )
        importSucceeded = true
        return result
      } finally {
        exitAgentMigrationArchiveImport()
        if (importSucceeded) {
          this.scheduleAgentFtsBackfillAfterImport()
        }
      }
    } finally {
      await this.reconnectAgentDatabaseIfNeeded()
      broadcastArchiveImportState(false)
    }
  }

  private scheduleAgentFtsBackfillAfterImport(): void {
    void (async () => {
      try {
        await backfillAgentDatabaseFts(getAppDb())
        logger.info('[ArchiveService] Agent FTS historical index backfill completed after import.')
      } catch (e: unknown) {
        logger.warn('[ArchiveService] Agent FTS backfill after import failed:', {
          error: e instanceof Error ? e.message : String(e)
        })
      }
    })()
  }

  private async reconnectAgentDatabaseIfNeeded(): Promise<void> {
    if (connectionManager.isConnected()) return

    try {
      const db = getAppDb()
      connectionManager.setDb(db)
      await installDatabaseSchema(db)
      logger.info(
        '[ArchiveService] Agent database reconnected after import was interrupted or failed.'
      )
    } catch (e: any) {
      logger.error('[ArchiveService] Failed to reconnect agent database:', e)
    }

    try {
      const { connectGlobalShadowDb } = await import('../ipc/vault.ipc')
      await connectGlobalShadowDb()
    } catch (e: any) {
      logger.warn('[ArchiveService] Failed to reconnect shadow DB after import rollback:', e)
    }
  }

  private scheduleBootstrapResyncAfterImport(): void {
    void (async () => {
      try {
        const { globalBootstrapper } = await import('./bootstrapper.service')
        await globalBootstrapper.fullyResyncAllEcosystems()
      } catch (e: unknown) {
        logger.error('[ArchiveService] Background resync after import failed:', {
          error: e instanceof Error ? e.message : String(e)
        })
      }
    })()
  }

  public async listSnapshots(): Promise<{ filename: string; createdAt: number; size: number }[]> {
    return new SnapshotManager().list()
  }

  public async deleteSnapshot(filename: string): Promise<void> {
    return new SnapshotManager().delete(filename)
  }

  public async restoreFromSnapshot(filename: string): Promise<ImportResult> {
    const p = path.join(app.getPath('userData'), 'snapshots', filename)
    if (!fs.existsSync(p)) throw new Error('Snapshot not found')
    return this.importFromZip(p, true)
  }

  public async renameSnapshot(oldName: string, newName: string): Promise<void> {
    return new SnapshotManager().rename(oldName, newName)
  }

  public async batchDeleteSnapshots(filenames: string[]): Promise<number> {
    return new SnapshotManager().batchDelete(filenames)
  }

  /** 仅当本地工作区已有数据时才创建导入前快照（与移动端一致；空工作区无需先导出一份空备份） */
  private async shouldCreatePreImportSnapshot(): Promise<boolean> {
    try {
      const rootDir = await this.pathService.getRootDirectory()
      return await targetDirectoryHasData(this.fileSystem, rootDir)
    } catch {
      return true
    }
  }
}
