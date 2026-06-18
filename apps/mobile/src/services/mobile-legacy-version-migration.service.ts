import { executeRawSql } from '@baishou/database'
import type { SettingsRepository, UserProfileRepository } from '@baishou/database'
import type { IFileSystem } from '@baishou/core-mobile'
import { isLegacyAppRoot } from '@baishou/core-mobile'
import {
  importLegacyVersionMigrationSection,
  parseWorkspaceSectionId,
  resolveLegacyVaultTargetName,
  scanLegacyVersionMigration,
  buildJournalFilePathFromDateStr,
  vaultDirectoryHasUserContent,
  type LegacyVersionMigrationBatchImportResult,
  type LegacyVersionMigrationImportResult,
  type LegacyVersionMigrationImporterDeps,
  type LegacyVersionMigrationScanResult,
  type LegacyVersionMigrationSectionId
} from '@baishou/core-mobile'
import type { DiaryService } from '@baishou/core-mobile'
import type { AssistantManagerService } from '@baishou/core-mobile'
import type { SessionManagerService } from '@baishou/core-mobile'
import type { VaultService } from '@baishou/core-mobile'
import type { SettingsManagerService } from '@baishou/core-mobile'
import type { SessionRepository } from '@baishou/database'
import type { MobileStoragePathService } from './path.service'
import { normalizeStorageRoot, saveUserProfileToSettings } from '@baishou/shared'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  collectLegacyCandidateRoots,
  createMigrationAvatarImporter,
  pickPrimaryFlutterLegacySource,
  readMobileFlutterSharedPreferencesConfig,
  readMobileFlutterSharedPreferencesRaw,
  resolveFlutterLegacyMigrationTargetRoot,
  resolveMobileFlutterAvatarsDirectory
} from './mobile-legacy-migration.service'
import { stageLegacySqliteForAttach } from '@baishou/core-mobile'
import { getAppDocumentDirectory } from './mobile-app-paths'
import { FLUTTER_LEGACY_MIGRATED_SOURCE_KEY } from '../constants/storage'
import { invalidateUserAvatarDisplayCache } from '../lib/user-avatar-display.util'
import {
  getCustomLegacySourceRoot,
  getStoredAssistantIdMap,
  getStoredVaultNameMap,
  markVersionMigrationSectionImported,
  mergeAssistantIdMap,
  mergeVaultNameMap
} from './mobile-legacy-version-migration.state'

function displayPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
}

function rootsEqual(a: string, b: string): boolean {
  return normalizeStorageRoot(a) === normalizeStorageRoot(b)
}

function normalizeLegacyRootUri(path: string): string {
  return path.startsWith('file://') ? path : `file://${path}`
}

export type LegacySourceResolution =
  | { kind: 'manual'; sourceRoot: string; sourceDisplayPath: string }
  | { kind: 'flutter'; sourceRoot: string; sourceDisplayPath: string }
  | { kind: 'migrated'; sourceRoot: string; sourceDisplayPath: string }

/** 解析版本迁移用的旧版根目录：手动选择 > Flutter 原版 > 整包迁移记录 */
export async function resolveVersionMigrationLegacySource(
  fileSystem: IFileSystem,
  targetRoot: string,
  customSourceRoot?: string | null
): Promise<LegacySourceResolution | null> {
  const manualRoot = customSourceRoot ?? (await getCustomLegacySourceRoot())
  if (manualRoot) {
    const normalized = normalizeLegacyRootUri(manualRoot)
    if (await isLegacyAppRoot(fileSystem, normalized)) {
      return {
        kind: 'manual',
        sourceRoot: normalized,
        sourceDisplayPath: displayPath(normalized)
      }
    }
  }

  const candidates = await collectLegacyCandidateRoots(fileSystem)
  const flutterPrimary = pickPrimaryFlutterLegacySource(candidates, targetRoot)
  if (
    flutterPrimary &&
    !rootsEqual(flutterPrimary, targetRoot) &&
    (await isLegacyAppRoot(fileSystem, flutterPrimary))
  ) {
    return {
      kind: 'flutter',
      sourceRoot: flutterPrimary,
      sourceDisplayPath: displayPath(flutterPrimary)
    }
  }

  const migratedSource = await AsyncStorage.getItem(FLUTTER_LEGACY_MIGRATED_SOURCE_KEY)
  if (
    migratedSource &&
    !rootsEqual(migratedSource, targetRoot) &&
    (await isLegacyAppRoot(fileSystem, migratedSource))
  ) {
    return {
      kind: 'migrated',
      sourceRoot: migratedSource,
      sourceDisplayPath: displayPath(migratedSource)
    }
  }

  return null
}

const MOBILE_SQLITE_ATTACH_STAGING_DIR = `${getAppDocumentDirectory()}migration_sqlite_attach/`

async function prepareMobileSqliteAttachPath(
  fileSystem: IFileSystem,
  dbPath: string
): Promise<string> {
  return stageLegacySqliteForAttach(fileSystem, dbPath, MOBILE_SQLITE_ATTACH_STAGING_DIR)
}

export interface MobileVersionMigrationRuntime {
  fileSystem: IFileSystem
  sqliteClient: unknown
  settingsRepo: SettingsRepository
  profileRepo: UserProfileRepository
  diaryService: DiaryService
  assistantManager: AssistantManagerService
  sessionManager: SessionManagerService
  sessionRepo: SessionRepository
  vaultService: VaultService
  settingsManager: SettingsManagerService
  pathService: MobileStoragePathService
  getTargetRoot: () => Promise<string>
}

export async function scanMobileVersionMigration(
  runtime: MobileVersionMigrationRuntime,
  options?: { legacySourceRoot?: string | null }
): Promise<LegacyVersionMigrationScanResult | null> {
  const targetRoot = await runtime.getTargetRoot()
  const source = await resolveVersionMigrationLegacySource(
    runtime.fileSystem,
    targetRoot,
    options?.legacySourceRoot
  )
  if (!source) return null

  const [flutterPrefsConfig, flutterRawSp] = await Promise.all([
    readMobileFlutterSharedPreferencesConfig(runtime.fileSystem),
    readMobileFlutterSharedPreferencesRaw(runtime.fileSystem)
  ])

  return scanLegacyVersionMigration({
    fileSystem: runtime.fileSystem,
    sourceRoot: source.sourceRoot,
    sourceDisplayPath: source.sourceDisplayPath,
    flutterPrefsConfig,
    flutterRawSp,
    flutterDocumentsAvatarsDir: resolveMobileFlutterAvatarsDirectory(),
    sqliteClient: runtime.sqliteClient,
    executeRawSql,
    prepareSqliteAttachPath: (dbPath) =>
      prepareMobileSqliteAttachPath(runtime.fileSystem, dbPath)
  })
}

async function collectAllSessionIds(sessionManager: SessionManagerService): Promise<Set<string>> {
  const ids = new Set<string>()
  const pageSize = 500
  let offset = 0
  while (true) {
    const page = await sessionManager.findAllSessions(pageSize, offset)
    if (page.length === 0) break
    for (const session of page) {
      ids.add(session.id)
    }
    if (page.length < pageSize) break
    offset += pageSize
  }
  return ids
}

async function collectExistingTargetVaultNames(
  runtime: MobileVersionMigrationRuntime
): Promise<Set<string>> {
  await runtime.vaultService.initRegistry()
  const existing = new Set(runtime.vaultService.getAllVaults().map((v) => v.name))

  try {
    const rootDir = await runtime.pathService.getRootDirectory()
    const registryFile = `${rootDir}/vault_registry.json`
    if (await runtime.fileSystem.exists(registryFile)) {
      const content = await runtime.fileSystem.readFile(registryFile, 'utf8')
      const parsed = JSON.parse(content) as Array<{ name?: string }>
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          if (entry?.name) existing.add(entry.name)
        }
      }
    }

    const entries = await runtime.fileSystem.readdir(rootDir)
    for (const name of entries) {
      if (name.startsWith('.') || name === 'vault_registry.json') continue
      const dirPath = `${rootDir}/${name}`
      try {
        const stat = await runtime.fileSystem.stat(dirPath)
        if (stat.isDirectory) existing.add(name)
      } catch {
        // ignore unreadable entries
      }
    }
  } catch {
    // registry from initRegistry remains authoritative
  }

  return existing
}

async function preResolveWorkspaceTargetVault(
  runtime: MobileVersionMigrationRuntime,
  legacyVaultName: string
): Promise<string> {
  await runtime.vaultService.initRegistry()
  const stored = await getStoredVaultNameMap()
  const existing = await collectExistingTargetVaultNames(runtime)
  return resolveLegacyVaultTargetName(legacyVaultName, existing, stored)
}

async function removeEmptyLegacyVaultPlaceholder(
  runtime: MobileVersionMigrationRuntime,
  legacyVaultName: string,
  targetVaultName: string
): Promise<void> {
  if (legacyVaultName === targetVaultName) return
  if (!runtime.vaultService.vaultExists(legacyVaultName)) return

  const rootDir = await runtime.pathService.getRootDirectory()
  if (await vaultDirectoryHasUserContent(runtime.fileSystem, rootDir, legacyVaultName)) {
    return
  }

  const active = await runtime.pathService.getActiveVaultNameForContext()
  if (active === legacyVaultName) {
    await runtime.vaultService.switchVault(targetVaultName)
  }
  try {
    await runtime.vaultService.deleteVault(legacyVaultName)
  } catch {
    // 占位工作区可能已被删除或仍为活跃工作区
  }
}

function buildImporterDeps(
  runtime: MobileVersionMigrationRuntime,
  sourceRoot: string,
  targetRoot: string,
  onProgress?: (message: string) => void,
  pinVaultTargets?: Map<string, string>
) {
  const pinnedTargets = new Map(pinVaultTargets)
  const importAvatar = createMigrationAvatarImporter(runtime.fileSystem, targetRoot, sourceRoot, {
    targetVaultName: () => runtime.pathService.getActiveVaultNameForContext()
  })

  const deps = {} as LegacyVersionMigrationImporterDeps

  deps.resolveTargetVaultName = async (legacyVaultName: string): Promise<string> => {
    const pinned = pinnedTargets.get(legacyVaultName)
    if (pinned) return pinned

    const stored = await getStoredVaultNameMap()
    const existing = await collectExistingTargetVaultNames(runtime)
    const target = resolveLegacyVaultTargetName(legacyVaultName, existing, stored)
    pinnedTargets.set(legacyVaultName, target)
    if (target !== legacyVaultName && stored[legacyVaultName] !== target) {
      await mergeVaultNameMap({ [legacyVaultName]: target })
    }
    return target
  }

  deps.runInVaultContext = async <T>(legacyVaultName: string, fn: () => Promise<T>): Promise<T> => {
    const targetVault = await deps.resolveTargetVaultName(legacyVaultName)
    const originalVault = await runtime.pathService.getActiveVaultNameForContext()
    if (originalVault !== targetVault) {
      await runtime.vaultService.switchVault(targetVault)
    }
    return await fn()
  }

  deps.fileSystem = runtime.fileSystem
  deps.sourceRoot = sourceRoot
  deps.targetRoot = targetRoot
  deps.flutterPrefsConfig = null
  deps.flutterRawSp = null
  deps.flutterDocumentsAvatarsDir = resolveMobileFlutterAvatarsDirectory()
  deps.sqliteClient = runtime.sqliteClient
  deps.executeRawSql = executeRawSql
  deps.settingsRepo = runtime.settingsRepo
  deps.profileRepo = runtime.profileRepo
  deps.diaryService = runtime.diaryService
  deps.assistantManager = runtime.assistantManager
  deps.sessionManager = runtime.sessionManager
  deps.vaultService = runtime.vaultService
  deps.importAvatar = importAvatar
  deps.saveUserAvatarPath = async (relativePath: string) => {
      const profile = await runtime.profileRepo.getProfile()
      profile.avatarPath = relativePath
      await saveUserProfileToSettings(runtime.settingsManager, profile)
      invalidateUserAvatarDisplayCache(relativePath)
  }
  deps.existingAssistantNames = async () => {
      const names = new Set<string>()
      for (const a of await runtime.assistantManager.findAll()) {
        names.add(a.name)
      }
      return names
  }
  deps.existingSessionIds = async () => collectAllSessionIds(runtime.sessionManager)
  deps.existingPersonaIds = async () => {
      const profile = await runtime.profileRepo.getProfile()
      return new Set(Object.keys(profile.personas ?? {}))
  }
  deps.upsertSessionAggregate = async (aggregate: unknown) => {
    await runtime.sessionRepo.upsertAggregate(aggregate)
  }
  deps.onVaultNameMapped = async (legacyName: string, targetName: string) => {
    if (legacyName !== targetName) {
      await mergeVaultNameMap({ [legacyName]: targetName })
    }
  }
  deps.flushSettingsToDisk = async () => {
    await runtime.settingsManager.flushToDisk()
  }
  deps.onProgress = onProgress
  deps.readTargetJournalRaw = async (dateStr: string, targetVaultName: string) => {
      const journalsBase = `${await runtime.pathService.getVaultDirectory(targetVaultName)}/Journals`
      const filePath = buildJournalFilePathFromDateStr(journalsBase, dateStr)
      if (!(await runtime.fileSystem.exists(filePath))) return null
      return runtime.fileSystem.readFile(filePath, 'utf8')
  }
  deps.prepareSqliteAttachPath = (dbPath: string) =>
    prepareMobileSqliteAttachPath(runtime.fileSystem, dbPath)
  deps.getJournalsBaseDirectory = async (targetVaultName: string) =>
    `${await runtime.pathService.getVaultDirectory(targetVaultName)}/Journals`
  deps.assistantRecordExists = async (assistantId: string) => {
      const dir = await runtime.pathService.getAssistantsBaseDirectory()
      return runtime.fileSystem.exists(`${dir}/${assistantId}.json`)
  }

  return deps
}

export async function importMobileVersionMigrationSection(
  runtime: MobileVersionMigrationRuntime,
  sectionId: LegacyVersionMigrationSectionId,
  options?: { onProgress?: (message: string) => void; legacySourceRoot?: string | null }
): Promise<LegacyVersionMigrationImportResult> {
  const targetRoot = await runtime.getTargetRoot()
  const source = await resolveVersionMigrationLegacySource(
    runtime.fileSystem,
    targetRoot,
    options?.legacySourceRoot
  )
  if (!source) {
    return {
      sectionId,
      imported: 0,
      skipped: 1,
      failed: 0,
      warnings: ['version_migration.no_legacy_source']
    }
  }

  await runtime.vaultService.initRegistry()

  const pinVaultTargets = new Map<string, string>()
  const legacyVaultForSection = parseWorkspaceSectionId(sectionId)
  if (legacyVaultForSection) {
    const pinned = await preResolveWorkspaceTargetVault(runtime, legacyVaultForSection)
    pinVaultTargets.set(legacyVaultForSection, pinned)
    if (pinned !== legacyVaultForSection) {
      await mergeVaultNameMap({ [legacyVaultForSection]: pinned })
    }
  }

  const deps = buildImporterDeps(
    runtime,
    source.sourceRoot,
    targetRoot,
    options?.onProgress,
    pinVaultTargets
  )
  const [flutterPrefsConfig, flutterRawSp] = await Promise.all([
    readMobileFlutterSharedPreferencesConfig(runtime.fileSystem),
    readMobileFlutterSharedPreferencesRaw(runtime.fileSystem)
  ])
  deps.flutterPrefsConfig = flutterPrefsConfig
  deps.flutterRawSp = flutterRawSp

  let assistantIdMap = await getStoredAssistantIdMap()

  const result = await importLegacyVersionMigrationSection(sectionId, deps, { assistantIdMap })

  const legacyVaultName = parseWorkspaceSectionId(sectionId)
  if (legacyVaultName && (result.imported > 0 || result.skipped > 0)) {
    const storedVaultMap = await getStoredVaultNameMap()
    const existing = await collectExistingTargetVaultNames(runtime)
    const targetVault =
      result.vaultNameMap?.[legacyVaultName] ??
      pinVaultTargets.get(legacyVaultName) ??
      resolveLegacyVaultTargetName(legacyVaultName, existing, storedVaultMap)
    const activeVault = await runtime.pathService.getActiveVaultNameForContext()
    if (activeVault !== targetVault) {
      await runtime.vaultService.switchVault(targetVault)
    }
    const resyncOptions = { activeVaultName: targetVault }
    await runtime.assistantManager.fullResyncFromDisks(resyncOptions)
    await runtime.sessionManager.fullResyncFromDisks(resyncOptions)
    await removeEmptyLegacyVaultPlaceholder(runtime, legacyVaultName, targetVault)
  }

  if (result.assistantIdMap && Object.keys(result.assistantIdMap).length > 0) {
    await mergeAssistantIdMap(result.assistantIdMap)
  }
  if (result.vaultNameMap && Object.keys(result.vaultNameMap).length > 0) {
    await mergeVaultNameMap(result.vaultNameMap)
  }

  if (result.imported > 0) {
    await markVersionMigrationSectionImported(sectionId)
  }

  if (sectionId === 'avatar' || sectionId === 'personas' || sectionId === 'config') {
    await runtime.settingsManager.flushToDisk()
  }

  return result
}

export async function importMobileVersionMigrationAllWorkspaces(
  runtime: MobileVersionMigrationRuntime,
  workspaceSectionIds: LegacyVersionMigrationSectionId[],
  options?: { onProgress?: (message: string) => void; legacySourceRoot?: string | null }
): Promise<LegacyVersionMigrationBatchImportResult> {
  let totalImported = 0
  let totalSkipped = 0
  let totalFailed = 0
  const warnings: string[] = []
  const errors: string[] = []
  const sectionResults: LegacyVersionMigrationImportResult[] = []
  let assistantIdMap: Record<string, string> = await getStoredAssistantIdMap()
  const vaultNameMap: Record<string, string> = {}

  for (const sectionId of workspaceSectionIds) {
    const result = await importMobileVersionMigrationSection(runtime, sectionId, {
      ...options,
      onProgress: options?.onProgress
    })
    sectionResults.push(result)
    totalImported += result.imported
    totalSkipped += result.skipped
    totalFailed += result.failed
    warnings.push(...result.warnings)
    if (result.errors) errors.push(...result.errors)
    if (result.assistantIdMap) {
      assistantIdMap = { ...assistantIdMap, ...result.assistantIdMap }
      await mergeAssistantIdMap(result.assistantIdMap)
    }
    if (result.vaultNameMap) {
      Object.assign(vaultNameMap, result.vaultNameMap)
      await mergeVaultNameMap(result.vaultNameMap)
    }
  }

  return {
    sectionId: workspaceSectionIds[0] ?? ('workspace:all' as LegacyVersionMigrationSectionId),
    imported: totalImported,
    skipped: totalSkipped,
    failed: totalFailed,
    warnings: [...new Set(warnings)],
    errors: errors.length > 0 ? errors : undefined,
    assistantIdMap,
    vaultNameMap,
    sectionResults
  }
}

export { resolveFlutterLegacyMigrationTargetRoot }
