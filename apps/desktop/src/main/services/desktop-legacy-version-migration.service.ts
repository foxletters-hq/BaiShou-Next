import { join } from 'node:path'
import { app } from 'electron'
import {
  executeRawSql,
  SettingsRepository,
  UserProfileRepository,
  connectionManager
} from '@baishou/database-desktop'
import {
  SessionManagerService
} from '@baishou/core-desktop'
import {
  buildJournalFilePathFromDateStr,
  importLegacyVersionMigrationSection,
  isLegacyAppRoot,
  normalizeImportedSectionIds,
  parseWorkspaceSectionId,
  resolveLegacyVaultTargetName,
  scanLegacyVersionMigration,
  stageLegacySqliteForAttach,
  type LegacyAvatarImporter,
  type LegacyVersionMigrationBatchImportResult,
  type LegacyVersionMigrationImportResult,
  type LegacyVersionMigrationSectionId
} from '@baishou/core/shared'
import { normalizeStorageRoot } from '@baishou/shared'
import type { LegacyVersionMigrationScanPayload, LegacyVersionMigrationSourceKind } from '@baishou/shared'
import { getAgentManagers } from '../ipc/agent-helpers'
import { settingsManager } from '../ipc/settings.ipc'
import { fileSystem, pathService, vaultService } from '../ipc/vault.ipc'
import { DesktopAttachmentManagerService } from './desktop-attachment-manager.service'
import { getDiaryManagerForVault } from './diary-vault.factory'
import {
  resolveFlutterDocumentsAvatarsDir,
  resolveLegacyRootCandidates,
  resolveVersionMigrationFlutterPrefs
} from './flutter-legacy-paths.service'
import { globalBootstrapper } from './bootstrapper.service'
import { LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY } from '@baishou/shared'
import {
  getCustomLegacySourceRoot,
  getStoredAssistantIdMap,
  getStoredVaultNameMap,
  markVersionMigrationSectionImported,
  mergeAssistantIdMap,
  mergeVaultNameMap,
  setCustomLegacySourceRoot
} from './desktop-legacy-version-migration.state'

export type DesktopLegacySourceResolution = {
  kind: LegacyVersionMigrationSourceKind
  sourceRoot: string
  sourceDisplayPath: string
}

function rootsEqual(a: string, b: string): boolean {
  return normalizeStorageRoot(a) === normalizeStorageRoot(b)
}

async function prepareLegacySqliteAttachPath(dbPath: string): Promise<string> {
  const stagingDir = join(app.getPath('temp'), 'baishou-migration-sqlite')
  try {
    const staged = await stageLegacySqliteForAttach(fileSystem, dbPath, stagingDir)
    console.info('[VersionMigration][sqlite-stage] staged', { dbPath, stagingDir, staged })
    return staged
  } catch (error) {
    console.warn('[VersionMigration][sqlite-stage] failed', {
      dbPath,
      stagingDir,
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

export async function resolveDesktopVersionMigrationLegacySource(
  targetRoot: string,
  customSourceRoot?: string | null
): Promise<DesktopLegacySourceResolution | null> {
  const manual = customSourceRoot ?? (await getCustomLegacySourceRoot())
  if (manual && (await isLegacyAppRoot(fileSystem, manual))) {
    return { kind: 'manual', sourceRoot: manual, sourceDisplayPath: manual }
  }

  const candidates = await resolveLegacyRootCandidates()
  for (const candidate of candidates) {
    if (
      !rootsEqual(candidate, targetRoot) &&
      (await isLegacyAppRoot(fileSystem, candidate))
    ) {
      return { kind: 'flutter', sourceRoot: candidate, sourceDisplayPath: candidate }
    }
  }

  const settingsRepo = new SettingsRepository(connectionManager.getDb())
  const manifest = await settingsRepo.get<{ lastSourceDir?: string }>(
    LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY
  )
  const migratedSource = manifest?.lastSourceDir?.trim()
  if (
    migratedSource &&
    !rootsEqual(migratedSource, targetRoot) &&
    (await isLegacyAppRoot(fileSystem, migratedSource))
  ) {
    return { kind: 'migrated', sourceRoot: migratedSource, sourceDisplayPath: migratedSource }
  }

  return null
}

function createDesktopMigrationAvatarImporter(): LegacyAvatarImporter {
  const attManager = new DesktopAttachmentManagerService(pathService)
  return (absoluteSourcePath, prefix) => attManager.importAvatar(absoluteSourcePath, prefix)
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

async function buildImporterDeps(
  sourceRoot: string,
  targetRoot: string,
  onProgress?: (message: string) => void
) {
  const db = connectionManager.getDb()
  const settingsRepo = new SettingsRepository(db)
  const profileRepo = new UserProfileRepository(db)
  const { sessionManager, assistantManager, realSessionRepo } = getAgentManagers()
  const importAvatar = createDesktopMigrationAvatarImporter()
  const activeVaultName = vaultService.getActiveVault()?.name ?? 'Personal'
  const diaryService = await getDiaryManagerForVault(activeVaultName)

  const resolveTargetVaultName = async (legacyVaultName: string): Promise<string> => {
    const stored = await getStoredVaultNameMap()
    const existing = new Set(vaultService.getAllVaults().map((v) => v.name))
    const target = resolveLegacyVaultTargetName(legacyVaultName, existing, stored)
    if (!stored[legacyVaultName] && target !== legacyVaultName) {
      await mergeVaultNameMap({ [legacyVaultName]: target })
    }
    return target
  }

  const runInVaultContext = async <T>(legacyVaultName: string, fn: () => Promise<T>): Promise<T> => {
    const targetVault = await resolveTargetVaultName(legacyVaultName)
    const active = vaultService.getActiveVault()?.name
    if (active !== targetVault) {
      await vaultService.switchVault(targetVault)
      await globalBootstrapper.activateVaultRuntime()
    }
    try {
      return await fn()
    } finally {
      await assistantManager.fullResyncFromDisks()
      await sessionManager.fullResyncFromDisks()
    }
  }

  return {
    fileSystem,
    sourceRoot,
    targetRoot,
    flutterPrefsConfig: null as Record<string, unknown> | null,
    flutterRawSp: null as Record<string, unknown> | null,
    flutterDocumentsAvatarsDir: resolveFlutterDocumentsAvatarsDir(),
    sqliteClient: db,
    executeRawSql,
    settingsRepo,
    profileRepo,
    diaryService,
    assistantManager,
    sessionManager,
    vaultService,
    importAvatar,
    saveUserAvatarPath: async (relativePath: string) => {
      const profile = await profileRepo.getProfile()
      profile.avatarPath = relativePath
      await profileRepo.saveProfile(profile)
    },
    existingAssistantNames: async () => {
      const names = new Set<string>()
      for (const assistant of await assistantManager.findAll()) {
        names.add(assistant.name)
      }
      return names
    },
    existingSessionIds: async () => collectAllSessionIds(sessionManager),
    existingPersonaIds: async () => {
      const profile = await profileRepo.getProfile()
      return new Set(Object.keys(profile.personas ?? {}))
    },
    upsertSessionAggregate: async (aggregate: unknown) => {
      await realSessionRepo.upsertAggregate(aggregate)
    },
    runInVaultContext,
    resolveTargetVaultName,
    onVaultNameMapped: async (legacyName: string, targetName: string) => {
      await mergeVaultNameMap({ [legacyName]: targetName })
    },
    flushSettingsToDisk: async () => {
      await settingsManager.flushToDisk()
    },
    onProgress,
    readTargetJournalRaw: async (dateStr: string) => {
      const journalsBase = await pathService.getJournalsBaseDirectory()
      const filePath = buildJournalFilePathFromDateStr(journalsBase, dateStr)
      if (!(await fileSystem.exists(filePath))) return null
      return fileSystem.readFile(filePath, 'utf8')
    },
    prepareSqliteAttachPath: prepareLegacySqliteAttachPath,
    getJournalsBaseDirectory: async () => pathService.getJournalsBaseDirectory(),
    assistantRecordExists: async (assistantId: string) => {
      const dir = await pathService.getAssistantsBaseDirectory()
      return fileSystem.exists(join(dir, `${assistantId}.json`))
    }
  }
}

async function applyFlutterPrefsToDeps(
  deps: Awaited<ReturnType<typeof buildImporterDeps>>,
  sourceRoot: string
): Promise<void> {
  const prefs = await resolveVersionMigrationFlutterPrefs(sourceRoot)
  deps.flutterPrefsConfig = prefs.config
  deps.flutterRawSp = prefs.sp
}

export class DesktopLegacyVersionMigrationService {
  cancel(): void {
    // Reserved for long-running import cancellation
  }

  async scan(
    customSourceRoot?: string | null,
    onProgress?: (message: string) => void
  ): Promise<LegacyVersionMigrationScanPayload> {
    onProgress?.('正在检测旧版数据…')

    const targetRoot = await pathService.getRootDirectory()
    const source = await resolveDesktopVersionMigrationLegacySource(targetRoot, customSourceRoot)
    const storedCustom = customSourceRoot ?? (await getCustomLegacySourceRoot())
    const state = await loadVersionMigrationStateSafe()

    if (!source) {
      return {
        scanResult: null,
        sourceKind: null,
        customSourceRoot: storedCustom,
        importedSections: state?.importedSections ?? []
      }
    }

    const flutterPrefs = await resolveVersionMigrationFlutterPrefs(source.sourceRoot)

    const scanResult = await scanLegacyVersionMigration({
      fileSystem,
      sourceRoot: source.sourceRoot,
      sourceDisplayPath: source.sourceDisplayPath,
      flutterPrefsConfig: flutterPrefs.config,
      flutterRawSp: flutterPrefs.sp,
      flutterDocumentsAvatarsDir: resolveFlutterDocumentsAvatarsDir(),
      sqliteClient: connectionManager.getDb(),
      executeRawSql,
      prepareSqliteAttachPath: prepareLegacySqliteAttachPath
    })

    const legacyVaultNames = scanResult.workspaces.map((ws) => ws.legacyVaultName)
    const importedSections = state
      ? normalizeImportedSectionIds(state.importedSections, legacyVaultNames)
      : []

    onProgress?.('扫描完成')
    return {
      scanResult,
      sourceKind: source.kind,
      customSourceRoot: storedCustom,
      importedSections
    }
  }

  async importSection(
    sectionId: LegacyVersionMigrationSectionId,
    options?: { legacySourceRoot?: string | null; onProgress?: (message: string) => void }
  ): Promise<LegacyVersionMigrationImportResult> {
    const targetRoot = await pathService.getRootDirectory()
    const source = await resolveDesktopVersionMigrationLegacySource(
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

    const deps = await buildImporterDeps(source.sourceRoot, targetRoot, options?.onProgress)
    await applyFlutterPrefsToDeps(deps, source.sourceRoot)

    const workspaceName = parseWorkspaceSectionId(sectionId)
    if (workspaceName) {
      const targetVault = await deps.resolveTargetVaultName(workspaceName)
      ;(deps as { diaryService: Awaited<ReturnType<typeof getDiaryManagerForVault>> }).diaryService =
        await getDiaryManagerForVault(targetVault)
    }

    let assistantIdMap = await getStoredAssistantIdMap()
    const result = await importLegacyVersionMigrationSection(sectionId, deps, { assistantIdMap })

    if (workspaceName && (result.imported > 0 || result.skipped > 0)) {
      await pathService.backfillGlobalAgentAvatarsFromVaults()
      await globalBootstrapper.fullyResyncAllEcosystems()
    }

    if (result.assistantIdMap && Object.keys(result.assistantIdMap).length > 0) {
      await mergeAssistantIdMap(result.assistantIdMap)
    }
    if (result.vaultNameMap && Object.keys(result.vaultNameMap).length > 0) {
      await mergeVaultNameMap(result.vaultNameMap)
    }
    const completed =
      result.failed === 0 &&
      (result.imported > 0 ||
        (result.skipped > 0 &&
          !result.warnings.includes('version_migration.import_section_unavailable') &&
          !result.warnings.includes('version_migration.no_legacy_source')))

    if (completed) {
      await markVersionMigrationSectionImported(sectionId)
      if (sectionId === 'avatar' || sectionId === 'personas' || sectionId === 'config') {
        // profileRepo 只写 SQLite；必须先刷盘，否则 fullResyncFromDisk 会用旧 user_profile.json 覆盖导入结果
        await settingsManager.flushToDisk()
        await globalBootstrapper.fullyResyncAllEcosystems()
      }
    }

    return result
  }

  async importAllWorkspaces(
    workspaceSectionIds: LegacyVersionMigrationSectionId[],
    options?: { legacySourceRoot?: string | null; onProgress?: (message: string) => void }
  ): Promise<LegacyVersionMigrationBatchImportResult> {
    let totalImported = 0
    let totalSkipped = 0
    let totalFailed = 0
    const warnings: string[] = []
    const errors: string[] = []
    const sectionResults: LegacyVersionMigrationImportResult[] = []

    for (const sectionId of workspaceSectionIds) {
      const result = await this.importSection(sectionId, options)
      sectionResults.push(result)
      totalImported += result.imported
      totalSkipped += result.skipped
      totalFailed += result.failed
      warnings.push(...result.warnings)
      if (result.errors) errors.push(...result.errors)
    }

    return {
      sectionId: workspaceSectionIds[0] ?? ('workspace:all' as LegacyVersionMigrationSectionId),
      imported: totalImported,
      skipped: totalSkipped,
      failed: totalFailed,
      warnings: [...new Set(warnings)],
      errors: errors.length > 0 ? errors : undefined,
      sectionResults
    }
  }

  async setCustomSource(path: string | null): Promise<void> {
    await setCustomLegacySourceRoot(path)
  }

  async getCustomSource(): Promise<string | null> {
    return getCustomLegacySourceRoot()
  }
}

async function loadVersionMigrationStateSafe() {
  const { loadVersionMigrationState } = await import('./desktop-legacy-version-migration.state')
  return loadVersionMigrationState()
}

export const desktopLegacyVersionMigrationService = new DesktopLegacyVersionMigrationService()
