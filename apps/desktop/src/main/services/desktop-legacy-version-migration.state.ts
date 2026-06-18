import type { LegacyVersionMigrationSectionId, LegacyVersionMigrationState } from '@baishou/shared'
import { SettingsRepository } from '@baishou/database-desktop'
import { getAppDb } from '../db'

export const DESKTOP_VERSION_MIGRATION_CUSTOM_SOURCE_KEY = 'desktop_version_migration_custom_source'
export const DESKTOP_VERSION_MIGRATION_STATE_KEY = 'desktop_version_migration_state'

function repo(): SettingsRepository {
  return new SettingsRepository(getAppDb())
}

function emptyState(): LegacyVersionMigrationState {
  return {
    assistantIdMap: {},
    vaultNameMap: {},
    importedSections: [],
    updatedAt: new Date().toISOString()
  }
}

export async function getCustomLegacySourceRoot(): Promise<string | null> {
  const value = await repo().get<string>(DESKTOP_VERSION_MIGRATION_CUSTOM_SOURCE_KEY)
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export async function setCustomLegacySourceRoot(path: string | null): Promise<void> {
  if (path?.trim()) {
    await repo().set(DESKTOP_VERSION_MIGRATION_CUSTOM_SOURCE_KEY, path.trim())
  } else {
    await repo().delete(DESKTOP_VERSION_MIGRATION_CUSTOM_SOURCE_KEY)
  }
}

export async function loadVersionMigrationState(): Promise<LegacyVersionMigrationState | null> {
  const parsed = await repo().get<LegacyVersionMigrationState>(DESKTOP_VERSION_MIGRATION_STATE_KEY)
  if (!parsed) return null
  return {
    ...emptyState(),
    ...parsed,
    vaultNameMap: parsed.vaultNameMap ?? {}
  }
}

async function saveVersionMigrationState(state: LegacyVersionMigrationState): Promise<void> {
  await repo().set(DESKTOP_VERSION_MIGRATION_STATE_KEY, state)
}

export async function mergeAssistantIdMap(
  map: Record<string, string>
): Promise<Record<string, string>> {
  const existing = (await loadVersionMigrationState()) ?? emptyState()
  const next: LegacyVersionMigrationState = {
    ...existing,
    assistantIdMap: { ...existing.assistantIdMap, ...map },
    updatedAt: new Date().toISOString()
  }
  await saveVersionMigrationState(next)
  return next.assistantIdMap
}

export async function mergeVaultNameMap(
  map: Record<string, string>
): Promise<Record<string, string>> {
  const existing = (await loadVersionMigrationState()) ?? emptyState()
  const next: LegacyVersionMigrationState = {
    ...existing,
    vaultNameMap: { ...existing.vaultNameMap, ...map },
    updatedAt: new Date().toISOString()
  }
  await saveVersionMigrationState(next)
  return next.vaultNameMap
}

export async function markVersionMigrationSectionImported(
  sectionId: LegacyVersionMigrationSectionId
): Promise<void> {
  const existing = (await loadVersionMigrationState()) ?? emptyState()
  const importedSections = existing.importedSections.includes(sectionId)
    ? existing.importedSections
    : [...existing.importedSections, sectionId]
  await saveVersionMigrationState({
    ...existing,
    importedSections,
    updatedAt: new Date().toISOString()
  })
}

export async function getStoredAssistantIdMap(): Promise<Record<string, string>> {
  const state = await loadVersionMigrationState()
  return state?.assistantIdMap ?? {}
}

export async function getStoredVaultNameMap(): Promise<Record<string, string>> {
  const state = await loadVersionMigrationState()
  return state?.vaultNameMap ?? {}
}
