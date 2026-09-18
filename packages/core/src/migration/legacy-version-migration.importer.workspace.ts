import { importLegacySqlSummariesForVault } from './legacy-summary-migration.util'
import {
  mergeAvatarMaps,
  restoreLegacyAvatarsFromArchiveLayout,
  restoreLegacyAvatarsFromDocumentsDir
} from './legacy-avatar-migration.shared'
import {
  filterAssistantIdMapForVault,
  scopeAssistantIdMapForVault,
  workspaceSectionId,
  type LegacyVersionMigrationImportResult
} from './legacy-version-migration.util'
import type {
  LegacyAgentRows,
  LegacyVersionMigrationImporterDeps
} from './legacy-version-migration.importer.types'
import { queryLegacyAgentRows } from './legacy-version-migration.importer.sql'
import {
  importLegacyArchivesForVault,
  importLegacyDiariesForVault
} from './legacy-version-migration.importer.diaries'
import { importLegacyAssistantsFromRows } from './legacy-version-migration.importer.assistants'
import {
  importLegacyChatsFromRows,
  importLegacyChatsFromSources
} from './legacy-version-migration.importer.chats'

export async function ensureTargetVaultExists(
  deps: LegacyVersionMigrationImporterDeps,
  legacyVaultName: string
): Promise<string> {
  const targetName = await deps.resolveTargetVaultName(legacyVaultName)
  if (!deps.vaultService.vaultExists(targetName)) {
    await deps.vaultService.createVault(targetName)
  }
  if (deps.onVaultNameMapped && targetName !== legacyVaultName) {
    await deps.onVaultNameMapped(legacyVaultName, targetName)
  }
  return targetName
}

/** 按工作空间导入：日记 + 伙伴 + 会话（一体） */
export async function importLegacyWorkspaceSection(
  deps: LegacyVersionMigrationImporterDeps,
  legacyVaultName: string,
  options?: { assistantIdMap?: Record<string, string> }
): Promise<LegacyVersionMigrationImportResult> {
  const sectionId = workspaceSectionId(legacyVaultName)
  const warnings: string[] = []
  const errors: string[] = []
  const failureSamples: string[] = []
  let imported = 0
  let skipped = 0
  let failed = 0

  deps.onProgress?.(legacyVaultName)

  const targetName = await ensureTargetVaultExists(deps, legacyVaultName)
  const vaultNameMap = { [legacyVaultName]: targetName }
  const scopedDeps: LegacyVersionMigrationImporterDeps = {
    ...deps,
    resolveTargetVaultName: async () => targetName
  }

  const archiveAvatarMap = await restoreLegacyAvatarsFromArchiveLayout(
    deps.fileSystem,
    deps.sourceRoot,
    deps.importAvatar
  )
  const documentsAvatarMap = deps.flutterDocumentsAvatarsDir
    ? await restoreLegacyAvatarsFromDocumentsDir(
        deps.fileSystem,
        deps.flutterDocumentsAvatarsDir,
        deps.importAvatar
      )
    : {}
  const avatarMap = mergeAvatarMaps(archiveAvatarMap, documentsAvatarMap)

  const diaryResult = await importLegacyDiariesForVault(scopedDeps, legacyVaultName)
  imported += diaryResult.imported
  skipped += diaryResult.skipped
  failed += diaryResult.failed
  if (diaryResult.failureSamples) failureSamples.push(...diaryResult.failureSamples)
  if (diaryResult.failed > 0) {
    warnings.push('version_migration.import_partial_failed')
  }

  const archivesResult = await importLegacyArchivesForVault(scopedDeps, legacyVaultName)
  imported += archivesResult.imported
  skipped += archivesResult.skipped
  failed += archivesResult.failed
  if (archivesResult.failureSamples) failureSamples.push(...archivesResult.failureSamples)
  if (archivesResult.failed > 0) {
    warnings.push('version_migration.import_partial_failed')
  }

  const sqlSummaryResult = await importLegacySqlSummariesForVault({
    fileSystem: deps.fileSystem,
    sourceRoot: deps.sourceRoot,
    targetRoot: deps.targetRoot,
    legacyVaultName,
    sqliteClient: deps.sqliteClient,
    executeRawSql: deps.executeRawSql,
    resolveTargetVaultName: scopedDeps.resolveTargetVaultName,
    prepareSqliteAttachPath: deps.prepareSqliteAttachPath,
    onProgress: deps.onProgress
  })
  imported += sqlSummaryResult.imported
  skipped += sqlSummaryResult.skipped
  failed += sqlSummaryResult.failed
  if (sqlSummaryResult.failureSamples) failureSamples.push(...sqlSummaryResult.failureSamples)
  if (sqlSummaryResult.failed > 0) {
    warnings.push('version_migration.import_partial_failed')
  }

  let agentRows: LegacyAgentRows
  try {
    agentRows = await queryLegacyAgentRows(deps, { legacyVaultName })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      sectionId,
      imported,
      skipped,
      failed: failed + 1,
      warnings: ['version_migration.warning_agent_db_read_failed', ...warnings],
      errors: [message],
      vaultNameMap
    }
  }

  if (agentRows.errors.length > 0) {
    errors.push(...agentRows.errors)
    warnings.push('version_migration.warning_agent_db_read_partial')
  }

  if (agentRows.assistants.length === 0 && agentRows.sessions.length === 0) {
    return {
      sectionId,
      imported,
      skipped,
      failed,
      warnings,
      errors: errors.length > 0 ? errors : undefined,
      vaultNameMap
    }
  }

  const priorMap = filterAssistantIdMapForVault(options?.assistantIdMap ?? {}, legacyVaultName)

  let agentResultImported = 0
  let agentResultSkipped = 0
  let agentResultFailed = 0
  let agentResultWarnings: string[] = []
  let agentResultFailureSamples: string[] | undefined
  let assistantIdMapLocal: Record<string, string> = { ...priorMap }

  await scopedDeps.runInVaultContext(legacyVaultName, async () => {
    const assistantResult = await importLegacyAssistantsFromRows(scopedDeps, agentRows.assistants, {
      assistantIdMap: priorMap,
      avatarMap
    })
    agentResultImported += assistantResult.imported
    agentResultSkipped += assistantResult.skipped
    agentResultFailed += assistantResult.failed
    if (assistantResult.failureSamples) {
      agentResultFailureSamples = [
        ...(agentResultFailureSamples ?? []),
        ...assistantResult.failureSamples
      ]
    }
    if (assistantResult.warnings.length > 0) {
      agentResultWarnings.push(...assistantResult.warnings)
    }
    assistantIdMapLocal = {
      ...priorMap,
      ...(assistantResult.assistantIdMap ?? {})
    }

    const chatResult =
      agentRows.sessionSources && agentRows.sessionSources.size > 0
        ? await importLegacyChatsFromSources(
            scopedDeps,
            agentRows,
            assistantIdMapLocal,
            legacyVaultName
          )
        : await importLegacyChatsFromRows(
            scopedDeps,
            agentRows,
            assistantIdMapLocal,
            legacyVaultName
          )
    agentResultImported += chatResult.imported
    agentResultSkipped += chatResult.skipped
    agentResultFailed += chatResult.failed
    if (chatResult.failureSamples) {
      agentResultFailureSamples = [
        ...(agentResultFailureSamples ?? []),
        ...chatResult.failureSamples
      ]
    }
    if (chatResult.warnings.length > 0) {
      agentResultWarnings.push(...chatResult.warnings)
    }
    if (chatResult.errors) {
      errors.push(...chatResult.errors)
    }
  })

  const assistantResult = {
    imported: agentResultImported,
    skipped: agentResultSkipped,
    failed: agentResultFailed,
    warnings: agentResultWarnings,
    failureSamples: agentResultFailureSamples
  }

  imported += assistantResult.imported
  skipped += assistantResult.skipped
  failed += assistantResult.failed
  if (assistantResult.failureSamples) failureSamples.push(...assistantResult.failureSamples)
  if (assistantResult.warnings.length > 0) {
    warnings.push(...assistantResult.warnings)
  }

  const assistantIdMap = scopeAssistantIdMapForVault(assistantIdMapLocal, legacyVaultName)

  return {
    sectionId,
    imported,
    skipped,
    failed,
    warnings: [...new Set(warnings)],
    errors: errors.length > 0 ? errors : undefined,
    failureSamples: failureSamples.length > 0 ? failureSamples.slice(0, 20) : undefined,
    assistantIdMap,
    vaultNameMap
  }
}
