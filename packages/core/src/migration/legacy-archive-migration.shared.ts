import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import {
  cleanupLegacyVaultArtifacts,
  discoverVaultNames,
  mergeDirectories,
  mergeLegacySqliteDatabases,
  readLegacyVaultRegistry,
  scanLegacyDatabases,
  writeNextVaultRegistry,
  type RawSqlExecutor
} from './legacy-migration.shared'
import {
  mergeAvatarMaps,
  rectifyAssistantAvatarPaths,
  restoreLegacyAvatarsFromArchiveLayout,
  restoreLegacyAvatarsFromDocumentsDir,
  restoreUserAvatarFromConfigDir,
  restoreUserAvatarFromSpPath,
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
    onTableError
  } = deps

  const prefsPath = path.join(sourceDir, 'config', 'device_preferences.json')
  if (restoreDevicePreferences && (await fileSystem.exists(prefsPath))) {
    try {
      const raw = await fileSystem.readFile(prefsPath, 'utf8')
      const prefs = JSON.parse(raw) as Record<string, unknown>
      await restoreDevicePreferences(prefs)
    } catch {
      // prefs restore failure should not abort vault migration
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

  const userFromConfig = await restoreUserAvatarFromConfigDir(
    fileSystem,
    path.join(sourceDir, 'config'),
    importAvatar
  )
  const userFromSp = await restoreUserAvatarFromSpPath(
    fileSystem,
    userAvatarPathFromPrefs ?? undefined,
    importAvatar
  )
  const userAvatarRel = userFromConfig ?? userFromSp
  if (userAvatarRel && saveUserAvatarPath) {
    await saveUserAvatarPath(userAvatarRel)
  }

  const { agentDbs, baishouDbs } = await scanLegacyDatabases(fileSystem, sourceDir)
  await mergeLegacySqliteDatabases(sqliteClient, executeRawSql, agentDbs, baishouDbs, {
    includeMemoryEmbeddings: false,
    onTableError
  })

  await rectifyAssistantAvatarPaths(sqliteClient, executeRawSql, avatarMap)

  const legacyRegistry = await readLegacyVaultRegistry(fileSystem, sourceDir)
  const vaultNames = await discoverVaultNames(fileSystem, sourceDir)

  for (const vName of vaultNames) {
    const vSource = path.join(sourceDir, vName)
    const vTarget = path.join(targetWorkspaceDir, vName)
    if (!(await fileSystem.exists(vSource))) continue
    try {
      const stat = await fileSystem.stat(vSource)
      if (!stat.isDirectory) continue
    } catch {
      continue
    }
    await mergeDirectories(fileSystem, vSource, vTarget)
    await cleanupLegacyVaultArtifacts(fileSystem, vTarget)
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
