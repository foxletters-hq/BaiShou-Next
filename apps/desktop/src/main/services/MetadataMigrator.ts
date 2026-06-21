import * as path from 'path'
import * as fs from 'fs'
import * as fsp from 'fs/promises'
import { connectionManager, installDatabaseSchema } from '@baishou/database-desktop'
import {
  resolveArchiveExtractRoot,
  shouldImportAsFlutterLegacyArchive,
  mergeArchivePrefsPreservingCloudSync,
  purgeImportedShadowIndexCaches
} from '@baishou/core/shared'
import { createNodeFileSystem } from '@baishou/core-desktop'
import { logger } from '@baishou/shared'
import { getAppDb, resetAppDb } from '../db'

/**
 * 负责解析导入备份时的元数据校验、遗留旧版结构的数据清洗与兼容迁移逻辑。
 */
export class MetadataMigrator {
  private readonly fileSystem = createNodeFileSystem()

  /**
   * 扫描工作区并删除所有可重建的影子索引缓存（per-vault + 全局）。
   */
  public async cleanShadowIndexFiles(
    rootDir: string,
    globalShadowDir?: string | null
  ): Promise<void> {
    await purgeImportedShadowIndexCaches(this.fileSystem, {
      workspaceRoot: rootDir,
      globalShadowDir
    })
    logger.info('[MetadataMigrator] Purged imported shadow index caches.')
  }

  /**
   * 安全性版本校验：前向兼容拦截，防止低版本白守客户端恢复高版本数据包
   */
  public validateManifest(manifest: any, currentFormatVersion: number): void {
    if (
      manifest &&
      typeof manifest.formatVersion === 'number' &&
      manifest.formatVersion > currentFormatVersion
    ) {
      throw new Error(
        `备份文件格式版本 (${manifest.formatVersion}) 高于当前应用支持的最大版本 (${currentFormatVersion})。请将白守更新至最新版本后再试。`
      )
    }
  }

  /**
   * 如果检测到是旧版备份包（Legacy Architecture），执行兼容迁移
   */
  public async migrateLegacyIfNecessary(
    manifest: any,
    tempExtractDir: string,
    rootDir: string,
    globalShadowDir?: string | null,
    currentCloudSyncConfig?: unknown
  ): Promise<boolean> {
    const archiveRoot = await resolveArchiveExtractRoot(this.fileSystem, tempExtractDir)
    const isLegacy = await shouldImportAsFlutterLegacyArchive(
      this.fileSystem,
      archiveRoot,
      manifest
    )

    if (!isLegacy) {
      return false
    }

    logger.info('MetadataMigrator: Detected Legacy Architecture. Initiating Legacy Migration...')
    const { LegacyMigrationService } = await import('./legacy-migration.service')
    const legacyService = new LegacyMigrationService()
    const { getDesktopInstallInstanceId } = await import('./install-instance.service')
    const installInstanceId = await getDesktopInstallInstanceId()
    const stagingDir = path.join(path.dirname(rootDir), `.baishou_migration_staging_${Date.now()}`)
    await fsp.mkdir(stagingDir, { recursive: true })

    try {
      resetAppDb()
      await legacyService.migrate(archiveRoot, stagingDir, {
        source: 'flutter_zip',
        installInstanceId
      })

      if (fs.existsSync(rootDir)) {
        await fsp.rm(rootDir, { recursive: true, force: true })
      }
      await fsp.rename(stagingDir, rootDir)
    } catch (migrationError) {
      await fsp.rm(stagingDir, { recursive: true, force: true }).catch(() => {})
      throw migrationError
    }

    await this.cleanShadowIndexFiles(rootDir, globalShadowDir)

    const restoredDb = getAppDb(rootDir)
    connectionManager.setDb(restoredDb)
    await installDatabaseSchema(restoredDb)
    logger.info(
      '[MetadataMigrator] Legacy Database connection successfully reconnected and schema migrated.'
    )

    await this.restoreDevicePreferencesFromExtract(archiveRoot, rootDir, currentCloudSyncConfig)
    return true
  }

  /** 从 ZIP 解压目录恢复 device_preferences.json 到 Agent DB */
  public async restoreDevicePreferencesFromExtract(
    extractDir: string,
    workspaceRoot: string,
    currentCloudSyncConfig?: unknown
  ): Promise<void> {
    const configPath = path.join(extractDir, 'config', 'device_preferences.json')
    if (!fs.existsSync(configPath)) return

    const raw = await fsp.readFile(configPath, 'utf8')
    const prefs = mergeArchivePrefsPreservingCloudSync(
      JSON.parse(raw) as Record<string, unknown>,
      currentCloudSyncConfig
    )

    const { SettingsRepository, UserProfileRepository } = await import('@baishou/database-desktop')
    const { LegacyImportService } = await import('@baishou/core-desktop')

    const db = getAppDb(workspaceRoot)
    const settingsRepo = new SettingsRepository(db)
    const profileRepo = new UserProfileRepository(db)
    const legacyImporter = new LegacyImportService(settingsRepo, profileRepo)
    await legacyImporter.restoreConfig(prefs)
    logger.info('[MetadataMigrator] Restored device preferences from archive config.')
  }
}
