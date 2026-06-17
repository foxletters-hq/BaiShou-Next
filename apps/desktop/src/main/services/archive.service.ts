import { app, dialog, BrowserWindow } from 'electron'
import { translateMain, resetIncrementalSyncMetaAfterFullRestore, logger } from '@baishou/shared'
import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import extract from 'extract-zip'

import { IArchiveService, ImportResult, VaultService } from '@baishou/core-desktop'
import {
  connectionManager,
  shadowConnectionManager,
  SettingsRepository,
  UserProfileRepository,
  installDatabaseSchema
} from '@baishou/database-desktop'
import { getAppDb } from '../db'
import { DesktopStoragePathService } from './path.service'
import { ZipExporter, ARCHIVE_USER_AVATARS_ZIP_PREFIX } from './ZipExporter'
import { MetadataMigrator } from './MetadataMigrator'
import { SnapshotManager } from './SnapshotManager'

function broadcastArchiveImportState(importing: boolean): void {
  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send('archive:import-state', importing)
  }
}

export class DesktopArchiveService implements IArchiveService {
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

    const { canceled, filePath } = await dialog.showSaveDialog((parentWindow || undefined) as any, {
      title: translateMain(
        locale,
        'settings.archive_export_save_title',
        'Export BaiShou data backup'
      ),
      defaultPath: defaultName,
      filters: [
        {
          name: translateMain(locale, 'settings.archive_zip_filter_name', 'ZIP Archives'),
          extensions: ['zip']
        }
      ]
    })

    if (canceled || !filePath) return null

    await new ZipExporter(this.pathService).exportToPath(filePath)
    return filePath
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

    if (createSnapshotBefore) {
      const snap = await this.createSnapshot()
      if (snap) snapshotPath = snap
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
      try {
        await shadowConnectionManager.disconnect()
      } catch (e: any) {
        logger.warn('Failed to disconnect shadow DB:', e)
      }

      return await this.importFromZipAfterDisconnect(
        zipFilePath,
        snapshotPath,
        currentCloudSyncConfig
      )
    } finally {
      await this.reconnectAgentDatabaseIfNeeded()
      broadcastArchiveImportState(false)
    }
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
    } catch (e: unknown) {
      logger.error('[ArchiveService] Failed to reconnect agent database:', e)
    }

    try {
      const { connectGlobalShadowDb } = await import('../ipc/vault.ipc')
      await connectGlobalShadowDb()
    } catch (e: unknown) {
      logger.warn('[ArchiveService] Failed to reconnect shadow DB after import rollback:', e)
    }
  }

  private async importFromZipAfterDisconnect(
    zipFilePath: string,
    snapshotPath: string | undefined,
    currentCloudSyncConfig: any
  ): Promise<ImportResult> {
    const tempExtractDir = path.join(app.getPath('temp'), `archive_extract_${Date.now()}`)
    await fsp.mkdir(tempExtractDir, { recursive: true })

    try {
      await extract(zipFilePath, { dir: tempExtractDir })
    } catch (e) {
      await fsp.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {})
      throw e
    }

    const manifestPath = path.join(tempExtractDir, 'manifest.json')
    let manifest: any = null
    if (fs.existsSync(manifestPath)) {
      try {
        const manifestStr = await fsp.readFile(manifestPath, 'utf8')
        manifest = JSON.parse(manifestStr)
        logger.info('[ArchiveService] 读取备份元数据成功:', manifest)
      } catch (manifestErr: any) {
        logger.warn('[ArchiveService] 发现 manifest.json 但读取失败，将视为普通备份:', manifestErr)
      }
    }

    const migrator = new MetadataMigrator()
    const CURRENT_FORMAT_VERSION = 1
    migrator.validateManifest(manifest, CURRENT_FORMAT_VERSION)

    const rootDir = await this.pathService.getRootDirectory()
    const migrated = await migrator.migrateLegacyIfNecessary(manifest, tempExtractDir, rootDir)

    if (!migrated) {
      logger.info('ArchiveService: Detected Next Architecture. Restoring Standard Data...')

      if (fs.existsSync(rootDir)) {
        try {
          await fsp.rm(rootDir, { recursive: true, force: true })
        } catch (e: any) {
          logger.error('Fatal file lock error while wiping root', e)
        }
      }
      await fsp.mkdir(rootDir, { recursive: true })

      const moveAll = async (src: string, dest: string) => {
        const entries = await fsp.readdir(src, { withFileTypes: true })
        for (const entry of entries) {
          const srcFile = path.join(src, entry.name)
          const destFile = path.join(dest, entry.name)
          if (entry.isDirectory()) {
            await fsp.mkdir(destFile, { recursive: true })
            await moveAll(srcFile, destFile)
          } else {
            const lowerName = entry.name.toLowerCase()
            if (
              lowerName.endsWith('-wal') ||
              lowerName.endsWith('-shm') ||
              lowerName.endsWith('-journal') ||
              lowerName.includes('.db-wal') ||
              lowerName.includes('.db-shm') ||
              lowerName.includes('.db-journal')
            ) {
              continue
            }
            if (entry.name === 'manifest.json' && src === tempExtractDir) {
              await fsp.unlink(srcFile).catch(() => {})
              continue
            }
            if (entry.name === 'user-data' && src === tempExtractDir) {
              await fsp.rm(srcFile, { recursive: true, force: true }).catch(() => {})
              continue
            }
            await fsp.copyFile(srcFile, destFile)
            await fsp.unlink(srcFile)
          }
        }
      }
      await moveAll(tempExtractDir, rootDir)

      await this.restoreUserAvatarsFromExtract(tempExtractDir)

      try {
        const registryFile = path.join(rootDir, 'vault_registry.json')
        if (fs.existsSync(registryFile)) {
          const raw = await fsp.readFile(registryFile, 'utf8')
          const vaults: any[] = JSON.parse(raw)
          let modified = false

          for (const v of vaults) {
            const correctPath = path.join(rootDir, v.name)
            if (v.path !== correctPath) {
              v.path = correctPath
              modified = true
            }
          }
          if (modified) {
            await fsp.writeFile(registryFile, JSON.stringify(vaults, null, 2), 'utf8')
          }
        }
      } catch (e: any) {
        logger.error('Failed to remap vault paths', e)
      }

      try {
        const extractedDbPath = path.join(rootDir, 'database', 'baishou_agent.db')
        if (fs.existsSync(extractedDbPath)) {
          const { getAppDbPath } = await import('../db')
          const actualDbPath =
            getAppDbPath() || path.join(app.getPath('userData'), 'baishou_agent.db')
          await fsp.copyFile(extractedDbPath, actualDbPath)
          await fsp
            .rm(path.join(rootDir, 'database'), { recursive: true, force: true })
            .catch(() => {})
        }
      } catch (e: any) {
        logger.error('Failed to restore database from archive', e)
      }

      try {
        const { resetAppDb } = await import('../db')
        resetAppDb()
        const restoredDb = getAppDb()
        connectionManager.setDb(restoredDb)

        const client = (restoredDb as any)?.session?.client
        if (client) {
          let isOk = false
          let checkResult: any = null
          if (typeof client.prepare === 'function') {
            const row = client.prepare('PRAGMA integrity_check').get()
            checkResult = row ? Object.values(row)[0] : null
            isOk = checkResult === 'ok'
          } else if (typeof client.execute === 'function') {
            const res = await client.execute('PRAGMA integrity_check')
            const row = res.rows?.[0]
            checkResult = row ? Object.values(row)[0] : null
            isOk = checkResult === 'ok'
          } else {
            isOk = true
          }

          if (!isOk) {
            throw new Error(`数据库完整性检查未通过: ${checkResult}`)
          }
          logger.info('[ArchiveService] 恢复的数据库完整性检查通过！')
        }

        await installDatabaseSchema(restoredDb)
        logger.info(
          '[ArchiveService] Next Database connection successfully reconnected and schema migrated.'
        )
      } catch (dbErr: any) {
        logger.error('[ArchiveService] Failed to reconnect database for Next:', dbErr)
        throw dbErr
      }

      try {
        const configPath = path.join(rootDir, 'config', 'device_preferences.json')
        if (fs.existsSync(configPath)) {
          const raw = await fsp.readFile(configPath, 'utf8')
          const prefs = JSON.parse(raw)

          const settingsRepo = new SettingsRepository(getAppDb())
          for (const [key, value] of Object.entries(prefs)) {
            if (key === 'user_profile_data' || key === 'user_profile') continue
            if (key === 'cloud_sync_config' && currentCloudSyncConfig) {
              await settingsRepo.set(key, currentCloudSyncConfig)
              continue
            }
            if (value !== undefined && value !== null) {
              await settingsRepo.set(key, value)
            }
          }

          if (prefs['user_profile_data']) {
            const profileRepo = new UserProfileRepository(getAppDb())
            await profileRepo.saveProfile(prefs['user_profile_data'])
          } else if (prefs['user_profile']) {
            const profileRepo = new UserProfileRepository(getAppDb())
            await profileRepo.saveProfile(prefs['user_profile'])
          }
        }
        await fsp.rm(path.join(rootDir, 'config'), { recursive: true, force: true }).catch(() => {})
      } catch (e: any) {
        logger.error('Failed to restore device preferences', e)
      }

      if (manifest) {
        try {
          const settingsRepo = new SettingsRepository(getAppDb())
          await settingsRepo.set('last_restored_backup', manifest)
        } catch (settingsErr: any) {
          logger.error('Failed to save last_restored_backup to database:', settingsErr)
        }
      }
    }

    try {
      const syncMetaDir = path.join(rootDir, '.baishou')
      await resetIncrementalSyncMetaAfterFullRestore(syncMetaDir, {
        exists: (p) => fs.existsSync(p),
        read: (p) => fsp.readFile(p, 'utf8'),
        write: (p, content) => fsp.writeFile(p, content, 'utf8'),
        unlink: (p) => fsp.unlink(p)
      })
      logger.info('[ArchiveService] Incremental sync meta reset after full restore.')
    } catch (e: unknown) {
      logger.warn('[ArchiveService] Failed to reset incremental sync meta after import:', {
        error: e instanceof Error ? e.message : String(e)
      })
    }

    await fsp.rm(tempExtractDir, { recursive: true, force: true }).catch(() => {})

    await this.vaultService.initRegistry()

    try {
      const { connectGlobalShadowDb } = await import('../ipc/vault.ipc')
      await connectGlobalShadowDb()
    } catch (e: any) {
      logger.error('Failed to reconnect Shadow DB after import:', e)
    }

    try {
      const { resetSharedShadowSync } = await import('./shadow-sync.registry')
      resetSharedShadowSync()
    } catch (e: any) {
      logger.error('Failed to reset shadow sync cache after import:', e)
    }

    try {
      const { resetCachedManager } = await import('../ipc/summary.ipc')
      resetCachedManager()
    } catch (e: any) {
      logger.error('Failed to reset summary cache after import:', e)
    }

    const { globalBootstrapper } = await import('./bootstrapper.service')
    await globalBootstrapper.fullyResyncAllEcosystems()

    return {
      fileCount: -1,
      profileRestored: true,
      snapshotPath
    }
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

  private async restoreUserAvatarsFromExtract(extractDir: string): Promise<void> {
    const avatarsSrc = path.join(extractDir, ...ARCHIVE_USER_AVATARS_ZIP_PREFIX.split('/'))
    if (!fs.existsSync(avatarsSrc)) return

    const avatarsDest = await this.pathService.getUserAvatarsDirectory()
    await fsp.rm(avatarsDest, { recursive: true, force: true }).catch(() => {})
    await fsp.mkdir(avatarsDest, { recursive: true })

    const copyDir = async (src: string, dest: string) => {
      const entries = await fsp.readdir(src, { withFileTypes: true })
      for (const entry of entries) {
        const srcPath = path.join(src, entry.name)
        const destPath = path.join(dest, entry.name)
        if (entry.isDirectory()) {
          await fsp.mkdir(destPath, { recursive: true })
          await copyDir(srcPath, destPath)
        } else {
          await fsp.copyFile(srcPath, destPath)
        }
      }
    }

    await copyDir(avatarsSrc, avatarsDest)
    logger.info('[ArchiveService] User avatars restored from archive.')
  }
}
