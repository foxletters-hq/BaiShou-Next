import {
  isWorkspaceSectionId,
  parseWorkspaceSectionId,
  resolveLegacyVaultTargetName,
  type LegacyVersionMigrationImportResult,
  type LegacyVersionMigrationSectionId
} from './legacy-version-migration.util'
import type { LegacyVersionMigrationImporterDeps } from './legacy-version-migration.importer.types'
import {
  importLegacyAvatarSection,
  importLegacyConfigSection,
  importLegacyPersonasSection
} from './legacy-version-migration.importer.profile'
import { importLegacyWorkspaceSection } from './legacy-version-migration.importer.workspace'

export type { LegacyVersionMigrationImporterDeps } from './legacy-version-migration.importer.types'
export {
  importLegacyAvatarSection,
  importLegacyConfigSection,
  importLegacyPersonasSection
} from './legacy-version-migration.importer.profile'
export {
  importLegacyArchivesForVault,
  importLegacyDiariesForVault
} from './legacy-version-migration.importer.diaries'
export { importLegacyAssistantsFromRows } from './legacy-version-migration.importer.assistants'
export { importLegacyChatsFromRows } from './legacy-version-migration.importer.chats'
export { importLegacyWorkspaceSection } from './legacy-version-migration.importer.workspace'

export async function importLegacyVersionMigrationSection(
  sectionId: LegacyVersionMigrationSectionId,
  deps: LegacyVersionMigrationImporterDeps,
  options?: { assistantIdMap?: Record<string, string> }
): Promise<LegacyVersionMigrationImportResult> {
  const workspaceName = parseWorkspaceSectionId(sectionId)
  if (workspaceName) {
    return importLegacyWorkspaceSection(deps, workspaceName, options)
  }

  switch (sectionId) {
    case 'avatar':
      return importLegacyAvatarSection(deps)
    case 'personas':
      return importLegacyPersonasSection(deps)
    case 'config':
      return importLegacyConfigSection(deps)
    default:
      if (isWorkspaceSectionId(sectionId)) {
        return importLegacyWorkspaceSection(deps, parseWorkspaceSectionId(sectionId)!, options)
      }
      return {
        sectionId,
        imported: 0,
        skipped: 1,
        failed: 0,
        warnings: ['version_migration.import_section_unavailable']
      }
  }
}

export { resolveLegacyVaultTargetName }
