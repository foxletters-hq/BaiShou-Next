import * as fsp from 'fs/promises'
import { getAppDb, resolveAgentDbPath } from '../db'
import {
  SettingsRepository,
  UserProfileRepository,
  executeRawSql,
  installDatabaseSchema
} from '@baishou/database-desktop'
import { LegacyImportService } from '@baishou/core-desktop'
import {
  discoverVaultNames,
  isLegacyAppRoot as isLegacyAppRootShared,
  isMigrationCompleted,
  LEGACY_UPGRADE_RAG_PENDING_KEY,
  migrateLegacyArchiveContents,
  MigrationTargetStoragePathService,
  writeMigrationStatus,
  type LegacyMigrationSource
} from '@baishou/core/shared'
import { DesktopAttachmentManagerService } from './desktop-attachment-manager.service'
import { logger } from '@baishou/shared'
import { createNodeFileSystem } from '@baishou/core-desktop'
import {
  readFlutterSharedPreferencesConfig,
  resolveFlutterDocumentsAvatarsDir
} from './flutter-legacy-paths.service'

export class LegacyMigrationService {
  private readonly fileSystem = createNodeFileSystem()

  public async migrate(
    sourceDir: string,
    targetWorkspaceDir: string,
    options?: { source?: LegacyMigrationSource; installInstanceId?: string }
  ): Promise<boolean> {
    const installInstanceId = options?.installInstanceId
    if (
      installInstanceId &&
      (await isMigrationCompleted(this.fileSystem, targetWorkspaceDir, installInstanceId))
    ) {
      logger.info(
        '[LegacyMigration] Migration already completed for this install instance, skipping.'
      )
      return false
    }

    logger.info(`[LegacyMigration] Start migration from ${sourceDir} to ${targetWorkspaceDir}`)
    const db = getAppDb(targetWorkspaceDir)
    const client = (db as { session?: { client?: unknown } })?.session?.client
    if (!client) throw new Error('Database client not initialized')

    // ZIP 导入等场景会在全新 staging 目录建库，必须先落 schema 再合并 legacy SQLite
    await installDatabaseSchema(db)

    const settingsRepo = new SettingsRepository(getAppDb(targetWorkspaceDir))
    const profileRepo = new UserProfileRepository(getAppDb(targetWorkspaceDir))
    const legacyImporter = new LegacyImportService(settingsRepo, profileRepo)

    const vaultNamesPreview = await discoverVaultNames(this.fileSystem, sourceDir)
    const primaryVault = vaultNamesPreview[0] ?? 'Personal'
    const migrationPath = new MigrationTargetStoragePathService(targetWorkspaceDir, primaryVault)
    const attManager = new DesktopAttachmentManagerService(migrationPath)

    let flutterPrefsConfig: Record<string, unknown> | null = null
    if (options?.source === 'flutter_desktop') {
      flutterPrefsConfig = await readFlutterSharedPreferencesConfig()
      if (flutterPrefsConfig) {
        try {
          await legacyImporter.restoreConfig(flutterPrefsConfig)
          logger.info(
            '[LegacyMigration] Restored Flutter SharedPreferences via LegacyImportService'
          )
        } catch (e) {
          logger.error('[LegacyMigration] Failed to migrate Flutter SharedPreferences:', e as Error)
        }
      }
    }

    const unifiedDbPath = resolveAgentDbPath(targetWorkspaceDir)
    const backupDbPath = unifiedDbPath + '.migration_bak'
    let hasDbBackup = false

    if (await fsp.stat(unifiedDbPath).catch(() => null)) {
      await fsp.copyFile(unifiedDbPath, backupDbPath)
      hasDbBackup = true
    }

    try {
      const vaultNames = await migrateLegacyArchiveContents({
        fileSystem: this.fileSystem,
        sourceDir,
        targetWorkspaceDir,
        sqliteClient: client,
        executeRawSql,
        restoreDevicePreferences: async (config) => legacyImporter.restoreConfig(config),
        importAvatar: (absPath, prefix) => attManager.importAvatar(absPath, prefix),
        saveUserAvatarPath: async (relativePath) => {
          const profile = await profileRepo.getProfile()
          profile.avatarPath = relativePath
          await profileRepo.saveProfile(profile)
        },
        flutterDocumentsAvatarsDir:
          options?.source === 'flutter_desktop' ? resolveFlutterDocumentsAvatarsDir() : null,
        userAvatarPathFromPrefs:
          typeof flutterPrefsConfig?.['user_avatar_path'] === 'string'
            ? (flutterPrefsConfig['user_avatar_path'] as string)
            : null,
        onTableError: (tableName, error) => {
          logger.warn(`[LegacyMigration] SQL Table ${tableName} error:`, error as Error)
        }
      })

      try {
        await settingsRepo.set(LEGACY_UPGRADE_RAG_PENDING_KEY as never, true as never)
      } catch (e) {
        logger.warn('[LegacyMigration] Failed to mark RAG re-embed pending:', e as Error)
      }

      if (!installInstanceId) {
        throw new Error('[LegacyMigration] installInstanceId is required to finalize migration')
      }

      await writeMigrationStatus(this.fileSystem, targetWorkspaceDir, {
        version: 1,
        completedAt: new Date().toISOString(),
        source: options?.source ?? 'flutter_desktop',
        migrationCompleted: true,
        installInstanceId,
        ragSkipped: true,
        ragReembedRequired: true,
        vaultsMigrated: vaultNames
      })

      if (hasDbBackup) {
        await fsp.unlink(backupDbPath).catch(() => {})
      }

      logger.info('[LegacyMigration] Migration successfully completed.')
      return true
    } catch (e) {
      if (hasDbBackup) {
        await fsp.copyFile(backupDbPath, unifiedDbPath).catch(() => {})
        await fsp.unlink(backupDbPath).catch(() => {})
        logger.error(
          '[LegacyMigration] Fatal error during migration, restored database from backup.',
          e as Error
        )
      }
      throw e
    }
  }

  public async isLegacyAppRoot(sourceDir: string): Promise<boolean> {
    return isLegacyAppRootShared(this.fileSystem, sourceDir)
  }
}
