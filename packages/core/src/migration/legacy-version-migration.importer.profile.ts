import type { UserProfile } from '@baishou/shared'
import { restoreLegacyDevicePreferences } from '../import/legacy-config-restore.shared'
import { restoreLegacyUserAvatar } from './legacy-avatar-migration.shared'
import {
  parseLegacyIdentityFacts,
  parseLegacyPersonasFromSp,
  resolveLegacyIdentityPersonas,
  resolveUniqueNameWithTwoDigitSuffix,
  type LegacyVersionMigrationImportResult
} from './legacy-version-migration.util'
import type { LegacyVersionMigrationImporterDeps } from './legacy-version-migration.importer.types'

/** 头像：始终覆盖当前用户头像 */
export async function importLegacyAvatarSection(
  deps: LegacyVersionMigrationImporterDeps
): Promise<LegacyVersionMigrationImportResult> {
  const {
    fileSystem,
    sourceRoot,
    flutterPrefsConfig,
    flutterRawSp,
    flutterDocumentsAvatarsDir,
    importAvatar,
    saveUserAvatarPath
  } = deps

  const spAvatarPath =
    typeof flutterRawSp?.['user_avatar_path'] === 'string'
      ? (flutterRawSp['user_avatar_path'] as string)
      : typeof flutterPrefsConfig?.['user_avatar_path'] === 'string'
        ? (flutterPrefsConfig['user_avatar_path'] as string)
        : null

  try {
    const avatarRel = await restoreLegacyUserAvatar(fileSystem, {
      userAvatarPathFromPrefs: spAvatarPath,
      sourceRoot,
      flutterDocumentsAvatarsDir,
      importAvatar
    })

    if (avatarRel) {
      await saveUserAvatarPath(avatarRel)
      if (deps.flushSettingsToDisk) {
        await deps.flushSettingsToDisk()
      }
      return { sectionId: 'avatar', imported: 1, skipped: 0, failed: 0, warnings: [] }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      sectionId: 'avatar',
      imported: 0,
      skipped: 0,
      failed: 1,
      warnings: ['version_migration.import_avatar_none'],
      failureSamples: [message]
    }
  }

  return {
    sectionId: 'avatar',
    imported: 0,
    skipped: 1,
    failed: 0,
    warnings: ['version_migration.import_avatar_none']
  }
}

export async function importLegacyPersonasSection(
  deps: LegacyVersionMigrationImporterDeps
): Promise<LegacyVersionMigrationImportResult> {
  const personasFromSp = deps.flutterRawSp ? parseLegacyPersonasFromSp(deps.flutterRawSp) : []
  const personasFromConfig = deps.flutterPrefsConfig
    ? parseLegacyPersonasFromSp(deps.flutterPrefsConfig)
    : []
  const configIdentityFacts = parseLegacyIdentityFacts(deps.flutterPrefsConfig?.['identity_facts'])
  const legacyPersonas = resolveLegacyIdentityPersonas(
    deps.flutterRawSp ?? null,
    deps.flutterPrefsConfig ?? null
  )
  const { profileRepo } = deps
  if (legacyPersonas.length === 0) {
    return {
      sectionId: 'personas',
      imported: 0,
      skipped: 1,
      failed: 0,
      warnings: ['version_migration.import_section_unavailable']
    }
  }

  const profile = await profileRepo.getProfile()
  const existingIds = await deps.existingPersonaIds()
  const personasMap = { ...profile.personas }
  let imported = 0
  let skipped = 0
  const legacyActivePersonaId =
    typeof deps.flutterRawSp?.['user_active_persona_id'] === 'string'
      ? String(deps.flutterRawSp['user_active_persona_id'])
      : typeof deps.flutterPrefsConfig?.['user_active_persona_id'] === 'string'
        ? String(deps.flutterPrefsConfig['user_active_persona_id'])
        : null

  if (personasFromSp.length === 0 && personasFromConfig.length === 0 && configIdentityFacts) {
    const activeId = profile.activePersonaId
    const active = personasMap[activeId] ?? { id: activeId, facts: {} }
    personasMap[activeId] = {
      ...active,
      facts: { ...active.facts, ...configIdentityFacts }
    }
    imported = 1
    await profileRepo.saveProfile({ ...profile, personas: personasMap } satisfies UserProfile)
    if (deps.flushSettingsToDisk) {
      await deps.flushSettingsToDisk()
    }
    return { sectionId: 'personas', imported, skipped, failed: 0, warnings: [] }
  }

  for (const legacy of legacyPersonas) {
    const allIds = new Set([...Object.keys(personasMap), ...existingIds])
    if (personasMap[legacy.id]) {
      const current = personasMap[legacy.id]!
      const mergedFacts = { ...current.facts, ...legacy.facts }
      const changed = JSON.stringify(current.facts) !== JSON.stringify(mergedFacts)
      personasMap[legacy.id] = { ...current, facts: mergedFacts }
      if (changed) imported += 1
      else skipped += 1
      continue
    }

    const newId = resolveUniqueNameWithTwoDigitSuffix(legacy.id, allIds)
    personasMap[newId] = { id: newId, facts: { ...legacy.facts } }
    existingIds.add(newId)
    imported += 1
  }

  const activePersonaId =
    legacyActivePersonaId && personasMap[legacyActivePersonaId]
      ? legacyActivePersonaId
      : profile.activePersonaId

  await profileRepo.saveProfile({
    ...profile,
    activePersonaId,
    personas: personasMap
  } satisfies UserProfile)
  if (deps.flushSettingsToDisk) {
    await deps.flushSettingsToDisk()
  }
  return { sectionId: 'personas', imported, skipped, failed: 0, warnings: [] }
}

export async function importLegacyConfigSection(
  deps: LegacyVersionMigrationImporterDeps
): Promise<LegacyVersionMigrationImportResult> {
  const { flutterPrefsConfig, settingsRepo, profileRepo, flushSettingsToDisk } = deps
  if (!flutterPrefsConfig) {
    return {
      sectionId: 'config',
      imported: 0,
      skipped: 1,
      failed: 0,
      warnings: ['version_migration.import_section_unavailable']
    }
  }

  const localCloudSync = await settingsRepo.get('cloud_sync_config')
  await restoreLegacyDevicePreferences(settingsRepo, profileRepo, flutterPrefsConfig, {
    preserveCloudSync: localCloudSync != null,
    skipProfileFields: true
  })

  if (flushSettingsToDisk) {
    await flushSettingsToDisk()
  }
  return { sectionId: 'config', imported: 1, skipped: 0, failed: 0, warnings: [] }
}
