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
  type RawSqlExecutor
} from './legacy-migration.shared'
import { restoreLegacyDevicePreferences } from '../import/legacy-config-restore.shared'
import {
  buildJournalFilePathFromDateStr,
  importLegacyJournalToDisk,
  legacyJournalAlreadyMigrated
} from './legacy-journal-migration.util'
import { countArchiveMarkdownUnderArchivesDir } from '../vault/archive-files.util'
import {
  importLegacySqlSummariesForVault,
  countLegacyArchiveSourcesForVault
} from './legacy-summary-migration.util'
import {
  mergeAvatarMaps,
  restoreLegacyAvatarsFromArchiveLayout,
  restoreLegacyAvatarsFromDocumentsDir,
  restoreLegacyUserAvatar,
  resolveLegacyAvatarPathInMap,
  type LegacyAvatarImporter
} from './legacy-avatar-migration.shared'
import {
  generateRemappedId,
  isWorkspaceSectionId,
  legacySessionBelongsToVault,
  normalizeLegacyPartType,
  parseLegacyPersonasFromSp,
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
  /** 将旧版 db 路径转为当前平台可 ATTACH 的路径 */
  prepareSqliteAttachPath?: (dbPath: string) => Promise<string>
}

interface LegacyAgentRows {
  assistants: Record<string, unknown>[]
  sessions: Record<string, unknown>[]
  messages: Record<string, unknown>[]
  parts: Record<string, unknown>[]
  errors: string[]
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

async function resolveLegacyAgentDbPathsForVault(
  fileSystem: IFileSystem,
  sourceRoot: string,
  legacyVaultName: string
): Promise<string[]> {
  const vaultDb = path.join(sourceRoot, legacyVaultName, '.baishou', 'agent.sqlite')
  if (await fileSystem.exists(vaultDb)) {
    return [vaultDb]
  }
  const rootDb = path.join(sourceRoot, '.baishou', 'agent.sqlite')
  if (await fileSystem.exists(rootDb)) {
    return [rootDb]
  }
  const { agentDbs } = await scanLegacyDatabases(fileSystem, sourceRoot)
  return agentDbs
}

function isVaultSpecificAgentDb(dbPath: string, legacyVaultName: string): boolean {
  const normalized = dbPath.replace(/\\/g, '/')
  return normalized.includes(`/${legacyVaultName}/.baishou/agent.sqlite`)
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
  const seenMessageIds = new Set<string>()
  const seenPartIds = new Set<string>()

  for (let i = 0; i < uniquePaths.length; i++) {
    const alias = `legacy_import_${i}`
    const rawAttachPath = uniquePaths[i]!
    const attachPath = deps.prepareSqliteAttachPath
      ? await deps.prepareSqliteAttachPath(rawAttachPath)
      : rawAttachPath
    const vaultSpecific = legacyVaultName
      ? isVaultSpecificAgentDb(rawAttachPath, legacyVaultName)
      : false
    try {
      await executeRawSql(sqliteClient, `ATTACH DATABASE '${attachPath}' AS ${alias}`)

      const assistantRows = (
        await executeRawSql(sqliteClient, `SELECT * FROM ${alias}.agent_assistants`)
      ).rows
      const sessionRows = (
        await executeRawSql(sqliteClient, `SELECT * FROM ${alias}.agent_sessions`)
      ).rows

      const filteredSessions =
        legacyVaultName && !vaultSpecific
          ? sessionRows.filter((row) =>
              legacySessionBelongsToVault(row.vault_name, legacyVaultName)
            )
          : sessionRows

      const sessionAssistantIds = new Set<string>()
      for (const row of filteredSessions) {
        const sid = String(row.id ?? '')
        if (!sid || seenSessionIds.has(sid)) continue
        seenSessionIds.add(sid)
        sessions.push(row)
        if (row.assistant_id != null) {
          sessionAssistantIds.add(String(row.assistant_id))
        }
      }

      for (const row of assistantRows) {
        const aid = String(row.id ?? '')
        if (!aid || seenAssistantIds.has(aid)) continue
        seenAssistantIds.add(aid)
        assistants.push(row)
      }

      if (sessions.length > 0) {
        const idList = [...seenSessionIds].map((id) => `'${id.replace(/'/g, "''")}'`).join(',')
        for (const row of (
          await executeRawSql(
            sqliteClient,
            `SELECT * FROM ${alias}.agent_messages WHERE session_id IN (${idList})`
          )
        ).rows) {
          const mid = String(row.id ?? '')
          if (!mid || seenMessageIds.has(mid)) continue
          seenMessageIds.add(mid)
          messages.push(row)
        }
        for (const row of (
          await executeRawSql(
            sqliteClient,
            `SELECT * FROM ${alias}.agent_parts WHERE message_id IN (SELECT id FROM ${alias}.agent_messages WHERE session_id IN (${idList}))`
          )
        ).rows) {
          const pid = String(row.id ?? '')
          if (!pid || seenPartIds.has(pid)) continue
          seenPartIds.add(pid)
          parts.push(row)
        }
      }

      await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
    } catch (error) {
      errors.push(
        error instanceof Error
          ? error.message
          : `Failed to attach legacy database at ${attachPath}`
      )
      try {
        await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
      } catch {
        // ignore
      }
    }
  }

  return { assistants, sessions, messages, parts, errors }
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
  const sp = deps.flutterRawSp ?? deps.flutterPrefsConfig
  const { profileRepo } = deps
  if (!sp) {
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
  const legacyPersonas = parseLegacyPersonasFromSp(sp)

  if (legacyPersonas.length === 0) {
    const identityFacts = sp['identity_facts'] ?? deps.flutterPrefsConfig?.['identity_facts']
    if (identityFacts && typeof identityFacts === 'object') {
      const activeId = profile.activePersonaId
      const active = personasMap[activeId] ?? { id: activeId, facts: {} }
      personasMap[activeId] = {
        ...active,
        facts: { ...active.facts, ...(identityFacts as Record<string, string>) }
      }
      imported = 1
    } else {
      skipped = 1
    }
  } else {
    for (const legacy of legacyPersonas) {
      const allIds = new Set([...Object.keys(personasMap), ...existingIds])
      const newId = resolveUniqueNameWithTwoDigitSuffix(legacy.id, allIds)
      if (newId === legacy.id && personasMap[legacy.id]) {
        skipped += 1
        continue
      }
      personasMap[newId] = { id: newId, facts: { ...legacy.facts } }
      existingIds.add(newId)
      imported += 1
    }
  }

  await profileRepo.saveProfile({ ...profile, personas: personasMap } satisfies UserProfile)
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
    preserveCloudSync: localCloudSync != null
  })

  if (flushSettingsToDisk) {
    await flushSettingsToDisk()
  }
  return { sectionId: 'config', imported: 1, skipped: 0, failed: 0, warnings: [] }
}

export async function importLegacyDiariesForVault(
  deps: LegacyVersionMigrationImporterDeps,
  legacyVaultName: string
): Promise<Pick<LegacyVersionMigrationImportResult, 'imported' | 'skipped' | 'failed' | 'failureSamples'>> {
  const { fileSystem, sourceRoot, diaryService, onProgress, runInVaultContext, readTargetJournalRaw } =
    deps
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
      : path.join(
          deps.targetRoot,
          targetVaultName,
          'Journals'
        )

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

  return { imported, skipped, failed, failureSamples: failureSamples.length > 0 ? failureSamples : undefined }
}

export async function importLegacyArchivesForVault(
  deps: LegacyVersionMigrationImporterDeps,
  legacyVaultName: string
): Promise<Pick<LegacyVersionMigrationImportResult, 'imported' | 'skipped' | 'failed' | 'failureSamples'>> {
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

    const uniqueName = resolveUniqueNameWithTwoDigitSuffix(String(row.name ?? '伙伴'), existingNames)
    existingNames.add(uniqueName)
    const newId = generateRemappedId('legacy_ast')
    assistantIdMap[oldId] = newId

    try {
      await assistantManager.create(
        buildLegacyAssistantInput(row, newId, uniqueName, avatarMap)
      )
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

  for (const sessionRow of sessions) {
    const oldSessionId = String(sessionRow.id ?? '')
    if (!oldSessionId) continue
    onProgress?.(String(sessionRow.title ?? oldSessionId))

    const mappedAssistantId = assistantIdMap[String(sessionRow.assistant_id ?? '')]
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
      .map((messageRow, index) => {
        const oldMessageId = String(messageRow.id ?? generateRemappedId('legacy_msg'))
        const newMessageId = generateRemappedId('legacy_msg')
        return {
          id: newMessageId,
          sessionId: newSessionId,
          role: String(messageRow.role ?? 'user'),
          isSummary: Number(messageRow.is_summary) === 1,
          orderIndex: messageRow.order_index != null ? Number(messageRow.order_index) : index,
          inputTokens: messageRow.input_tokens != null ? Number(messageRow.input_tokens) : undefined,
          outputTokens:
            messageRow.output_tokens != null ? Number(messageRow.output_tokens) : undefined,
          costMicros: messageRow.cost_micros != null ? Number(messageRow.cost_micros) : undefined,
          providerId: messageRow.provider_id != null ? String(messageRow.provider_id) : undefined,
          modelId: messageRow.model_id != null ? String(messageRow.model_id) : undefined,
          createdAt: toDate(messageRow.created_at),
          parts: (partsByMessage.get(oldMessageId) ?? []).map((partRow) => {
            let data: unknown = partRow.data
            if (typeof data === 'string') {
              try {
                data = JSON.parse(data)
              } catch {
                // keep raw
              }
            }
            return {
              id: generateRemappedId('legacy_part'),
              messageId: newMessageId,
              sessionId: newSessionId,
              type: normalizeLegacyPartType(partRow.type),
              data,
              createdAt: toDate(partRow.created_at)
            }
          })
        }
      })

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

  const targetName = await ensureTargetVaultExists(deps, legacyVaultName)
  const vaultNameMap = { [legacyVaultName]: targetName }

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

  const diaryResult = await importLegacyDiariesForVault(deps, legacyVaultName)
  imported += diaryResult.imported
  skipped += diaryResult.skipped
  failed += diaryResult.failed
  if (diaryResult.failureSamples) failureSamples.push(...diaryResult.failureSamples)
  if (diaryResult.failed > 0) {
    warnings.push('version_migration.import_partial_failed')
  }

  const archivesResult = await importLegacyArchivesForVault(deps, legacyVaultName)
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
    resolveTargetVaultName: deps.resolveTargetVaultName,
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

  await deps.runInVaultContext(legacyVaultName, async () => {
    const assistantResult = await importLegacyAssistantsFromRows(deps, agentRows.assistants, {
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

    const chatResult = await importLegacyChatsFromRows(
      deps,
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
