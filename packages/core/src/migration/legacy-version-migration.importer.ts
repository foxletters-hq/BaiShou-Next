import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { parseJournalMarkdown } from '../diary/journal-markdown.parser'
import { parseDateStr } from '@baishou/shared'
import type { CreateDiaryInput, UserProfile } from '@baishou/shared'
import type { DiaryService } from '../diary/diary.service'
import type { AssistantManagerService } from '../assistant/assistant-manager.service'
import type { SessionManagerService } from '../session/session-manager.service'
import type { VaultService } from '../vault/vault.service'
import type { SettingsRepository, UserProfileRepository } from '@baishou/database'
import type { InsertAssistantInput } from '@baishou/database'
import {
  normalizeSqliteAttachPath,
  mergeDirectories,
  scanLegacyDatabases,
  isVaultSpecificLegacyAgentDb,
  resolveLegacyAgentDbPathsForVault,
  type RawSqlExecutor
} from './legacy-migration.shared'
import { restoreLegacyDevicePreferences } from '../import/legacy-config-restore.shared'
import {
  buildJournalFilePathFromDateStr,
  importLegacyJournalToDisk,
  legacyJournalAlreadyMigrated
} from './legacy-journal-migration.util'
import { countArchiveMarkdownUnderArchivesDir } from '../vault/archive-files.util'
import { importLegacySqlSummariesForVault } from './legacy-summary-migration.util'
import {
  mergeAvatarMaps,
  restoreLegacyAvatarsFromArchiveLayout,
  restoreLegacyAvatarsFromDocumentsDir,
  restoreLegacyUserAvatar,
  resolveImportedAssistantAvatarPath,
  resolveLegacyAvatarPathInMap,
  type LegacyAvatarImporter
} from './legacy-avatar-migration.shared'
import {
  generateRemappedId,
  isWorkspaceSectionId,
  legacySessionBelongsToVault,
  normalizeLegacyPartData,
  normalizeLegacyPartType,
  parseLegacyIdentityFacts,
  parseLegacyPersonasFromSp,
  resolveLegacyIdentityPersonas,
  parseWorkspaceSectionId,
  filterAssistantIdMapForVault,
  scopeAssistantIdMapForVault,
  resolveLegacyVaultTargetName,
  resolveUniqueNameWithTwoDigitSuffix,
  workspaceSectionId,
  type LegacyVersionMigrationImportResult,
  type LegacyVersionMigrationSectionId
} from './legacy-version-migration.util'

const JOURNAL_DATE_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/i
const LEGACY_IMPORT_SESSION_PAGE_SIZE = 50
const LEGACY_IMPORT_MESSAGE_PAGE_SIZE = 40
const LEGACY_IMPORT_PART_PAGE_SIZE = 40

function quoteSqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0
  }
  return hash >>> 0
}

export interface LegacyVersionMigrationImporterDeps {
  fileSystem: IFileSystem
  sourceRoot: string
  targetRoot: string
  flutterPrefsConfig: Record<string, unknown> | null
  /** Flutter SP 原始键值（含 user_personas） */
  flutterRawSp: Record<string, unknown> | null
  flutterDocumentsAvatarsDir: string | null
  sqliteClient: unknown
  executeRawSql: RawSqlExecutor
  settingsRepo: SettingsRepository
  profileRepo: UserProfileRepository
  diaryService: DiaryService
  assistantManager: AssistantManagerService
  sessionManager: SessionManagerService
  vaultService: VaultService
  importAvatar: LegacyAvatarImporter
  saveUserAvatarPath: (relativePath: string) => Promise<void>
  existingAssistantNames: () => Promise<Set<string>>
  existingSessionIds: () => Promise<Set<string>>
  existingPersonaIds: () => Promise<Set<string>>
  storedAssistantIdMap?: Record<string, string>
  upsertSessionAggregate: (aggregate: unknown) => Promise<void>
  runInVaultContext: <T>(vaultName: string, fn: () => Promise<T>) => Promise<T>
  resolveTargetVaultName: (legacyVaultName: string) => Promise<string>
  onVaultNameMapped?: (legacyName: string, targetName: string) => Promise<void>
  flushSettingsToDisk?: () => Promise<void>
  onProgress?: (message: string) => void
  /** 读取映射后的目标工作区日记原文（用于去重比对） */
  readTargetJournalRaw?: (dateStr: string, targetVaultName: string) => Promise<string | null>
  /** 当前工作区是否已有该伙伴 JSON（用于跳过重复导入） */
  assistantRecordExists?: (assistantId: string) => Promise<boolean>
  /** 移动端迁移：按映射后的目标工作区解析 Journals 根目录（仅写文件、不建影子索引） */
  getJournalsBaseDirectory?: (targetVaultName: string) => Promise<string>
  /** 移动端迁移：按映射后的目标工作区解析 Sessions 根目录，用于流式写大会话 JSON */
  getSessionsBaseDirectory?: (targetVaultName: string) => Promise<string>
  /** 将旧版 db 路径转为当前平台可 ATTACH 的路径 */
  prepareSqliteAttachPath?: (dbPath: string) => Promise<string>
}

interface LegacyAgentRows {
  assistants: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  messages: Record<string, unknown>[]
  parts: Record<string, unknown>[]
  errors: string[]
  sessionSources?: Map<string, LegacyAgentSessionSource>
}

interface LegacyAgentSessionSource {
  rawAttachPath: string
  attachPath: string
}

async function walkJournalFiles(
  fileSystem: IFileSystem,
  dir: string,
  onFile: (filePath: string, dateStr: string) => Promise<void>
): Promise<void> {
  if (!(await fileSystem.exists(dir))) return

  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(dir)
  } catch {
    return
  }

  for (const name of entries) {
    const fullPath = path.join(dir, name)
    const dateMatch = JOURNAL_DATE_FILE.exec(name)
    if (dateMatch) {
      await onFile(fullPath, dateMatch[1]!)
      continue
    }
    try {
      const stat = await fileSystem.stat(fullPath)
      if (stat.isDirectory) {
        await walkJournalFiles(fileSystem, fullPath, onFile)
      }
    } catch {
      // skip
    }
  }
}

function diaryInputFromParsed(
  dateStr: string,
  parsed: ReturnType<typeof parseJournalMarkdown>
): CreateDiaryInput {
  const fallbackDate = parseDateStr(dateStr) ?? new Date()
  if (!parsed) {
    return { date: fallbackDate, content: '' }
  }
  return {
    date: parseDateStr(parsed.date) ?? fallbackDate,
    content: parsed.content,
    tags: parsed.tags.length > 0 ? parsed.tags.join(',') : undefined,
    weather: parsed.weather,
    mood: parsed.mood,
    location: parsed.location,
    locationDetail: parsed.locationDetail,
    isFavorite: parsed.isFavorite,
    mediaPaths: parsed.mediaPaths
  }
}

async function queryLegacyAgentRows(
  deps: LegacyVersionMigrationImporterDeps,
  options?: { legacyVaultName?: string }
): Promise<LegacyAgentRows> {
  const { fileSystem, sourceRoot, sqliteClient, executeRawSql } = deps
  const { legacyVaultName } = options ?? {}

  let agentDbPaths: string[]
  if (legacyVaultName) {
    agentDbPaths = await resolveLegacyAgentDbPathsForVault(fileSystem, sourceRoot, legacyVaultName)
  } else {
    agentDbPaths = (await scanLegacyDatabases(fileSystem, sourceRoot)).agentDbs
  }

  const uniquePaths = [...new Set(agentDbPaths.map((p) => normalizeSqliteAttachPath(p)))]
  const assistants: Record<string, unknown>[] = []
  const sessions: Record<string, unknown>[] = []
  const messages: Record<string, unknown>[] = []
  const parts: Record<string, unknown>[] = []
  const errors: string[] = []
  const seenAssistantIds = new Set<string>()
  const seenSessionIds = new Set<string>()
  const sessionSources = new Map<string, LegacyAgentSessionSource>()

  for (let i = 0; i < uniquePaths.length; i++) {
    const alias = `legacy_import_${i}`
    const rawAttachPath = uniquePaths[i]!
    const vaultSpecific = legacyVaultName
      ? isVaultSpecificLegacyAgentDb(rawAttachPath, legacyVaultName)
      : false
    try {
      const attachPath = deps.prepareSqliteAttachPath
        ? await deps.prepareSqliteAttachPath(rawAttachPath)
        : rawAttachPath
      console.info('[VersionMigration][import-agent-db] attach', {
        legacyVaultName,
        rawAttachPath,
        attachPath,
        vaultSpecific
      })
      await executeRawSql(sqliteClient, `ATTACH DATABASE ${quoteSqlString(attachPath)} AS ${alias}`)

      const assistantRows = (
        await executeRawSql(sqliteClient, `SELECT * FROM ${alias}.agent_assistants`)
      ).rows
      const sessionRows: Record<string, unknown>[] = []
      let sessionOffset = 0
      while (true) {
        const page = (
          await executeRawSql(
            sqliteClient,
            `SELECT * FROM ${alias}.agent_sessions ORDER BY id LIMIT ? OFFSET ?`,
            [LEGACY_IMPORT_SESSION_PAGE_SIZE, sessionOffset]
          )
        ).rows as Record<string, unknown>[]
        if (page.length === 0) break
        sessionRows.push(...page)
        if (page.length < LEGACY_IMPORT_SESSION_PAGE_SIZE) break
        sessionOffset += LEGACY_IMPORT_SESSION_PAGE_SIZE
      }

      const filteredSessions =
        legacyVaultName && !vaultSpecific
          ? sessionRows.filter((row) =>
              legacySessionBelongsToVault(row.vault_name, legacyVaultName)
            )
          : sessionRows
      console.info('[VersionMigration][import-agent-db] rows', {
        legacyVaultName,
        rawAttachPath,
        assistantRows: assistantRows.length,
        sessionRows: sessionRows.length,
        filteredSessions: filteredSessions.length
      })

      const sessionAssistantIds = new Set<string>()
      for (const row of filteredSessions) {
        const sid = String(row.id ?? '')
        if (!sid || seenSessionIds.has(sid)) continue
        seenSessionIds.add(sid)
        sessionSources.set(sid, { rawAttachPath, attachPath })
        sessions.push(row)
        if (row.assistant_id != null) {
          sessionAssistantIds.add(String(row.assistant_id))
        }
      }

      for (const row of assistantRows) {
        const aid = String(row.id ?? '')
        if (!aid || seenAssistantIds.has(aid)) continue
        if (
          legacyVaultName &&
          !vaultSpecific &&
          sessionAssistantIds.size > 0 &&
          !sessionAssistantIds.has(aid)
        ) {
          continue
        }
        seenAssistantIds.add(aid)
        assistants.push(row)
      }

      await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[VersionMigration][import-agent-db] failed', {
        legacyVaultName,
        rawAttachPath,
        alias,
        error: message
      })
      errors.push(message)
      try {
        await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
      } catch {
        // ignore
      }
    }
  }

  return { assistants, sessions, messages, parts, errors, sessionSources }
}

async function ensureTargetVaultExists(
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

export async function importLegacyDiariesForVault(
  deps: LegacyVersionMigrationImporterDeps,
  legacyVaultName: string
): Promise<
  Pick<LegacyVersionMigrationImportResult, 'imported' | 'skipped' | 'failed' | 'failureSamples'>
> {
  const {
    fileSystem,
    sourceRoot,
    diaryService,
    onProgress,
    runInVaultContext,
    readTargetJournalRaw
  } = deps
  let imported = 0
  let skipped = 0
  let failed = 0
  const failureSamples: string[] = []
  const targetVaultName = await deps.resolveTargetVaultName(legacyVaultName)

  const readTargetRaw = async (dateStr: string): Promise<string | null> => {
    if (readTargetJournalRaw) {
      return readTargetJournalRaw(dateStr, targetVaultName)
    }
    const targetPath = buildJournalFilePathFromDateStr(
      path.join(deps.targetRoot, targetVaultName, 'Journals'),
      dateStr
    )
    if (!(await fileSystem.exists(targetPath))) return null
    return fileSystem.readFile(targetPath, 'utf8')
  }

  await runInVaultContext(legacyVaultName, async () => {
    const journalsBase = deps.getJournalsBaseDirectory
      ? await deps.getJournalsBaseDirectory(targetVaultName)
      : path.join(deps.targetRoot, targetVaultName, 'Journals')

    await walkJournalFiles(
      fileSystem,
      path.join(sourceRoot, legacyVaultName, 'Journals'),
      async (filePath, dateStr) => {
        onProgress?.(filePath)
        try {
          const legacyRaw = await fileSystem.readFile(filePath, 'utf8')
          const targetRaw = await readTargetRaw(dateStr)

          if (deps.getJournalsBaseDirectory) {
            const outcome = await importLegacyJournalToDisk(
              fileSystem,
              journalsBase,
              dateStr,
              legacyRaw,
              targetRaw
            )
            if (outcome === 'skipped') skipped += 1
            else imported += 1
            return
          }

          if (targetRaw != null && legacyJournalAlreadyMigrated(legacyRaw, targetRaw, dateStr)) {
            skipped += 1
            return
          }

          const parsed = parseJournalMarkdown(legacyRaw, dateStr)
          await diaryService.save(null, diaryInputFromParsed(dateStr, parsed))
          imported += 1
        } catch (error) {
          failed += 1
          if (failureSamples.length < 12) {
            const message = error instanceof Error ? error.message : String(error)
            failureSamples.push(`日记 ${dateStr}: ${message}`)
          }
        }
      }
    )
  })

  return {
    imported,
    skipped,
    failed,
    failureSamples: failureSamples.length > 0 ? failureSamples : undefined
  }
}

export async function importLegacyArchivesForVault(
  deps: LegacyVersionMigrationImporterDeps,
  legacyVaultName: string
): Promise<
  Pick<LegacyVersionMigrationImportResult, 'imported' | 'skipped' | 'failed' | 'failureSamples'>
> {
  const { fileSystem, sourceRoot, onProgress } = deps
  const sourceArchives = path.join(sourceRoot, legacyVaultName, 'Archives')
  if (!(await fileSystem.exists(sourceArchives))) {
    return { imported: 0, skipped: 0, failed: 0 }
  }

  const targetVault = await deps.resolveTargetVaultName(legacyVaultName)
  const targetArchives = path.join(deps.targetRoot, targetVault, 'Archives')
  const sourceCount = await countArchiveMarkdownUnderArchivesDir(fileSystem, sourceArchives)

  onProgress?.(sourceArchives)
  const failedPaths = await mergeDirectories(fileSystem, sourceArchives, targetArchives)
  if (failedPaths.length > 0) {
    return {
      imported: 0,
      skipped: 0,
      failed: failedPaths.length,
      failureSamples: failedPaths.slice(0, 12).map((p) => `总结 ${p}`)
    }
  }

  return {
    imported: sourceCount,
    skipped: 0,
    failed: 0
  }
}

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
      String(row.name ?? '伙伴'),
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

function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (typeof value === 'number') return new Date(value < 1e12 ? value * 1000 : value)
  if (typeof value === 'string') {
    const d = new Date(value)
    if (!isNaN(d.getTime())) return d
  }
  return new Date()
}

function toUnixSec(value: unknown): number {
  return Math.floor(toDate(value).getTime() / 1000)
}

async function resolveLegacyOrderBy(
  deps: LegacyVersionMigrationImporterDeps,
  alias: string,
  tableName: 'agent_messages' | 'agent_parts'
): Promise<string> {
  try {
    const info = await deps.executeRawSql(
      deps.sqliteClient,
      `PRAGMA ${alias}.table_info('${tableName}')`
    )
    const columns = new Set(info.rows.map((row) => String(row.name)).filter(Boolean))
    if (columns.has('order_index')) return 'order_index ASC, rowid ASC'
    if (columns.has('created_at')) return 'created_at ASC, rowid ASC'
  } catch {
    // Older/corrupt legacy DBs still get a stable best-effort order below.
  }
  return 'rowid ASC'
}

async function loadLegacyPartsForMessage(
  deps: LegacyVersionMigrationImporterDeps,
  alias: string,
  messageId: string,
  orderBy: string
): Promise<Record<string, unknown>[]> {
  const parts: Record<string, unknown>[] = []
  let offset = 0
  while (true) {
    const page = (
      await deps.executeRawSql(
        deps.sqliteClient,
        `SELECT * FROM ${alias}.agent_parts
         WHERE message_id = ?
         ORDER BY ${orderBy}
         LIMIT ? OFFSET ?`,
        [messageId, LEGACY_IMPORT_PART_PAGE_SIZE, offset]
      )
    ).rows as Record<string, unknown>[]
    if (page.length === 0) break
    parts.push(...page)
    if (page.length < LEGACY_IMPORT_PART_PAGE_SIZE) break
    offset += LEGACY_IMPORT_PART_PAGE_SIZE
  }
  return parts
}

function buildLegacyMessageAggregate(
  messageRow: Record<string, unknown>,
  partRows: Record<string, unknown>[],
  newSessionId: string,
  index: number
) {
  const oldMessageId = String(messageRow.id ?? generateRemappedId('legacy_msg'))
  const newMessageId = oldMessageId
  return {
    id: newMessageId,
    sessionId: newSessionId,
    role: String(messageRow.role ?? 'user'),
    isSummary: Number(messageRow.is_summary) === 1,
    orderIndex: messageRow.order_index != null ? Number(messageRow.order_index) : index,
    inputTokens: messageRow.input_tokens != null ? Number(messageRow.input_tokens) : undefined,
    outputTokens: messageRow.output_tokens != null ? Number(messageRow.output_tokens) : undefined,
    costMicros: messageRow.cost_micros != null ? Number(messageRow.cost_micros) : undefined,
    providerId: messageRow.provider_id != null ? String(messageRow.provider_id) : undefined,
    modelId: messageRow.model_id != null ? String(messageRow.model_id) : undefined,
    createdAt: toDate(messageRow.created_at),
    parts: partRows.map((partRow) => {
      const partType = normalizeLegacyPartType(partRow.type)
      return {
        id: String(partRow.id ?? generateRemappedId('legacy_part')),
        messageId: newMessageId,
        sessionId: newSessionId,
        type: partType,
        data: normalizeLegacyPartData(partRow.data, partType),
        createdAt: toDate(partRow.created_at)
      }
    })
  }
}

async function loadLegacyMessagesForSession(
  deps: LegacyVersionMigrationImporterDeps,
  alias: string,
  oldSessionId: string,
  newSessionId: string
) {
  const messages: ReturnType<typeof buildLegacyMessageAggregate>[] = []
  const messageOrderBy = await resolveLegacyOrderBy(deps, alias, 'agent_messages')
  const partOrderBy = await resolveLegacyOrderBy(deps, alias, 'agent_parts')
  let offset = 0
  let index = 0

  while (true) {
    const messageRows = (
      await deps.executeRawSql(
        deps.sqliteClient,
        `SELECT * FROM ${alias}.agent_messages
         WHERE session_id = ?
         ORDER BY ${messageOrderBy}
         LIMIT ? OFFSET ?`,
        [oldSessionId, LEGACY_IMPORT_MESSAGE_PAGE_SIZE, offset]
      )
    ).rows as Record<string, unknown>[]

    if (messageRows.length === 0) break

    for (const messageRow of messageRows) {
      const oldMessageId = String(messageRow.id ?? '')
      const parts = oldMessageId
        ? await loadLegacyPartsForMessage(deps, alias, oldMessageId, partOrderBy)
        : []
      messages.push(buildLegacyMessageAggregate(messageRow, parts, newSessionId, index))
      index += 1
    }

    if (messageRows.length < LEGACY_IMPORT_MESSAGE_PAGE_SIZE) break
    offset += LEGACY_IMPORT_MESSAGE_PAGE_SIZE
  }

  return messages
}

function buildLegacySessionAggregate(
  sessionRow: Record<string, unknown>,
  newSessionId: string,
  mappedAssistantId: string,
  targetVaultName: string
) {
  return {
    id: newSessionId,
    title: sessionRow.title != null ? String(sessionRow.title) : null,
    vaultName: targetVaultName,
    assistantId: mappedAssistantId,
    isPinned: Number(sessionRow.is_pinned) === 1,
    systemPrompt: sessionRow.system_prompt != null ? String(sessionRow.system_prompt) : undefined,
    providerId: sessionRow.provider_id != null ? String(sessionRow.provider_id) : '',
    modelId: sessionRow.model_id != null ? String(sessionRow.model_id) : '',
    totalInputTokens:
      sessionRow.total_input_tokens != null ? Number(sessionRow.total_input_tokens) : 0,
    totalOutputTokens:
      sessionRow.total_output_tokens != null ? Number(sessionRow.total_output_tokens) : 0,
    totalCacheReadInputTokens:
      sessionRow.total_cache_read_input_tokens != null
        ? Number(sessionRow.total_cache_read_input_tokens)
        : 0,
    totalCacheWriteInputTokens:
      sessionRow.total_cache_write_input_tokens != null
        ? Number(sessionRow.total_cache_write_input_tokens)
        : 0,
    totalCostMicros:
      sessionRow.total_cost_micros != null ? Number(sessionRow.total_cost_micros) : 0,
    createdAt: toDate(sessionRow.created_at),
    updatedAt: toDate(sessionRow.updated_at)
  }
}

async function replaceTargetSessionRows(
  deps: LegacyVersionMigrationImporterDeps,
  session: ReturnType<typeof buildLegacySessionAggregate>
): Promise<void> {
  await deps.executeRawSql(deps.sqliteClient, 'DELETE FROM agent_parts WHERE session_id = ?', [
    session.id
  ])
  await deps.executeRawSql(deps.sqliteClient, 'DELETE FROM agent_messages WHERE session_id = ?', [
    session.id
  ])
  await deps.executeRawSql(deps.sqliteClient, 'DELETE FROM agent_sessions WHERE id = ?', [
    session.id
  ])
  await deps.executeRawSql(
    deps.sqliteClient,
    `INSERT INTO agent_sessions
      (id, title, vault_name, assistant_id, is_pinned, system_prompt,
       provider_id, model_id, total_input_tokens, total_output_tokens,
       total_cache_read_input_tokens, total_cache_write_input_tokens,
       total_cost_micros, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      session.id,
      session.title ?? null,
      session.vaultName,
      session.assistantId,
      session.isPinned ? 1 : 0,
      session.systemPrompt ?? null,
      session.providerId,
      session.modelId,
      session.totalInputTokens,
      session.totalOutputTokens,
      session.totalCacheReadInputTokens,
      session.totalCacheWriteInputTokens,
      session.totalCostMicros,
      toUnixSec(session.createdAt),
      toUnixSec(session.updatedAt)
    ]
  )
}

async function insertTargetMessage(
  deps: LegacyVersionMigrationImporterDeps,
  message: ReturnType<typeof buildLegacyMessageAggregate>
): Promise<void> {
  await deps.executeRawSql(
    deps.sqliteClient,
    `INSERT OR IGNORE INTO agent_messages
      (id, session_id, role, is_summary, order_index, input_tokens, output_tokens,
       cache_read_input_tokens, cache_write_input_tokens, cost_micros, provider_id, model_id,
       created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      message.id,
      message.sessionId,
      message.role,
      message.isSummary ? 1 : 0,
      message.orderIndex,
      message.inputTokens ?? null,
      message.outputTokens ?? null,
      null,
      null,
      message.costMicros ?? null,
      message.providerId ?? null,
      message.modelId ?? null,
      toUnixSec(message.createdAt)
    ]
  )
}

async function insertTargetPart(
  deps: LegacyVersionMigrationImporterDeps,
  part: ReturnType<typeof buildLegacyMessageAggregate>['parts'][number]
): Promise<void> {
  const dataStr = typeof part.data === 'string' ? part.data : JSON.stringify(part.data ?? null)
  await deps.executeRawSql(
    deps.sqliteClient,
    `INSERT OR IGNORE INTO agent_parts
      (id, message_id, session_id, type, data, created_at)
     VALUES (?,?,?,?,?,?)`,
    [part.id, part.messageId, part.sessionId, part.type, dataStr, toUnixSec(part.createdAt)]
  )
}

async function streamLegacySessionFromSource(options: {
  deps: LegacyVersionMigrationImporterDeps
  alias: string
  oldSessionId: string
  newSessionId: string
  sessionRow: Record<string, unknown>
  mappedAssistantId: string
  legacyVaultName: string
}): Promise<void> {
  const {
    deps,
    alias,
    oldSessionId,
    newSessionId,
    sessionRow,
    mappedAssistantId,
    legacyVaultName
  } = options
  if (!deps.getSessionsBaseDirectory) {
    const enrichedMessages = await loadLegacyMessagesForSession(
      deps,
      alias,
      oldSessionId,
      newSessionId
    )
    const targetVaultName = await deps.resolveTargetVaultName(legacyVaultName)
    await deps.upsertSessionAggregate({
      session: buildLegacySessionAggregate(
        sessionRow,
        newSessionId,
        mappedAssistantId,
        targetVaultName
      ),
      messages: enrichedMessages
    })
    await deps.sessionManager.flushSessionToDisk(newSessionId)
    return
  }

  const targetVaultName = await deps.resolveTargetVaultName(legacyVaultName)
  const session = buildLegacySessionAggregate(
    sessionRow,
    newSessionId,
    mappedAssistantId,
    targetVaultName
  )
  await replaceTargetSessionRows(deps, session)

  const sessionsDir = await deps.getSessionsBaseDirectory(targetVaultName)
  await deps.fileSystem.mkdir(sessionsDir, { recursive: true })
  const sessionPath = path.join(sessionsDir, `${newSessionId}.json`)
  const tempPath = `${sessionPath}.tmp`
  const messageOrderBy = await resolveLegacyOrderBy(deps, alias, 'agent_messages')
  const partOrderBy = await resolveLegacyOrderBy(deps, alias, 'agent_parts')

  try {
    await deps.fileSystem.writeFile(
      tempPath,
      `{"session":${JSON.stringify(session)},"messages":[`,
      'utf8'
    )
    let wroteMessage = false
    let offset = 0
    let index = 0

    while (true) {
      const messageRows = (
        await deps.executeRawSql(
          deps.sqliteClient,
          `SELECT * FROM ${alias}.agent_messages
           WHERE session_id = ?
           ORDER BY ${messageOrderBy}
           LIMIT ? OFFSET ?`,
          [oldSessionId, LEGACY_IMPORT_MESSAGE_PAGE_SIZE, offset]
        )
      ).rows as Record<string, unknown>[]

      if (messageRows.length === 0) break

      for (const messageRow of messageRows) {
        const oldMessageId = String(messageRow.id ?? '')
        const parts = oldMessageId
          ? await loadLegacyPartsForMessage(deps, alias, oldMessageId, partOrderBy)
          : []
        const message = buildLegacyMessageAggregate(messageRow, parts, newSessionId, index)
        await insertTargetMessage(deps, message)
        for (const part of message.parts) {
          await insertTargetPart(deps, part)
        }
        const prefix = wroteMessage ? ',' : ''
        await deps.fileSystem.appendFile(tempPath, `${prefix}${JSON.stringify(message)}`, 'utf8')
        wroteMessage = true
        index += 1
      }

      if (messageRows.length < LEGACY_IMPORT_MESSAGE_PAGE_SIZE) break
      offset += LEGACY_IMPORT_MESSAGE_PAGE_SIZE
    }

    await deps.fileSystem.appendFile(tempPath, ']}', 'utf8')
    if (await deps.fileSystem.exists(sessionPath)) {
      await deps.fileSystem.unlink(sessionPath)
    }
    await deps.fileSystem.rename(tempPath, sessionPath)
  } catch (error) {
    try {
      if (await deps.fileSystem.exists(tempPath)) {
        await deps.fileSystem.unlink(tempPath)
      }
    } catch {
      // ignore cleanup errors
    }
    throw error
  }
}

export async function importLegacyChatsFromRows(
  deps: LegacyVersionMigrationImporterDeps,
  rows: Pick<LegacyAgentRows, 'sessions' | 'messages' | 'parts' | 'errors'>,
  assistantIdMap: Record<string, string>,
  legacyVaultName: string
): Promise<LegacyVersionMigrationImportResult> {
  const { sessionManager, onProgress, upsertSessionAggregate } = deps
  const existingSessionIds = await deps.existingSessionIds()
  const { sessions, messages, parts, errors } = rows

  let imported = 0
  let skipped = 0
  let failed = 0
  const warnings: string[] = []
  const failureSamples: string[] = []

  const messagesBySession = new Map<string, Record<string, unknown>[]>()
  for (const message of messages) {
    const sessionId = String(message.session_id ?? '')
    if (!sessionId) continue
    const list = messagesBySession.get(sessionId) ?? []
    list.push(message)
    messagesBySession.set(sessionId, list)
  }

  const partsByMessage = new Map<string, Record<string, unknown>[]>()
  for (const part of parts) {
    const messageId = String(part.message_id ?? '')
    if (!messageId) continue
    const list = partsByMessage.get(messageId) ?? []
    list.push(part)
    partsByMessage.set(messageId, list)
  }

  const fallbackAssistantId = Object.values(assistantIdMap)[0]

  for (const sessionRow of sessions) {
    const oldSessionId = String(sessionRow.id ?? '')
    if (!oldSessionId) continue
    onProgress?.(String(sessionRow.title ?? oldSessionId))

    const rawAssistantId =
      sessionRow.assistant_id != null && String(sessionRow.assistant_id).trim() !== ''
        ? String(sessionRow.assistant_id)
        : null
    const mappedAssistantId = rawAssistantId ? assistantIdMap[rawAssistantId] : fallbackAssistantId
    if (!mappedAssistantId) {
      skipped += 1
      if (!warnings.includes('version_migration.import_chat_missing_assistant')) {
        warnings.push('version_migration.import_chat_missing_assistant')
      }
      continue
    }

    const newSessionId = existingSessionIds.has(oldSessionId)
      ? generateRemappedId('legacy_sess')
      : oldSessionId

    const enrichedMessages = (messagesBySession.get(oldSessionId) ?? [])
      .sort((a, b) => Number(a.order_index ?? 0) - Number(b.order_index ?? 0))
      .map((messageRow, index) =>
        buildLegacyMessageAggregate(
          messageRow,
          partsByMessage.get(String(messageRow.id ?? '')) ?? [],
          newSessionId,
          index
        )
      )

    try {
      const targetVaultName = await deps.resolveTargetVaultName(legacyVaultName)
      await upsertSessionAggregate({
        session: {
          id: newSessionId,
          title: sessionRow.title != null ? String(sessionRow.title) : null,
          vaultName: targetVaultName,
          assistantId: mappedAssistantId,
          isPinned: Number(sessionRow.is_pinned) === 1,
          systemPrompt:
            sessionRow.system_prompt != null ? String(sessionRow.system_prompt) : undefined,
          providerId: sessionRow.provider_id != null ? String(sessionRow.provider_id) : '',
          modelId: sessionRow.model_id != null ? String(sessionRow.model_id) : '',
          totalInputTokens:
            sessionRow.total_input_tokens != null ? Number(sessionRow.total_input_tokens) : 0,
          totalOutputTokens:
            sessionRow.total_output_tokens != null ? Number(sessionRow.total_output_tokens) : 0,
          totalCostMicros:
            sessionRow.total_cost_micros != null ? Number(sessionRow.total_cost_micros) : 0,
          createdAt: toDate(sessionRow.created_at),
          updatedAt: toDate(sessionRow.updated_at)
        },
        messages: enrichedMessages
      })
      await sessionManager.flushSessionToDisk(newSessionId)
      imported += 1
    } catch (error) {
      failed += 1
      if (failureSamples.length < 12) {
        const title = String(sessionRow.title ?? oldSessionId)
        const message = error instanceof Error ? error.message : String(error)
        failureSamples.push(`会话 ${title}: ${message}`)
      }
    }
  }

  if (errors.length > 0) {
    warnings.push('version_migration.warning_agent_db_read_partial')
  }

  return {
    sectionId: workspaceSectionId(legacyVaultName),
    imported,
    skipped,
    failed,
    warnings,
    errors: errors.length > 0 ? errors : undefined,
    failureSamples: failureSamples.length > 0 ? failureSamples : undefined
  }
}

type LegacyChatImportCandidate = {
  sessionRow: Record<string, unknown>
  oldSessionId: string
  newSessionId: string
  mappedAssistantId: string
  attachPath: string
}

async function importLegacyChatsFromSources(
  deps: LegacyVersionMigrationImporterDeps,
  rows: Pick<LegacyAgentRows, 'sessions' | 'errors' | 'sessionSources'>,
  assistantIdMap: Record<string, string>,
  legacyVaultName: string
): Promise<LegacyVersionMigrationImportResult> {
  const { onProgress } = deps
  const existingSessionIds = await deps.existingSessionIds()
  const { sessions, errors } = rows

  let imported = 0
  let skipped = 0
  let failed = 0
  const warnings: string[] = []
  const failureSamples: string[] = []
  const fallbackAssistantId = Object.values(assistantIdMap)[0]
  const sessionsByAttachPath = new Map<string, LegacyChatImportCandidate[]>()
  let attachGroupIndex = 0

  for (const sessionRow of sessions) {
    const oldSessionId = String(sessionRow.id ?? '')
    if (!oldSessionId) continue

    const rawAssistantId =
      sessionRow.assistant_id != null && String(sessionRow.assistant_id).trim() !== ''
        ? String(sessionRow.assistant_id)
        : null
    const mappedAssistantId = rawAssistantId ? assistantIdMap[rawAssistantId] : fallbackAssistantId
    if (!mappedAssistantId) {
      skipped += 1
      if (!warnings.includes('version_migration.import_chat_missing_assistant')) {
        warnings.push('version_migration.import_chat_missing_assistant')
      }
      continue
    }

    const newSessionId = existingSessionIds.has(oldSessionId)
      ? generateRemappedId('legacy_sess')
      : oldSessionId
    const source = rows.sessionSources?.get(oldSessionId)
    if (!source) {
      skipped += 1
      if (!warnings.includes('version_migration.warning_agent_db_read_partial')) {
        warnings.push('version_migration.warning_agent_db_read_partial')
      }
      continue
    }

    const group = sessionsByAttachPath.get(source.attachPath) ?? []
    group.push({
      sessionRow,
      oldSessionId,
      newSessionId,
      mappedAssistantId,
      attachPath: source.attachPath
    })
    sessionsByAttachPath.set(source.attachPath, group)
  }

  for (const [attachPath, candidates] of sessionsByAttachPath) {
    attachGroupIndex += 1
    const alias = `legacy_chat_${attachGroupIndex}_${hashString(attachPath)}`
    let attached = false
    try {
      await deps.executeRawSql(
        deps.sqliteClient,
        `ATTACH DATABASE ${quoteSqlString(attachPath)} AS ${alias}`
      )
      attached = true

      for (const candidate of candidates) {
        const { sessionRow, oldSessionId, newSessionId, mappedAssistantId } = candidate
        onProgress?.(String(sessionRow.title ?? oldSessionId))
        try {
          await streamLegacySessionFromSource({
            deps,
            alias,
            oldSessionId,
            newSessionId,
            sessionRow,
            mappedAssistantId,
            legacyVaultName
          })
          imported += 1
        } catch (error) {
          failed += 1
          if (failureSamples.length < 12) {
            const title = String(sessionRow.title ?? oldSessionId)
            const message = error instanceof Error ? error.message : String(error)
            failureSamples.push(`会话 ${title}: ${message}`)
          }
        }
      }
    } catch (error) {
      failed += 1
      const message = error instanceof Error ? error.message : String(error)
      if (failureSamples.length < 12) {
        failureSamples.push(
          `无法连接旧版会话数据库（影响 ${candidates.length} 个会话）: ${message}`
        )
      }
    } finally {
      if (attached) {
        await deps
          .executeRawSql(deps.sqliteClient, `DETACH DATABASE ${alias}`)
          .catch(() => undefined)
      }
    }
  }

  if (errors.length > 0) {
    warnings.push('version_migration.warning_agent_db_read_partial')
  }

  return {
    sectionId: workspaceSectionId(legacyVaultName),
    imported,
    skipped,
    failed,
    warnings,
    errors: errors.length > 0 ? errors : undefined,
    failureSamples: failureSamples.length > 0 ? failureSamples : undefined
  }
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
