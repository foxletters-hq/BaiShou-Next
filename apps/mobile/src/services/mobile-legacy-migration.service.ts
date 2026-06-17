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
import { EXTERNAL_STORAGE_ROOT } from './storage-permission.service'
import { FLUTTER_LEGACY_MIGRATION_COMPLETED_KEY } from '../constants/storage'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { logger } from '@baishou/shared'
import { normalizeStorageRoot } from '@baishou/shared'
import {
  resolveFlutterLegacyMigrationTargetRoot,
  resolveIosFlutterPreferencesPlistPath,
  resolveMobileMigrationTargetRoot
} from './mobile-legacy-migration.paths'

export {
  resolveFlutterLegacyMigrationTargetRoot,
  resolveIosFlutterPreferencesPlistPath,
  resolveMobileMigrationTargetRoot
} from './mobile-legacy-migration.paths'

export interface MobileLegacyMigrationResult {
  migrated: boolean
  skippedOnboarding: boolean
  targetRoot: string | null
  sourceRoot: string | null
}

export interface FlutterLegacyMigrationPending {
  sourceRoot: string
  targetRoot: string
  sourceDisplayPath: string
  targetDisplayPath: string
}

function displayMigrationPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
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

/** 从原版 Flutter SharedPreferences 读取自定义工作区根目录（Android） */
export function resolveAndroidFlutterCustomStorageRoot(): string | null {
  if (Platform.OS !== 'android') return null
  const rawXml = readLegacyFlutterSharedPreferencesXml()
  if (!rawXml) return null
  try {
    const sp = parseFlutterSharedPreferencesXml(rawXml)
    return extractFlutterCustomStorageRoot(sp)
  } catch {
    return null
  }
}

function appendAndroidLegacyRootCandidates(candidates: string[]): void {
  for (const abs of getLegacyFlutterStorageRoots()) {
    candidates.push(toFileUriFromAbsolute(abs))
  }
  const customRoot = resolveAndroidFlutterCustomStorageRoot()
  if (customRoot) {
    candidates.push(
      customRoot.startsWith('file://') ? customRoot : toFileUriFromAbsolute(customRoot)
    )
  }
}

interface FlutterLegacyMigrationCompletedRecord {
  installInstanceId: string
  completedAt: string
  targetRoot: string
}

export async function isFlutterLegacyMigrationMarkedComplete(
  installInstanceId: string
): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(FLUTTER_LEGACY_MIGRATION_COMPLETED_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as FlutterLegacyMigrationCompletedRecord
    return parsed.installInstanceId === installInstanceId && !!parsed.completedAt
  } catch {
    return false
  }
}

export async function markFlutterLegacyMigrationComplete(options: {
  installInstanceId: string
  targetRoot: string
}): Promise<void> {
  const record: FlutterLegacyMigrationCompletedRecord = {
    installInstanceId: options.installInstanceId,
    completedAt: new Date().toISOString(),
    targetRoot: normalizeNativePath(options.targetRoot)
  }
  await AsyncStorage.setItem(FLUTTER_LEGACY_MIGRATION_COMPLETED_KEY, JSON.stringify(record))
}

async function isLegacyUpgradeMigrationDone(
  fileSystem: IFileSystem,
  targetRoot: string,
  installInstanceId: string
): Promise<boolean> {
  if (await isFlutterLegacyMigrationMarkedComplete(installInstanceId)) {
    return true
  }
  if (await isMigrationCompleted(fileSystem, targetRoot, installInstanceId)) {
    await markFlutterLegacyMigrationComplete({ installInstanceId, targetRoot })
    return true
  }
  return false
}

export async function collectLegacyCandidateRoots(fileSystem: IFileSystem): Promise<string[]> {
  const candidates: string[] = []

  if (Platform.OS === 'android') {
    const mirror = mirrorProductionLegacyToExternal()
    if (mirror.mirrored) {
      logger.info(
        '[MobileLegacyMigration] Mirrored production legacy data to external storage',
        mirror
      )
    } else if (mirror.productionInstalled && mirror.reason === 'production_context_unavailable') {
      logger.warn(
        '[MobileLegacyMigration] 正式版日记在应用沙盒内，Dev 包无法直接读取。请先安装并打开一次正式 Release 包（pnpm release:android），或仅在正式包中查看旧数据。',
        mirror
      )
    }

    appendAndroidLegacyRootCandidates(candidates)
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

/**
 * 启动时快速检测：旧版目录有数据且尚未完成迁移时返回待迁移信息。
 */
export async function detectFlutterLegacyMigrationPending(
  fileSystem: IFileSystem,
  installInstanceId: string
): Promise<FlutterLegacyMigrationPending | null> {
  const targetRoot = resolveFlutterLegacyMigrationTargetRoot()

  if (await isLegacyUpgradeMigrationDone(fileSystem, targetRoot, installInstanceId)) {
    return null
  }

  const legacyRoots = await collectLegacyCandidateRoots(fileSystem)
  if (legacyRoots.length === 0) {
    return null
  }

  const sourceRoot = pickPrimaryLegacySource(legacyRoots, targetRoot)
  if (rootsEqual(sourceRoot, targetRoot)) {
    return null
  }

  if (!(await isLegacyAppRoot(fileSystem, sourceRoot))) {
    return null
  }

  return {
    sourceRoot,
    targetRoot,
    sourceDisplayPath: displayMigrationPath(sourceRoot),
    targetDisplayPath: displayMigrationPath(targetRoot)
  }
}

/** 迁移已完成且目标目录有数据后，才允许删除旧版源目录 */
export async function deleteMigratedLegacySourceRoot(options: {
  fileSystem: IFileSystem
  sourceRoot: string
  targetRoot: string
  installInstanceId: string
}): Promise<void> {
  const { fileSystem, sourceRoot, targetRoot, installInstanceId } = options
  const normalizedTarget = normalizeNativePath(targetRoot)
  const normalizedSource = normalizeNativePath(sourceRoot)

  if (rootsEqual(normalizedSource, normalizedTarget)) {
    throw new Error('SOURCE_EQUALS_TARGET')
  }
  if (!(await isMigrationCompleted(fileSystem, normalizedTarget, installInstanceId))) {
    throw new Error('MIGRATION_NOT_COMPLETED')
  }
  if (!(await targetDirectoryHasData(fileSystem, normalizedTarget))) {
    throw new Error('TARGET_EMPTY')
  }
  if (!(await fileSystem.exists(normalizedSource))) {
    return
  }

  await fileSystem.rm(normalizedSource, { recursive: true, force: true })
}

function pickPrimaryLegacySource(legacyRoots: string[], targetRoot: string): string {
  if (legacyRoots.length === 0) {
    return targetRoot
  }

  if (Platform.OS === 'android') {
    const customRoot = resolveAndroidFlutterCustomStorageRoot()
    if (customRoot) {
      const customUri = customRoot.startsWith('file://')
        ? customRoot
        : toFileUriFromAbsolute(customRoot)
      const customMatch = legacyRoots.find((root) => rootsEqual(root, customUri))
      if (customMatch && !rootsEqual(customMatch, targetRoot)) {
        return customMatch
      }
    }

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
  onCopyProgress?: (itemName: string) => void
}): Promise<MobileLegacyMigrationResult> {
  const {
    fileSystem,
    sqliteClient,
    targetRoot,
    installInstanceId,
    settingsRepo,
    profileRepo,
    onCopyProgress
  } = options
  const normalizedTarget = normalizeNativePath(targetRoot)

  if (await isLegacyUpgradeMigrationDone(fileSystem, normalizedTarget, installInstanceId)) {
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
  const originalSourceRoot = sourceRoot
  const targetHasData = await targetDirectoryHasData(fileSystem, normalizedTarget)
  const sameRoot = rootsEqual(sourceRoot, normalizedTarget)

  if (!sameRoot && !targetHasData) {
    logger.info('[MobileLegacyMigration] Copying legacy tree into target root', {
      sourceRoot: originalSourceRoot,
      normalizedTarget
    })
    await copyStorageRootContents(fileSystem, originalSourceRoot, normalizedTarget, onCopyProgress)
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
      logger.warn(
        '[MobileLegacyMigration] Flutter SharedPreferences restore failed:',
        error as Error
      )
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

    await markFlutterLegacyMigrationComplete({
      installInstanceId,
      targetRoot: migrationTarget
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
      sourceRoot: rootsEqual(originalSourceRoot, migrationTarget) ? null : originalSourceRoot
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
