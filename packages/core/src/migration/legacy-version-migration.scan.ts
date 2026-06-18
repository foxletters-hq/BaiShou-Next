import type { IFileSystem } from '../fs/file-system.types'
import * as path from '../fs/path.util'
import { countJournalMarkdownInTree } from '../journal/journal-files.util'
import { countArchiveMarkdownUnderArchivesDir } from '../vault/archive-files.util'
import { countLegacyArchiveSourcesForVault } from './legacy-summary-migration.util'
import {
  discoverVaultNames,
  normalizeSqliteAttachPath,
  scanLegacyDatabases,
  type RawSqlExecutor
} from './legacy-migration.shared'
import {
  formatMigrationMegabytes,
  legacySessionBelongsToVault,
  parseLegacyIdentityFacts,
  parseLegacyPersonasFromSp,
  resolveLegacyIdentityPersonas,
  workspaceSectionId,
  type LegacyVersionMigrationScanResult,
  type LegacyVersionMigrationSectionPreview,
  type LegacyVersionMigrationWorkspacePreview
} from './legacy-version-migration.util'
import { isFlutterLegacyUserAvatarFileName } from './legacy-avatar-migration.shared'
import {
  assembleDevicePreferencesFromFlutterSp,
  hasMeaningfulFlutterPreferences
} from './flutter-shared-prefs.util'

const GLOBAL_SECTION_TITLE_KEYS: Record<'avatar' | 'personas' | 'config', string> = {
  avatar: 'version_migration.section_avatar',
  personas: 'version_migration.section_personas',
  config: 'version_migration.section_config'
}

function deriveConfigFromSpForScan(
  sp: Record<string, unknown> | null
): Record<string, unknown> | null {
  if (!sp) return null
  const assembled = assembleDevicePreferencesFromFlutterSp(sp)
  return hasMeaningfulFlutterPreferences(assembled) ? assembled : null
}

export interface ScanLegacyVersionMigrationDeps {
  fileSystem: IFileSystem
  sourceRoot: string
  sourceDisplayPath: string
  flutterPrefsConfig: Record<string, unknown> | null
  /** Flutter SP 原始键值（身份卡 user_personas） */
  flutterRawSp?: Record<string, unknown> | null
  flutterDocumentsAvatarsDir: string | null
  sqliteClient?: unknown
  executeRawSql?: RawSqlExecutor
  /** 将旧版 db 路径转为当前平台可 ATTACH 的路径（如复制到应用沙盒） */
  prepareSqliteAttachPath?: (dbPath: string) => Promise<string>
}

async function sumTreeBytes(fileSystem: IFileSystem, dir: string): Promise<number> {
  if (!(await fileSystem.exists(dir))) return 0

  let total = 0
  let entries: string[] = []
  try {
    entries = await fileSystem.readdir(dir)
  } catch {
    return 0
  }

  for (const name of entries) {
    const fullPath = path.join(dir, name)
    let stat
    try {
      stat = await fileSystem.stat(fullPath)
    } catch {
      continue
    }
    if (stat.isDirectory) {
      total += await sumTreeBytes(fileSystem, fullPath)
    } else {
      total += stat.size ?? 0
    }
  }

  return total
}

async function fileSizeIfExists(fileSystem: IFileSystem, filePath: string): Promise<number> {
  if (!(await fileSystem.exists(filePath))) return 0
  try {
    const stat = await fileSystem.stat(filePath)
    return stat.isFile ? (stat.size ?? 0) : 0
  } catch {
    return 0
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

interface LegacyAgentDbStats {
  assistants: number
  sessions: number
  messages: number
  bytes: number
  previewAssistants: Array<{ label: string; detail?: string }>
  previewSessions: Array<{ label: string; detail?: string }>
  attachErrors: string[]
}

async function readLegacyAgentDbStatsForVault(
  deps: ScanLegacyVersionMigrationDeps,
  legacyVaultName: string
): Promise<LegacyAgentDbStats> {
  const agentDbPaths = await resolveLegacyAgentDbPathsForVault(
    deps.fileSystem,
    deps.sourceRoot,
    legacyVaultName
  )
  const uniquePaths = [...new Set(agentDbPaths.map((p) => normalizeSqliteAttachPath(p)))]
  let assistants = 0
  let sessions = 0
  let messages = 0
  let bytes = 0
  const previewAssistants: Array<{ label: string; detail?: string }> = []
  const previewSessions: Array<{ label: string; detail?: string }> = []
  const attachErrors: string[] = []

  for (const dbPath of uniquePaths) {
    bytes += await fileSizeIfExists(deps.fileSystem, dbPath)
  }

  if (!deps.sqliteClient || !deps.executeRawSql || uniquePaths.length === 0) {
    return { assistants, sessions, messages, bytes, previewAssistants, previewSessions, attachErrors }
  }

  const { sqliteClient, executeRawSql } = deps
  const allAssistantIds = new Set<string>()
  const allSessionIds = new Set<string>()

  for (let i = 0; i < uniquePaths.length; i++) {
    const alias = `legacy_scan_${i}`
    const rawAttachPath = uniquePaths[i]!
    const vaultSpecific = isVaultSpecificAgentDb(rawAttachPath, legacyVaultName)
    try {
      const attachPath = deps.prepareSqliteAttachPath
        ? await deps.prepareSqliteAttachPath(rawAttachPath)
        : rawAttachPath
      console.info('[VersionMigration][scan-agent-db] attach', {
        legacyVaultName,
        rawAttachPath,
        attachPath,
        vaultSpecific
      })
      await executeRawSql(sqliteClient, `ATTACH DATABASE '${attachPath}' AS ${alias}`)

      const assistantRows = (
        await executeRawSql(sqliteClient, `SELECT id, name FROM ${alias}.agent_assistants`)
      ).rows
      const sessionRows = (
        await executeRawSql(
          sqliteClient,
          `SELECT id, title, vault_name, assistant_id FROM ${alias}.agent_sessions`
        )
      ).rows

      const filteredSessions = vaultSpecific
        ? sessionRows
        : sessionRows.filter((row) =>
            legacySessionBelongsToVault(row.vault_name, legacyVaultName)
          )
      console.info('[VersionMigration][scan-agent-db] rows', {
        legacyVaultName,
        rawAttachPath,
        assistantRows: assistantRows.length,
        sessionRows: sessionRows.length,
        filteredSessions: filteredSessions.length
      })

      const sessionAssistantIds = new Set<string>()
      for (const row of filteredSessions) {
        const sid = String(row.id ?? '')
        if (!sid || allSessionIds.has(sid)) continue
        allSessionIds.add(sid)
        if (previewSessions.length < 4) {
          previewSessions.push({
            label: String(row.title ?? sid),
            detail: row.assistant_id != null ? String(row.assistant_id) : undefined
          })
        }
        if (row.assistant_id != null) {
          sessionAssistantIds.add(String(row.assistant_id))
        }
      }

      for (const row of assistantRows) {
        const aid = String(row.id ?? '')
        if (!aid || allAssistantIds.has(aid)) continue
        if (
          !vaultSpecific &&
          sessionAssistantIds.size > 0 &&
          !sessionAssistantIds.has(aid)
        ) {
          continue
        }
        allAssistantIds.add(aid)
        if (previewAssistants.length < 4) {
          previewAssistants.push({
            label: String(row.name ?? '—'),
            detail: aid
          })
        }
      }

      if (allSessionIds.size > 0) {
        const idList = [...allSessionIds].map((id) => `'${id.replace(/'/g, "''")}'`).join(',')
        const messageCount = await executeRawSql(
          sqliteClient,
          `SELECT COUNT(*) AS c FROM ${alias}.agent_messages WHERE session_id IN (${idList})`
        )
        messages = Number(messageCount.rows[0]?.c ?? 0)
      }

      await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn('[VersionMigration][scan-agent-db] failed', {
        legacyVaultName,
        rawAttachPath,
        alias,
        error: message
      })
      attachErrors.push(message)
      try {
        await executeRawSql(sqliteClient, `DETACH DATABASE ${alias}`)
      } catch {
        // ignore
      }
    }
  }

  assistants = allAssistantIds.size
  sessions = allSessionIds.size

  return { assistants, sessions, messages, bytes, previewAssistants, previewSessions, attachErrors }
}

async function collectArchiveStatsForVault(
  fileSystem: IFileSystem,
  sourceRoot: string,
  legacyVaultName: string,
  deps?: Pick<ScanLegacyVersionMigrationDeps, 'sqliteClient' | 'executeRawSql' | 'prepareSqliteAttachPath'>
): Promise<{ count: number; bytes: number; sqlOnlyCount: number }> {
  const archivesDir = path.join(sourceRoot, legacyVaultName, 'Archives')
  const fileCount = await countArchiveMarkdownUnderArchivesDir(fileSystem, archivesDir)
  const bytes = await sumTreeBytes(fileSystem, archivesDir)
  let sqlOnlyCount = 0
  if (deps?.sqliteClient && deps.executeRawSql) {
    const sources = await countLegacyArchiveSourcesForVault(
      fileSystem,
      sourceRoot,
      legacyVaultName,
      deps.sqliteClient,
      deps.executeRawSql,
      deps.prepareSqliteAttachPath
    )
    sqlOnlyCount = Math.max(0, sources.sqlCount - sources.fileCount)
  }
  return { count: fileCount + sqlOnlyCount, bytes, sqlOnlyCount }
}

async function collectJournalStatsForVault(
  fileSystem: IFileSystem,
  sourceRoot: string,
  legacyVaultName: string
): Promise<{ count: number; bytes: number }> {
  const journalsDir = path.join(sourceRoot, legacyVaultName, 'Journals')
  const count = await countJournalMarkdownInTree(fileSystem, journalsDir)
  const bytes = await sumTreeBytes(fileSystem, journalsDir)
  return { count, bytes }
}

function buildGlobalSection(
  sectionId: 'avatar' | 'personas' | 'config',
  partial: Omit<LegacyVersionMigrationSectionPreview, 'sectionId' | 'titleKey'>
): LegacyVersionMigrationSectionPreview {
  return {
    sectionId,
    titleKey: GLOBAL_SECTION_TITLE_KEYS[sectionId],
    ...partial
  }
}

/**
 * 扫描旧版白守根目录：全局板块 + 按工作空间汇总。
 */
export async function scanLegacyVersionMigration(
  deps: ScanLegacyVersionMigrationDeps
): Promise<LegacyVersionMigrationScanResult> {
  const { fileSystem, sourceRoot, sourceDisplayPath, flutterPrefsConfig, flutterRawSp, flutterDocumentsAvatarsDir } =
    deps

  const effectivePrefsConfig =
    flutterPrefsConfig ??
  deriveConfigFromSpForScan(flutterRawSp ?? null)

  const vaultNames = await discoverVaultNames(fileSystem, sourceRoot)

  const avatarPathFromPrefs =
    typeof deps.flutterRawSp?.['user_avatar_path'] === 'string'
      ? (deps.flutterRawSp['user_avatar_path'] as string)
      : typeof effectivePrefsConfig?.['user_avatar_path'] === 'string'
        ? (effectivePrefsConfig['user_avatar_path'] as string)
        : null
  const avatarFileBytes = avatarPathFromPrefs
    ? await fileSizeIfExists(fileSystem, avatarPathFromPrefs)
    : 0
  let flutterUserAvatarBytes = 0
  if (flutterDocumentsAvatarsDir && (await fileSystem.exists(flutterDocumentsAvatarsDir))) {
    try {
      const entries = await fileSystem.readdir(flutterDocumentsAvatarsDir)
      for (const name of entries) {
        if (!isFlutterLegacyUserAvatarFileName(name)) continue
        flutterUserAvatarBytes += await fileSizeIfExists(
          fileSystem,
          path.join(flutterDocumentsAvatarsDir, name)
        )
      }
    } catch {
      // ignore
    }
  }
  const avatarDirBytes = flutterUserAvatarBytes
  const avatarConfigBytes = await fileSizeIfExists(
    fileSystem,
    path.join(sourceRoot, 'config', 'avatar.jpg')
  )
  const avatarAvailable =
    avatarFileBytes > 0 || avatarDirBytes > 0 || avatarConfigBytes > 0

  const personas = resolveLegacyIdentityPersonas(flutterRawSp ?? null, effectivePrefsConfig ?? null)
  const personasFromSp = flutterRawSp ? parseLegacyPersonasFromSp(flutterRawSp) : []
  const personasFromConfig = effectivePrefsConfig
    ? parseLegacyPersonasFromSp(effectivePrefsConfig)
    : []
  const configIdentityFacts = parseLegacyIdentityFacts(effectivePrefsConfig?.['identity_facts'])
  const identityFactsOnly =
    personas.length > 0 &&
    personasFromSp.length === 0 &&
    personasFromConfig.length === 0 &&
    !!configIdentityFacts

  const configDirBytes = await sumTreeBytes(fileSystem, path.join(sourceRoot, 'config'))

  const globalSections: LegacyVersionMigrationSectionPreview[] = [
    buildGlobalSection('avatar', {
      bytes: avatarFileBytes + avatarDirBytes + avatarConfigBytes,
      count: avatarAvailable ? 1 : 0,
      available: avatarAvailable,
      warnings: []
    }),
    buildGlobalSection('personas', {
      bytes: 0,
      count: personas.length,
      available: personas.length > 0,
      warnings: identityFactsOnly ? ['version_migration.warning_personas_partial'] : [],
      previewItems: personas.slice(0, 8).map((p) => ({
        label: p.id,
        detail: String(Object.keys(p.facts).length)
      }))
    }),
    buildGlobalSection('config', {
      bytes: configDirBytes,
      count: effectivePrefsConfig ? 1 : 0,
      available: !!effectivePrefsConfig,
      warnings: [],
      previewItems: effectivePrefsConfig
        ? [
            { label: 'version_migration.config_preview_providers', detail: undefined },
            { label: 'version_migration.config_preview_models', detail: undefined },
            { label: 'version_migration.config_preview_theme', detail: undefined },
            { label: 'version_migration.config_preview_agent', detail: undefined },
            { label: 'version_migration.config_preview_rag', detail: undefined },
            { label: 'version_migration.config_preview_tools', detail: undefined }
          ]
        : []
    })
  ]

  const workspaces: LegacyVersionMigrationWorkspacePreview[] = []
  for (const legacyVaultName of vaultNames) {
    const journalStats = await collectJournalStatsForVault(fileSystem, sourceRoot, legacyVaultName)
    const archiveStats = await collectArchiveStatsForVault(fileSystem, sourceRoot, legacyVaultName, deps)
    const agentStats = await readLegacyAgentDbStatsForVault(deps, legacyVaultName)
    const available =
      journalStats.count > 0 ||
      archiveStats.count > 0 ||
      agentStats.assistants > 0 ||
      agentStats.sessions > 0

    const previewItems: Array<{ label: string; detail?: string }> = []
    for (const item of agentStats.previewAssistants) {
      previewItems.push({ label: item.label, detail: item.detail })
    }
    for (const item of agentStats.previewSessions) {
      if (previewItems.length >= 8) break
      previewItems.push({ label: item.label, detail: item.detail })
    }

    workspaces.push({
      legacyVaultName,
      sectionId: workspaceSectionId(legacyVaultName),
      diaryCount: journalStats.count,
      diaryBytes: journalStats.bytes,
      archiveCount: archiveStats.count,
      archiveBytes: archiveStats.bytes,
      assistantCount: agentStats.assistants,
      sessionCount: agentStats.sessions,
      agentBytes: agentStats.bytes,
      available,
      warnings: [
        ...(archiveStats.sqlOnlyCount > 0 ? ['version_migration.warning_sql_summaries_only'] : []),
        ...(agentStats.attachErrors.length > 0
          ? ['version_migration.warning_agent_db_read_failed']
          : [])
      ],
      previewItems: previewItems.length > 0 ? previewItems.slice(0, 8) : undefined
    })
  }

  return {
    sourceRoot,
    sourceDisplayPath,
    globalSections,
    workspaces
  }
}

export { formatMigrationMegabytes }
