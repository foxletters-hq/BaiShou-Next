import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'
import { executeRawSql } from '@baishou/database'
import { installExpoDatabaseSchema } from '@baishou/database/expo'
import type { SettingsRepository, UserProfileRepository } from '@baishou/database'
import type { IFileSystem } from '@baishou/core-mobile'
import {
  LegacyImportService,
  assembleDevicePreferencesFromFlutterSp,
  copyStorageRootContents,
  discoverVaultNames,
  extractFlutterCustomStorageRoot,
  hasMeaningfulFlutterPreferences,
  isFlutterSettingsMigrationFullySupported,
  isLegacyAppRoot,
  isMigrationCompleted,
  LEGACY_UPGRADE_RAG_PENDING_KEY,
  migrateLegacyArchiveContents,
  MigrationTargetStoragePathService,
  parseFlutterSharedPreferencesPlist,
  parseFlutterSharedPreferencesXml,
  resolveAgentDbPath,
  targetDirectoryHasData,
  writeMigrationStatus,
  type LegacyMigrationSource
} from '@baishou/core-mobile'
import {
  getLegacyFlutterAvatarsDirectory,
  getLegacyFlutterStorageRoots,
  mirrorProductionLegacyToExternal,
  readLegacyFlutterSharedPreferencesXml
} from 'expo-baishou-server'
import { getAppDocumentDirectory } from './mobile-app-paths'
import { MobileAttachmentManagerService } from './mobile-attachment-manager.service'
import {
  EXTERNAL_STORAGE_ROOT,
  hasStoragePermission
} from './storage-permission.service'
import { logger } from '@baishou/shared'
import { normalizeStorageRoot } from '@baishou/shared'

export interface MobileLegacyMigrationResult {
  migrated: boolean
  skippedOnboarding: boolean
  targetRoot: string | null
  sourceRoot: string | null
}

function normalizeNativePath(pathValue: string): string {
  if (pathValue.startsWith('file://')) {
    return pathValue
  }
  return `file://${pathValue}`
}

function toFileUriFromAbsolute(absPath: string): string {
  if (absPath.startsWith('file://')) return absPath
  return `file://${absPath}`
}

function rootsEqual(a: string, b: string): boolean {
  return normalizeStorageRoot(a) === normalizeStorageRoot(b)
}

export async function collectLegacyCandidateRoots(fileSystem: IFileSystem): Promise<string[]> {
  const candidates: string[] = []

  if (Platform.OS === 'android') {
    const mirror = mirrorProductionLegacyToExternal()
    if (mirror.mirrored) {
      logger.info('[MobileLegacyMigration] Mirrored production legacy data to external storage', mirror)
    } else if (mirror.productionInstalled && mirror.reason === 'production_context_unavailable') {
      logger.warn(
        '[MobileLegacyMigration] 正式版日记在应用沙盒内，Dev 包无法直接读取。请先安装并打开一次正式 Release 包（pnpm release:android），或仅在正式包中查看旧数据。',
        mirror
      )
    }

    for (const abs of getLegacyFlutterStorageRoots()) {
      candidates.push(toFileUriFromAbsolute(abs))
    }
  }

  if (Platform.OS === 'ios') {
    candidates.push(`${getAppDocumentDirectory()}BaiShou_Root`)
    const iosPrefs = await readIosFlutterSharedPreferencesRaw(fileSystem)
    const customRoot = iosPrefs ? extractFlutterCustomStorageRoot(iosPrefs) : null
    if (customRoot) {
      candidates.push(
        customRoot.startsWith('file://') ? customRoot : toFileUriFromAbsolute(customRoot)
      )
    }
  }

  candidates.push(EXTERNAL_STORAGE_ROOT)

  const resolved: string[] = []
  for (const candidate of candidates) {
    try {
      if (await isLegacyAppRoot(fileSystem, candidate)) {
        resolved.push(candidate)
      }
    } catch {
      // ignore unreadable candidates
    }
  }
  return resolved
}

export async function resolveMobileMigrationTargetRoot(
  getRootDirectory: () => Promise<string>
): Promise<string | null> {
  if (Platform.OS === 'android') {
    if (await hasStoragePermission()) {
      return EXTERNAL_STORAGE_ROOT
    }
    const flutterRoots = getLegacyFlutterStorageRoots()
    if (flutterRoots[0]) {
      return toFileUriFromAbsolute(flutterRoots[0])
    }
    return null
  }

  try {
    return await getRootDirectory()
  } catch {
    return `${getAppDocumentDirectory()}BaiShou_Root`
  }
}

function pickPrimaryLegacySource(legacyRoots: string[], targetRoot: string): string {
  if (legacyRoots.length === 0) {
    return targetRoot
  }

  if (Platform.OS === 'android') {
    const flutterRoot = legacyRoots.find((root) => root.includes('/app_flutter/'))
    if (flutterRoot && !rootsEqual(flutterRoot, targetRoot)) {
      return flutterRoot
    }
  }

  const externalRoot = legacyRoots.find(
    (root) => root.includes('BaiShou_Root') && rootsEqual(root, EXTERNAL_STORAGE_ROOT)
  )
  if (externalRoot && !rootsEqual(externalRoot, targetRoot)) {
    return externalRoot
  }

  return legacyRoots.find((root) => !rootsEqual(root, targetRoot)) ?? legacyRoots[0]!
}

export function resolveIosFlutterPreferencesPlistPath(): string {
  const doc = getAppDocumentDirectory()
  return doc.replace(/Documents\/?$/, 'Library/Preferences/com.baishou.baishou.plist')
}

export async function readIosFlutterSharedPreferencesRaw(
  fileSystem: IFileSystem
): Promise<Record<string, unknown> | null> {
  const plistPath = resolveIosFlutterPreferencesPlistPath()
  if (!(await fileSystem.exists(plistPath))) return null
  try {
    const raw = await fileSystem.readFile(plistPath, 'utf8')
    return parseFlutterSharedPreferencesPlist(raw)
  } catch {
    return null
  }
}

export async function readMobileFlutterSharedPreferencesConfig(
  fileSystem?: IFileSystem
): Promise<Record<string, unknown> | null> {
  if (Platform.OS === 'android') {
    const rawXml = readLegacyFlutterSharedPreferencesXml()
    if (!rawXml) return null
    try {
      const sp = parseFlutterSharedPreferencesXml(rawXml)
      const config = assembleDevicePreferencesFromFlutterSp(sp)
      return hasMeaningfulFlutterPreferences(config) ? config : null
    } catch {
      return null
    }
  }

  if (Platform.OS === 'ios' && fileSystem) {
    const sp = await readIosFlutterSharedPreferencesRaw(fileSystem)
    if (!sp) return null
    const config = assembleDevicePreferencesFromFlutterSp(sp)
    return hasMeaningfulFlutterPreferences(config) ? config : null
  }

  return null
}

export function createMigrationAvatarImporter(
  fileSystem: IFileSystem,
  targetRoot: string,
  sourceDir: string
): (absoluteSourcePath: string, prefix: string) => Promise<string> {
  const normalizedTarget = normalizeNativePath(targetRoot)
  const vaultNamesPreviewPromise = discoverVaultNames(fileSystem, sourceDir)
  let migrationAttManager: MobileAttachmentManagerService | null = null

  return async (absoluteSourcePath, prefix) => {
    if (!migrationAttManager) {
      const vaultNames = await vaultNamesPreviewPromise
      const primaryVault = vaultNames[0] ?? 'Personal'
      const migrationPath = new MigrationTargetStoragePathService(normalizedTarget, primaryVault)
      migrationAttManager = new MobileAttachmentManagerService(migrationPath, fileSystem)
    }
    return migrationAttManager.importAvatar(absoluteSourcePath, prefix)
  }
}

export function resolveMobileFlutterAvatarsDirectory(): string | null {
  if (Platform.OS === 'android') {
    const nativeDir = getLegacyFlutterAvatarsDirectory()
    if (nativeDir) return toFileUriFromAbsolute(nativeDir)
  }
  if (Platform.OS === 'ios') {
    return `${getAppDocumentDirectory()}avatars`
  }
  return null
}

export async function runMobileLegacyMigrationIfNeeded(options: {
  fileSystem: IFileSystem
  sqliteClient: unknown
  targetRoot: string
  installInstanceId: string
  settingsRepo: SettingsRepository
  profileRepo: UserProfileRepository
}): Promise<MobileLegacyMigrationResult> {
  const { fileSystem, sqliteClient, targetRoot, installInstanceId, settingsRepo, profileRepo } =
    options
  const normalizedTarget = normalizeNativePath(targetRoot)

  if (await isMigrationCompleted(fileSystem, normalizedTarget, installInstanceId)) {
    return {
      migrated: false,
      skippedOnboarding: true,
      targetRoot: normalizedTarget,
      sourceRoot: null
    }
  }

  const legacyRoots = await collectLegacyCandidateRoots(fileSystem)
  if (legacyRoots.length === 0) {
    return {
      migrated: false,
      skippedOnboarding: false,
      targetRoot: normalizedTarget,
      sourceRoot: null
    }
  }

  let sourceRoot = pickPrimaryLegacySource(legacyRoots, normalizedTarget)
  const targetHasData = await targetDirectoryHasData(fileSystem, normalizedTarget)
  const sameRoot = rootsEqual(sourceRoot, normalizedTarget)

  if (!sameRoot && !targetHasData) {
    logger.info('[MobileLegacyMigration] Copying legacy tree into target root', {
      sourceRoot,
      normalizedTarget
    })
    await copyStorageRootContents(fileSystem, sourceRoot, normalizedTarget)
    sourceRoot = normalizedTarget
  } else if (!sameRoot && targetHasData) {
    const alternate = legacyRoots.find((root) => !rootsEqual(root, normalizedTarget))
    if (alternate) {
      sourceRoot = alternate
      logger.info(
        '[MobileLegacyMigration] Target already has data; merging legacy from',
        sourceRoot
      )
    }
  }

  if (!(await isLegacyAppRoot(fileSystem, sourceRoot))) {
    return {
      migrated: false,
      skippedOnboarding: false,
      targetRoot: normalizedTarget,
      sourceRoot: null
    }
  }

  const migrationTarget = normalizedTarget
  const migrationSource = sourceRoot
  const legacyImporter = new LegacyImportService(settingsRepo, profileRepo)

  const flutterPrefsConfig = await readMobileFlutterSharedPreferencesConfig(fileSystem)
  if (flutterPrefsConfig) {
    try {
      await legacyImporter.restoreConfig(flutterPrefsConfig)
      logger.info('[MobileLegacyMigration] Restored Flutter SharedPreferences')
    } catch (error) {
      logger.warn('[MobileLegacyMigration] Flutter SharedPreferences restore failed:', error as Error)
    }
  } else if (!isFlutterSettingsMigrationFullySupported(Platform.OS)) {
    logger.info(
      '[MobileLegacyMigration] Flutter settings not auto-migrated on iOS; content data migration continues.'
    )
  }

  const importAvatar = createMigrationAvatarImporter(fileSystem, migrationTarget, migrationSource)

  try {
    const vaultNames = await migrateLegacyArchiveContents({
      fileSystem,
      sourceDir: migrationSource,
      targetWorkspaceDir: migrationTarget,
      sqliteClient,
      executeRawSql,
      restoreDevicePreferences: async (config) => legacyImporter.restoreConfig(config),
      importAvatar,
      saveUserAvatarPath: async (relativePath) => {
        const profile = await profileRepo.getProfile()
        profile.avatarPath = relativePath
        await profileRepo.saveProfile(profile)
      },
      flutterDocumentsAvatarsDir: resolveMobileFlutterAvatarsDirectory(),
      userAvatarPathFromPrefs:
        typeof flutterPrefsConfig?.['user_avatar_path'] === 'string'
          ? (flutterPrefsConfig['user_avatar_path'] as string)
          : null,
      onTableError: (tableName, error) => {
        logger.warn(`[MobileLegacyMigration] SQL merge warning (${tableName}):`, error as Error)
      }
    })

    try {
      await settingsRepo.set(LEGACY_UPGRADE_RAG_PENDING_KEY as never, true as never)
    } catch (error) {
      logger.warn('[MobileLegacyMigration] Failed to mark RAG re-embed pending:', error as Error)
    }

    const source: LegacyMigrationSource = 'flutter_mobile'

    await writeMigrationStatus(fileSystem, migrationTarget, {
      version: 1,
      completedAt: new Date().toISOString(),
      source,
      migrationCompleted: true,
      installInstanceId,
      ragSkipped: true,
      ragReembedRequired: true,
      vaultsMigrated: vaultNames
    })

    logger.info('[MobileLegacyMigration] Completed legacy migration', {
      migrationSource,
      migrationTarget,
      vaultNames
    })

    return {
      migrated: true,
      skippedOnboarding: true,
      targetRoot: migrationTarget,
      sourceRoot: migrationSource
    }
  } catch (error) {
    logger.error('[MobileLegacyMigration] Migration failed before status write:', error as Error)
    throw error
  }
}

/**
 * 将解压后的 Flutter legacy ZIP 迁移到目标工作区（staging），在隔离 DB 中合并后再写出 agent DB。
 */
export async function runMobileLegacyZipMigration(options: {
  fileSystem: IFileSystem
  extractDir: string
  targetRoot: string
  settingsRepo: SettingsRepository
  profileRepo: UserProfileRepository
}): Promise<string[]> {
  const { fileSystem, extractDir, targetRoot, settingsRepo, profileRepo } = options
  const legacyImporter = new LegacyImportService(settingsRepo, profileRepo)
  const normalizedTarget = normalizeNativePath(targetRoot)
  const importAvatar = createMigrationAvatarImporter(fileSystem, normalizedTarget, extractDir)

  const tempDbName = `baishou_legacy_zip_${Date.now()}.db`
  const isolatedDb = await SQLite.openDatabaseAsync(tempDbName)
  const tempDbUri = `${getAppDocumentDirectory()}SQLite/${tempDbName}`

  try {
    await installExpoDatabaseSchema(isolatedDb as never)

    const vaultNames = await migrateLegacyArchiveContents({
      fileSystem,
      sourceDir: extractDir,
      targetWorkspaceDir: normalizedTarget,
      sqliteClient: isolatedDb,
      executeRawSql,
      restoreDevicePreferences: async (config) => legacyImporter.restoreConfig(config),
      importAvatar,
      saveUserAvatarPath: async (relativePath) => {
        const profile = await profileRepo.getProfile()
        profile.avatarPath = relativePath
        await profileRepo.saveProfile(profile)
      },
      onTableError: (tableName, error) => {
        logger.warn(`[MobileLegacyZipMigration] SQL merge warning (${tableName}):`, error as Error)
      }
    })

    const stagedDbPath = resolveAgentDbPath(normalizedTarget)
    await fileSystem.mkdir(normalizedTarget, { recursive: true })
    await fileSystem.copyFile(tempDbUri, stagedDbPath)

    return vaultNames
  } finally {
    try {
      await SQLite.deleteDatabaseAsync(tempDbName)
    } catch {
      // ignore cleanup errors
    }
  }
}
