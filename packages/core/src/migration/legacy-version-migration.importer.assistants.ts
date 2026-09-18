import i18n from 'i18next'
import type { InsertAssistantInput } from '@baishou/database'
import {
  resolveImportedAssistantAvatarPath,
  resolveLegacyAvatarPathInMap
} from './legacy-avatar-migration.shared'
import {
  generateRemappedId,
  resolveUniqueNameWithTwoDigitSuffix,
  workspaceSectionId,
  type LegacyVersionMigrationImportResult
} from './legacy-version-migration.util'
import type { LegacyVersionMigrationImporterDeps } from './legacy-version-migration.importer.types'

function buildLegacyAssistantInput(
  row: Record<string, unknown>,
  id: string,
  name: string,
  avatarMap: Record<string, string>
): InsertAssistantInput {
  const legacyAvatarPath = row.avatar_path != null ? String(row.avatar_path) : undefined
  const avatarPath = resolveLegacyAvatarPathInMap(legacyAvatarPath, avatarMap) ?? legacyAvatarPath

  return {
    id,
    name,
    emoji: row.emoji != null ? String(row.emoji) : undefined,
    description: row.description != null ? String(row.description) : undefined,
    avatarPath,
    systemPrompt: row.system_prompt != null ? String(row.system_prompt) : undefined,
    isDefault: false,
    isPinned: Number(row.is_pinned) === 1,
    contextWindow: row.context_window != null ? Number(row.context_window) : undefined,
    providerId: row.provider_id != null ? String(row.provider_id) : null,
    modelId: row.model_id != null ? String(row.model_id) : null,
    compressTokenThreshold:
      row.compress_token_threshold != null ? Number(row.compress_token_threshold) : undefined,
    compressKeepTurns:
      row.compress_keep_turns != null ? Number(row.compress_keep_turns) : undefined,
    sortOrder: row.sort_order != null ? Number(row.sort_order) : undefined
  }
}

export async function importLegacyAssistantsFromRows(
  deps: LegacyVersionMigrationImporterDeps,
  assistants: Record<string, unknown>[],
  options?: { assistantIdMap?: Record<string, string>; avatarMap?: Record<string, string> }
): Promise<LegacyVersionMigrationImportResult> {
  const { assistantManager, onProgress } = deps
  const priorMap = options?.assistantIdMap ?? {}
  const avatarMap = options?.avatarMap ?? {}

  const existingNames = await deps.existingAssistantNames()
  const existingIds = new Set<string>()
  for (const a of await assistantManager.findAll()) {
    existingNames.add(a.name)
    existingIds.add(a.id)
  }

  const assistantIdMap: Record<string, string> = { ...priorMap }
  let imported = 0
  let skipped = 0
  let failed = 0
  const failureSamples: string[] = []

  for (const row of assistants) {
    const oldId = String(row.id ?? '')
    if (!oldId) continue
    onProgress?.(String(row.name ?? oldId))

    if (priorMap[oldId]) {
      const mappedId = priorMap[oldId]
      assistantIdMap[oldId] = mappedId
      if (deps.assistantRecordExists && (await deps.assistantRecordExists(mappedId))) {
        skipped += 1
        continue
      }
      try {
        await assistantManager.ensureDiskFromInput(
          buildLegacyAssistantInput(row, mappedId, String(row.name ?? mappedId), avatarMap)
        )
        imported += 1
      } catch (error) {
        failed += 1
        if (failureSamples.length < 12) {
          const message = error instanceof Error ? error.message : String(error)
          failureSamples.push(`伙伴 ${String(row.name ?? oldId)}: ${message}`)
        }
      }
      continue
    }

    if (existingIds.has(oldId)) {
      assistantIdMap[oldId] = oldId
      try {
        await assistantManager.syncToDisk(oldId)
      } catch (error) {
        failed += 1
        if (failureSamples.length < 12) {
          const message = error instanceof Error ? error.message : String(error)
          failureSamples.push(`伙伴 ${String(row.name ?? oldId)}: ${message}`)
        }
        continue
      }
      skipped += 1
      continue
    }

    const uniqueName = resolveUniqueNameWithTwoDigitSuffix(
      String(
        row.name ??
          i18n.t('auto.packages.core.src.migration.legacy.version.migration.importer.L699', '伙伴')
      ),
      existingNames
    )
    existingNames.add(uniqueName)
    const newId = generateRemappedId('legacy_ast')
    assistantIdMap[oldId] = newId

    try {
      const legacyAvatarPath = row.avatar_path != null ? String(row.avatar_path) : undefined
      const avatarPath = await resolveImportedAssistantAvatarPath(deps.fileSystem, {
        legacyAvatarPath,
        assistantId: oldId,
        sourceRoot: deps.sourceRoot,
        avatarMap,
        flutterDocumentsAvatarsDir: deps.flutterDocumentsAvatarsDir,
        importAvatar: deps.importAvatar
      })

      await assistantManager.create({
        ...buildLegacyAssistantInput(row, newId, uniqueName, avatarMap),
        avatarPath
      })
      imported += 1
    } catch (error) {
      failed += 1
      if (failureSamples.length < 12) {
        const message = error instanceof Error ? error.message : String(error)
        failureSamples.push(`伙伴 ${String(row.name ?? oldId)}: ${message}`)
      }
    }
  }

  return {
    sectionId: workspaceSectionId('_assistants'),
    imported,
    skipped,
    failed,
    warnings: failed > 0 ? ['version_migration.import_partial_failed'] : [],
    failureSamples: failureSamples.length > 0 ? failureSamples : undefined,
    assistantIdMap
  }
}
