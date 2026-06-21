import AsyncStorage from '@react-native-async-storage/async-storage'
import type {
  LegacyVersionMigrationSectionId,
  LegacyVersionMigrationState
} from '@baishou/core-mobile'

const LEGACY_SOURCE_ROOT_KEY = '@baishou/version_migration_legacy_source'
const VERSION_MIGRATION_STATE_KEY = '@baishou/version_migration_state'

export async function getCustomLegacySourceRoot(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LEGACY_SOURCE_ROOT_KEY)
  } catch {
    return null
  }
}

export async function setCustomLegacySourceRoot(path: string | null): Promise<void> {
  if (path) {
    await AsyncStorage.setItem(LEGACY_SOURCE_ROOT_KEY, path)
  } else {
    await AsyncStorage.removeItem(LEGACY_SOURCE_ROOT_KEY)
  }
}

function emptyState(): LegacyVersionMigrationState {
  return {
    assistantIdMap: {},
    vaultNameMap: {},
    importedSections: [],
    updatedAt: new Date().toISOString()
  }
}

export async function loadVersionMigrationState(): Promise<LegacyVersionMigrationState | null> {
  try {
    const raw = await AsyncStorage.getItem(VERSION_MIGRATION_STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LegacyVersionMigrationState
    return {
      ...emptyState(),
      ...parsed,
      vaultNameMap: parsed.vaultNameMap ?? {}
    }
  } catch {
    return null
  }
}

export async function saveVersionMigrationState(state: LegacyVersionMigrationState): Promise<void> {
  await AsyncStorage.setItem(VERSION_MIGRATION_STATE_KEY, JSON.stringify(state))
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
