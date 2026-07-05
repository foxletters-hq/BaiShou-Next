import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { logger } from '@baishou/shared'
import {
  cleanupLegacyVaultArtifacts,
  mergeDirectories,
  mergeLegacySqliteDatabases,
  readLegacyVaultRegistry,
  resolveLegacyImportVaultNames,
  scanLegacyDatabasesForVaults,
  StorageMigrationCopyError,
  writeNextVaultRegistry,
  type RawSqlExecutor
} from './legacy-migration.shared'
import {
  mergeAvatarMaps,
  rectifyAssistantAvatarPaths,
  restoreLegacyAvatarsFromArchiveLayout,
  restoreLegacyAvatarsFromDocumentsDir,
  restoreLegacyUserAvatar,
  type LegacyAvatarImporter
} from './legacy-avatar-migration.shared'
import { exportLegacyRuntimeArtifacts } from './legacy-runtime-artifacts.shared'

export interface LegacyArchiveMigrationDeps {
  fileSystem: IFileSystem
  sourceDir: string
  targetWorkspaceDir: string
  sqliteClient: unknown
  executeRawSql: RawSqlExecutor
  restoreDevicePreferences?: (config: Record<string, unknown>) => Promise<void>
  importAvatar: LegacyAvatarImporter
  saveUserAvatarPath?: (relativePath: string) => Promise<void>
  /** 本地升级时 Flutter Documents/avatars 目录（非 ZIP 布局） */
  flutterDocumentsAvatarsDir?: string | null
  userAvatarPathFromPrefs?: string | null
  onTableError?: (tableName: string, error: unknown) => void
  onCopyProgress?: (entryPath: string) => void
}

/**
 * 执行 Flutter legacy 归档内容迁移（prefs + 头像 + SQLite + vault），不含迁移状态写入。
 */
export async function migrateLegacyArchiveContents(
  deps: LegacyArchiveMigrationDeps
): Promise<string[]> {
  const {
    fileSystem,
    sourceDir,
    targetWorkspaceDir,
    sqliteClient,
    executeRawSql,
    restoreDevicePreferences,
    importAvatar,
    saveUserAvatarPath,
    flutterDocumentsAvatarsDir,
    userAvatarPathFromPrefs,
    onTableError,
    onCopyProgress
  } = deps

  const prefsPath = path.join(sourceDir, 'config', 'device_preferences.json')
  if (restoreDevicePreferences && (await fileSystem.exists(prefsPath))) {
    const raw = await fileSystem.readFile(prefsPath, 'utf8')
    const prefs = JSON.parse(raw) as Record<string, unknown>
    try {
      await restoreDevicePreferences(prefs)
    } catch (error) {
      logger.warn(
        '[migrateLegacyArchiveContents] device_preferences restore failed (archive finalization may retry):',
        error instanceof Error ? error : String(error)
      )
    }
  }

  const archiveAvatarMap = await restoreLegacyAvatarsFromArchiveLayout(
    fileSystem,
    sourceDir,
    importAvatar
  )
  const documentsAvatarMap = flutterDocumentsAvatarsDir
    ? await restoreLegacyAvatarsFromDocumentsDir(
        fileSystem,
        flutterDocumentsAvatarsDir,
        importAvatar
      )
    : {}
  const avatarMap = mergeAvatarMaps(archiveAvatarMap, documentsAvatarMap)

  const userAvatarRel = await restoreLegacyUserAvatar(fileSystem, {
    userAvatarPathFromPrefs: userAvatarPathFromPrefs ?? undefined,
    sourceRoot: sourceDir,
    flutterDocumentsAvatarsDir: flutterDocumentsAvatarsDir ?? undefined,
    importAvatar
  })
  if (userAvatarRel && saveUserAvatarPath) {
    await saveUserAvatarPath(userAvatarRel)
  }

  const legacyRegistry = await readLegacyVaultRegistry(fileSystem, sourceDir)
  const vaultNames = await resolveLegacyImportVaultNames(fileSystem, sourceDir)

  const { baishouDbs } = await scanLegacyDatabasesForVaults(fileSystem, sourceDir, vaultNames)
  // 伙伴/会话由「版本迁移」按工作空间导入，启动迁移不合并 agent 表
  if (baishouDbs.length > 0) {
    logger.info(
      `[migrateLegacyArchiveContents] Merging ${baishouDbs.length} baishou.sqlite file(s).`
    )
    await mergeLegacySqliteDatabases(sqliteClient, executeRawSql, [], baishouDbs, {
      includeMemoryEmbeddings: false,
      onTableError
    })
  }

  await rectifyAssistantAvatarPaths(sqliteClient, executeRawSql, avatarMap)

  let vaultIndex = 0
  for (const vName of vaultNames) {
    vaultIndex += 1
    onCopyProgress?.(`vault:${vaultIndex}/${vaultNames.length}:${vName}`)
    logger.info(
      `[migrateLegacyArchiveContents] Copying vault ${vaultIndex}/${vaultNames.length}: ${vName}`
    )
    const vSource = path.join(sourceDir, vName)
    const vTarget = path.join(targetWorkspaceDir, vName)
    if (!(await fileSystem.exists(vSource))) continue
    try {
      const stat = await fileSystem.stat(vSource)
      if (!stat.isDirectory) continue
    } catch {
      continue
    }
    const inPlaceMigration = path.resolve(vSource) === path.resolve(vTarget)
    const failed = await mergeDirectories(fileSystem, vSource, vTarget, {
      skipEntryNames: inPlaceMigration ? ['Journals'] : undefined,
      onEntry: onCopyProgress
    })
    if (failed.length > 0) {
      throw new StorageMigrationCopyError(failed)
    }
    await cleanupLegacyVaultArtifacts(fileSystem, vTarget, { preserveAgentSqlite: true })
  }

  await writeNextVaultRegistry(fileSystem, targetWorkspaceDir, vaultNames, legacyRegistry)

  await exportLegacyRuntimeArtifacts({
    fileSystem,
    targetWorkspaceDir,
    vaultNames,
    sqliteClient,
    executeRawSql
  })

  return vaultNames
}
