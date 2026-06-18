import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import {
  SettingsRepository,
  UserProfileRepository
} from '@baishou/database-desktop'
import {
  createNodeFileSystem,
  LegacyImportService
} from '@baishou/core-desktop'
import {
  appendTwoRandomDigits,
  buildLegacyDiaryImportItems,
  collectLegacyDiaryMarkdownEntries,
  countArchiveMarkdownFiles,
  countImportableDiaryEntries,
  countJournalMarkdownFiles,
  diaryManifestKey,
  discoverVaultNames,
  formatMigrationSizeBytes,
  hashDiaryContent,
  isValidDateKey,
  LEGACY_MIGRATION_SECTION_LABELS,
  mapBaishouDbToVaultName,
  mergeDirectoriesSkipExisting,
  personaManifestKey,
  resolveLegacyAvatarCandidates,
  resolveLegacyIdentityPersonas,
  scanLegacyDatabases,
  sumDirectorySizeBytes,
  isLegacyAppRoot,
  type LegacyDiaryMarkdownEntry,
  type LegacyDiarySqliteEntry
} from '@baishou/core/shared'
import type {
  LegacyMigrationImportResult,
  LegacyMigrationImportSectionResult,
  LegacyMigrationImportSelection,
  LegacyMigrationProgressEvent,
  LegacyMigrationScanResult,
  LegacyMigrationSectionId,
  LegacyMigrationSectionPreview,
  LegacySelectiveMigrationManifest
} from '@baishou/shared'
import {
  LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY,
  safeParseDate
} from '@baishou/shared'
import { DesktopAttachmentManagerService } from './desktop-attachment-manager.service'
import { DesktopStoragePathService } from './path.service'
import { getAppDb } from '../db'
import { getAgentManagers } from '../ipc/agent-helpers'
import { vaultService } from '../ipc/vault.ipc'
import { getDiaryManagerForVault } from './diary-vault.factory'
import {
  resolveFlutterDocumentsAvatarsDir,
  resolveLegacyPreferencesForMigration,
  resolveLegacyRootCandidates
} from './flutter-legacy-paths.service'

type ProgressFn = (event: LegacyMigrationProgressEvent) => void

interface LegacyAssistantRow {
  id: string
  name: string
  emoji: string | null
  description: string | null
  avatar_path: string | null
  system_prompt: string | null
  is_default: number
  context_window: number
  provider_id: string | null
  model_id: string | null
  compress_token_threshold: number
  compress_keep_turns: number
  sort_order: number
}

interface LegacySessionRow {
  id: string
  title: string
  vault_name: string
  assistant_id: string | null
  is_pinned: number
  system_prompt: string | null
  provider_id: string
  model_id: string
}

interface LegacyMessageRow {
  id: string
  session_id: string
  role: string
  order_index: number
  is_summary: number
  ask_id: string | null
  provider_id: string | null
  model_id: string | null
  input_tokens: number | null
  output_tokens: number | null
  cost_micros: number | null
}

interface LegacyPartRow {
  id: string
  message_id: string
  session_id: string
  type: string
  data: string
}

interface LegacyBaishouDiaryRow {
  dateKey: string
  content: string
  tags?: string
  weather?: string
  mood?: string
  location?: string
  locationDetail?: string
  isFavorite?: boolean
}

const WORKSPACE_COPY_SUBDIRS = ['attachments', 'Archives'] as const

function emptySectionResult(id: LegacyMigrationSectionId): LegacyMigrationImportSectionResult {
  return { id, success: 0, skipped: 0, failed: 0, errors: [] }
}

function readLegacySqlite<T>(dbPath: string, sql: string, param?: string): T[] {
  if (!existsSync(dbPath)) return []
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    if (param !== undefined) {
      return db.prepare(sql).all(param) as T[]
    }
    return db.prepare(sql).all() as T[]
  } finally {
    db.close()
  }
}

function legacyDateToDateKey(value: unknown): string | null {
  if (value == null) return null
  if (typeof value === 'string') {
    const match = value.match(/(\d{4}-\d{2}-\d{2})/)
    return match?.[1] ?? null
  }
  if (typeof value === 'number') {
    const ms = value < 10000000000 ? value * 1000 : value
    const d = new Date(ms)
    if (Number.isNaN(d.getTime())) return null
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  return null
}

function readLegacyBaishouDiaries(dbPath: string): LegacyBaishouDiaryRow[] {
  if (!existsSync(dbPath)) return []
  const db = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='diaries'")
      .get() as { name: string } | undefined
    if (!table) return []

    const columns = db.prepare("PRAGMA table_info('diaries')").all() as Array<{ name: string }>
    const names = new Set(columns.map((c) => c.name))
    if (!names.has('content')) return []

    const dateCol = names.has('date') ? 'date' : names.has('created_at') ? 'created_at' : null
    if (!dateCol) return []

    const selectCols = [dateCol, 'content']
    for (const col of ['tags', 'weather', 'mood', 'location', 'location_detail', 'is_favorite']) {
      if (names.has(col)) selectCols.push(col)
    }

    const rows = db.prepare(`SELECT ${selectCols.join(', ')} FROM diaries`).all() as Record<
      string,
      unknown
    >[]

    const out: LegacyBaishouDiaryRow[] = []
    for (const row of rows) {
      const dateKey = legacyDateToDateKey(row[dateCol])
      const content = String(row.content ?? '').trim()
      if (!dateKey || !content) continue
      out.push({
        dateKey,
        content,
        tags: row.tags != null ? String(row.tags) : undefined,
        weather: row.weather != null ? String(row.weather) : undefined,
        mood: row.mood != null ? String(row.mood) : undefined,
        location: row.location != null ? String(row.location) : undefined,
        locationDetail:
          row.location_detail != null ? String(row.location_detail) : undefined,
        isFavorite: row.is_favorite === 1 || row.is_favorite === true
      })
    }
    return out
  } finally {
    db.close()
  }
}

function resolveUserAvatarCandidates(
  sp: Record<string, unknown> | null,
  sourceDir: string,
  options?: { includeMachineAvatarPaths?: boolean }
): string[] {
  const includeMachinePaths = options?.includeMachineAvatarPaths ?? true
  return [...new Set(
    resolveLegacyAvatarCandidates(sp, sourceDir, {
      includeMachinePaths,
      documentsAvatarsDir: includeMachinePaths ? resolveFlutterDocumentsAvatarsDir() : undefined
    })
  )].filter((p) => existsSync(p))
}

function normalizeImportSelection(
  selection: LegacyMigrationImportSelection
): LegacyMigrationImportSelection {
  const normalized: LegacyMigrationImportSelection = { ...selection }
  if (normalized.chatMessages && !normalized.assistants) {
    normalized.assistants = true
  }
  return normalized
}

function validateImportSelection(selection: unknown): LegacyMigrationImportSelection {
  if (!selection || typeof selection !== 'object') {
    throw new Error('无效的导入选项')
  }
  const src = selection as Record<string, unknown>
  const keys: Array<keyof LegacyMigrationImportSelection> = [
    'avatar',
    'identityCards',
    'config',
    'diaries',
    'assistants',
    'chatMessages',
    'workspaces'
  ]
  const out: LegacyMigrationImportSelection = {}
  for (const key of keys) {
    if (src[key] === true) out[key] = true
  }
  if (!Object.values(out).some(Boolean)) {
    throw new Error('请至少选择一个导入板块')
  }
  return normalizeImportSelection(out)
}

export class LegacySelectiveMigrationService {
  private readonly fileSystem = createNodeFileSystem()
  private cancelled = false

  cancel(): void {
    this.cancelled = true
  }

  private wasCancelled(): boolean {
    return this.cancelled
  }

  async scan(sourceDir?: string, onProgress?: ProgressFn): Promise<LegacyMigrationScanResult> {
    this.cancelled = false
    onProgress?.({ phase: 'scan', message: '正在检测旧版数据…' })

    const candidates = await resolveLegacyRootCandidates()
    const resolvedSource = sourceDir?.trim() || candidates[0] || ''
    if (!resolvedSource || !(await isLegacyAppRoot(this.fileSystem, resolvedSource))) {
      return {
        sourceDir: resolvedSource,
        candidatePaths: candidates,
        sections: this.buildEmptySections('未检测到有效的旧版白守数据目录')
      }
    }

    const prefs = await resolveLegacyPreferencesForMigration(resolvedSource)
    const sp = prefs.sp
    const vaultNames = await discoverVaultNames(this.fileSystem, resolvedSource)
    const { agentDbs, baishouDbs } = await scanLegacyDatabases(this.fileSystem, resolvedSource)
    const isFileOnlyWorkspace = agentDbs.length === 0 && baishouDbs.length === 0
    const notes: string[] = []
    if (prefs.supplementedFromMachine) {
      notes.push(
        '头像、身份卡或配置的部分数据来自本机 Flutter 安装目录（如 %APPDATA%\\baishou 或「文档/avatars」），与工作区文件一并展示。'
      )
    }
    if (isFileOnlyWorkspace) {
      notes.push(
        '此目录为纯文件工作区：可导入日记与工作空间；身份卡、伙伴或聊天记录需本机 SharedPreferences 或目录内 SQLite。'
      )
    }

    const sections: LegacyMigrationSectionPreview[] = []

    const avatarPaths = resolveUserAvatarCandidates(sp, resolvedSource, {
      includeMachineAvatarPaths: true
    })
    let avatarSize = 0
    for (const p of avatarPaths) {
      try {
        const stat = await this.fileSystem.stat(p)
        if (stat.isFile) avatarSize += stat.size ?? 0
      } catch {
        // ignore
      }
    }
    sections.push({
      id: 'avatar',
      label: LEGACY_MIGRATION_SECTION_LABELS.avatar,
      detected: avatarPaths.length > 0,
      count: avatarPaths.length > 0 ? 1 : 0,
      sizeBytes: avatarSize,
      sizeLabel: formatMigrationSizeBytes(avatarSize),
      samples: avatarPaths.map((p) => p.split(/[/\\]/).pop() ?? p).slice(0, 3),
      warnings: [],
      importable: avatarPaths.length > 0
    })

    const personas = resolveLegacyIdentityPersonas(sp, prefs.config)
    const personaJson = sp?.['user_personas']
    const personaSize =
      typeof personaJson === 'string' ? new TextEncoder().encode(personaJson).length : 0
    const identityWarnings: string[] = []
    if (personas.length === 0 && isFileOnlyWorkspace) {
      identityWarnings.push('未检测到 shared_preferences.json 或 identity_facts，无法恢复身份卡')
    } else if (personas.length > 0 && prefs.source === 'device_preferences' && !sp?.['user_personas']) {
      identityWarnings.push(
        '仅检测到 device_preferences 中的 active 身份事实，无法恢复全部旧版身份卡'
      )
    } else if (personas.length > 0) {
      identityWarnings.push('重复导入将跳过已迁移身份卡')
    }
    sections.push({
      id: 'identityCards',
      label: LEGACY_MIGRATION_SECTION_LABELS.identityCards,
      detected: personas.length > 0,
      count: personas.length,
      sizeBytes: personaSize,
      sizeLabel: formatMigrationSizeBytes(personaSize),
      samples: personas.map((p) => p.id).slice(0, 5),
      warnings: identityWarnings,
      importable: personas.length > 0
    })

    const configKeys = prefs.config
      ? Object.keys(prefs.config).filter((k) => prefs.config![k] != null)
      : []
    sections.push({
      id: 'config',
      label: LEGACY_MIGRATION_SECTION_LABELS.config,
      detected: configKeys.length > 0,
      count: configKeys.length,
      sizeBytes: configKeys.length * 128,
      sizeLabel: formatMigrationSizeBytes(configKeys.length * 128),
      samples: configKeys.slice(0, 5),
      warnings:
        prefs.source === 'device_preferences'
          ? ['来自旧版目录 config/device_preferences.json']
          : prefs.source === 'source_shared_preferences'
            ? ['来自旧版目录 shared_preferences.json']
            : [],
      importable: configKeys.length > 0
    })

    let diarySize = 0
    const diarySamples: string[] = []
    const markdownEntries: LegacyDiaryMarkdownEntry[] = []
    const markdownCountByVault = new Map<string, number>()
    const markdownDatesByVault = new Map<string, Set<string>>()
    const sqliteByVault = new Map<string, Set<string>>()

    for (const vaultName of vaultNames) {
      const journalsDir = join(resolvedSource, vaultName, 'Journals')
      const stats = await countJournalMarkdownFiles(this.fileSystem, journalsDir)
      diarySize += stats.sizeBytes
      const vaultEntries = await collectLegacyDiaryMarkdownEntries(
        this.fileSystem,
        journalsDir,
        vaultName
      )
      markdownEntries.push(...vaultEntries)
      if (vaultEntries.length > 0) {
        markdownCountByVault.set(vaultName, vaultEntries.length)
        markdownDatesByVault.set(
          vaultName,
          new Set(vaultEntries.map((e) => e.dateKey))
        )
      }
      for (const entry of vaultEntries) {
        if (diarySamples.length < 5) {
          diarySamples.push(`${vaultName}/${entry.dateKey}`)
        }
      }
    }
    for (const dbPath of baishouDbs) {
      const vaultName = mapBaishouDbToVaultName(dbPath, vaultNames) ?? vaultNames[0] ?? 'Personal'
      const dates = sqliteByVault.get(vaultName) ?? new Set<string>()
      for (const row of readLegacyBaishouDiaries(dbPath)) {
        if (isValidDateKey(row.dateKey)) dates.add(row.dateKey)
      }
      if (dates.size > 0) sqliteByVault.set(vaultName, dates)
      if (dates.size > 0 && diarySamples.length < 5) {
        diarySamples.push(`${vaultName}:sqlite×${dates.size}`)
      }
    }
    const diaryCount = countImportableDiaryEntries(
      markdownCountByVault,
      markdownDatesByVault,
      sqliteByVault
    )
    const rawMarkdownFiles = [...markdownCountByVault.values()].reduce((n, c) => n + c, 0)
    const rawSqliteRows = [...sqliteByVault.values()].reduce((n, s) => n + s.size, 0)
    const diaryWarnings = [
      '同日多篇 Markdown 将依次追加到同一日记',
      'Markdown 优先，baishou.sqlite 仅补缺同日条目',
      '重复导入将跳过已迁移日记'
    ]
    if (rawSqliteRows > 0 && rawMarkdownFiles > 0) {
      const sqliteOnly = diaryCount - rawMarkdownFiles
      if (sqliteOnly < rawSqliteRows) {
        diaryWarnings.push(`已跳过 ${rawSqliteRows - sqliteOnly} 条与 Markdown 重复的 SQLite 日记`)
      }
    }
    sections.push({
      id: 'diaries',
      label: LEGACY_MIGRATION_SECTION_LABELS.diaries,
      detected: diaryCount > 0,
      count: diaryCount,
      sizeBytes: diarySize,
      sizeLabel: formatMigrationSizeBytes(diarySize),
      samples: diarySamples,
      warnings: diaryWarnings,
      importable: diaryCount > 0
    })

    const assistantIds = new Set<string>()
    const assistantSamples: string[] = []
    let sessionCount = 0
    let messageCount = 0
    let chatSize = 0

    for (const dbPath of agentDbs) {
      try {
        const stat = await this.fileSystem.stat(dbPath)
        chatSize += stat.size ?? 0
      } catch {
        // ignore
      }
      for (const row of readLegacySqlite<LegacyAssistantRow>(
        dbPath,
        'SELECT id, name FROM agent_assistants'
      )) {
        if (!assistantIds.has(row.id)) {
          assistantIds.add(row.id)
          if (assistantSamples.length < 5) assistantSamples.push(row.name)
        }
      }
      sessionCount += readLegacySqlite<LegacySessionRow>(
        dbPath,
        'SELECT id FROM agent_sessions'
      ).length
      messageCount += readLegacySqlite<LegacyMessageRow>(
        dbPath,
        'SELECT id FROM agent_messages'
      ).length
    }

    sections.push({
      id: 'assistants',
      label: LEGACY_MIGRATION_SECTION_LABELS.assistants,
      detected: assistantIds.size > 0,
      count: assistantIds.size,
      sizeBytes: Math.round(chatSize * 0.2),
      sizeLabel: formatMigrationSizeBytes(Math.round(chatSize * 0.2)),
      samples: assistantSamples,
      warnings: assistantIds.size > 0
        ? ['导入后伙伴名称将追加两位随机数字', '重复导入将跳过已迁移伙伴']
        : isFileOnlyWorkspace
          ? ['未检测到 agent.sqlite，无法从此目录恢复伙伴']
          : [],
      importable: assistantIds.size > 0
    })

    sections.push({
      id: 'chatMessages',
      label: LEGACY_MIGRATION_SECTION_LABELS.chatMessages,
      detected: messageCount > 0,
      count: messageCount,
      sizeBytes: chatSize,
      sizeLabel: formatMigrationSizeBytes(chatSize),
      samples: [`${sessionCount} 个会话`, `${messageCount} 条消息`],
      warnings: messageCount > 0
        ? ['需与伙伴一并导入，聊天记录将绑定到新导入的伙伴', '重复导入将跳过已迁移会话']
        : isFileOnlyWorkspace
          ? ['未检测到 agent.sqlite，无法从此目录恢复聊天记录']
          : [],
      importable: messageCount > 0 && assistantIds.size > 0
    })

    let workspaceSize = 0
    let archiveCount = 0
    const workspaceSamples: string[] = []
    for (const vaultName of vaultNames) {
      workspaceSize += await sumDirectorySizeBytes(
        this.fileSystem,
        join(resolvedSource, vaultName),
        { skipDirNames: new Set(['.baishou', 'Journals']) }
      )
      const archiveStats = await countArchiveMarkdownFiles(
        this.fileSystem,
        join(resolvedSource, vaultName, 'Archives')
      )
      archiveCount += archiveStats.count
      if (archiveStats.count > 0 && workspaceSamples.length < 5) {
        workspaceSamples.push(`${vaultName}/Archives×${archiveStats.count}`)
      }
    }
  if (workspaceSamples.length < 5) {
      for (const name of vaultNames) {
        if (workspaceSamples.length >= 5) break
        if (!workspaceSamples.some((s) => s.startsWith(`${name}/`))) {
          workspaceSamples.push(name)
        }
      }
    }
    const workspaceWarnings = [
      '仅登记工作空间并复制附件/Archives（不复制 Journals，日记请用「日记」板块导入）',
      '不会自动切换当前存储根目录',
      '不会覆盖已存在的附件文件',
      '导入后需等待索引刷新完成'
    ]
    if (archiveCount > 0) {
      workspaceWarnings.unshift(`检测到约 ${archiveCount} 个归档笔记（将复制 Archives 目录）`)
    }
    sections.push({
      id: 'workspaces',
      label: LEGACY_MIGRATION_SECTION_LABELS.workspaces,
      detected: vaultNames.length > 0,
      count: vaultNames.length,
      sizeBytes: workspaceSize,
      sizeLabel: formatMigrationSizeBytes(workspaceSize),
      samples: workspaceSamples.slice(0, 5),
      warnings: workspaceWarnings,
      importable: vaultNames.length > 0
    })

    onProgress?.({ phase: 'scan', message: '扫描完成' })
    return { sourceDir: resolvedSource, candidatePaths: candidates, sections, notes }
  }

  async importSelected(
    sourceDir: string,
    selectionInput: LegacyMigrationImportSelection,
    onProgress?: ProgressFn
  ): Promise<LegacyMigrationImportResult> {
    this.cancelled = false
    const selection = validateImportSelection(selectionInput)
    const trimmedSource = sourceDir?.trim()
    if (!trimmedSource) {
      throw new Error('请指定旧版数据目录')
    }
    if (!(await isLegacyAppRoot(this.fileSystem, trimmedSource))) {
      throw new Error('无效的旧版数据目录')
    }

    const results: LegacyMigrationImportSectionResult[] = []
    const pathService = new DesktopStoragePathService()
    const attManager = new DesktopAttachmentManagerService(pathService)
    const db = getAppDb()
    const settingsRepo = new SettingsRepository(db)
    const profileRepo = new UserProfileRepository(db)
    const legacyImporter = new LegacyImportService(settingsRepo, profileRepo)
    const prefs = await resolveLegacyPreferencesForMigration(trimmedSource)
    const sp = prefs.sp

    let manifest = (await settingsRepo.get<LegacySelectiveMigrationManifest>(
      LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY
    )) ?? { assistants: {}, sessions: {}, diaries: {}, personas: {} }
    manifest.diaries = manifest.diaries ?? {}
    manifest.personas = manifest.personas ?? {}
    manifest.lastSourceDir = trimmedSource

    let assistantIdMap = new Map<string, string>(Object.entries(manifest.assistants))

    if (selection.avatar) {
      results.push(
        await this.importAvatar(trimmedSource, sp, profileRepo, attManager, onProgress)
      )
    }
    if (selection.identityCards) {
      results.push(
        await this.importIdentityCards(sp, prefs.config, profileRepo, manifest, onProgress)
      )
    }
    if (selection.config) {
      results.push(await this.importConfig(legacyImporter, prefs.config, onProgress))
    }
    if (selection.workspaces) {
      results.push(await this.importWorkspaces(trimmedSource, onProgress))
    }
    if (selection.diaries) {
      results.push(await this.importDiaries(trimmedSource, manifest, onProgress))
    }
    if (selection.assistants) {
      const assistantResult = await this.importAssistants(
        trimmedSource,
        attManager,
        assistantIdMap,
        onProgress
      )
      assistantIdMap = assistantResult.idMap
      manifest.assistants = Object.fromEntries(assistantIdMap)
      results.push(assistantResult.result)
    }
    if (selection.chatMessages) {
      const chatResult = await this.importChatMessages(
        trimmedSource,
        assistantIdMap,
        manifest,
        onProgress
      )
      manifest.sessions = { ...manifest.sessions, ...chatResult.sessionMap }
      results.push(chatResult.result)
    }

    await settingsRepo.set(LEGACY_SELECTIVE_MIGRATION_MANIFEST_KEY, manifest)

    const cancelled = this.wasCancelled()
    if (!cancelled) {
      onProgress?.({ phase: 'import', message: '正在刷新索引与界面…' })
      await this.afterImportComplete()
      onProgress?.({ phase: 'import', message: '导入完成' })
    } else {
      onProgress?.({ phase: 'import', message: '导入已取消（已完成部分可能已写入）' })
    }

    return { sections: results, cancelled }
  }

  private async afterImportComplete(): Promise<void> {
    try {
      const { globalBootstrapper } = await import('./bootstrapper.service')
      await globalBootstrapper.fullyResyncAllEcosystems()
    } catch (e) {
      console.error('[LegacySelectiveMigration] post-import resync failed:', e)
    }
  }

  private buildEmptySections(warning: string): LegacyMigrationSectionPreview[] {
    return (Object.keys(LEGACY_MIGRATION_SECTION_LABELS) as LegacyMigrationSectionId[]).map(
      (id) => ({
        id,
        label: LEGACY_MIGRATION_SECTION_LABELS[id],
        detected: false,
        count: 0,
        sizeBytes: 0,
        sizeLabel: '0 MB',
        samples: [],
        warnings: [warning],
        importable: false
      })
    )
  }

  private async importAvatar(
    sourceDir: string,
    sp: Record<string, unknown> | null,
    profileRepo: UserProfileRepository,
    attManager: DesktopAttachmentManagerService,
    onProgress?: ProgressFn
  ): Promise<LegacyMigrationImportSectionResult> {
    const result = emptySectionResult('avatar')
    onProgress?.({ phase: 'import', section: 'avatar', message: '正在导入头像…' })
    try {
      const candidates = resolveUserAvatarCandidates(sp, sourceDir, {
        includeMachineAvatarPaths: true
      })
      if (candidates.length === 0) {
        result.skipped = 1
        return result
      }
      const rel = await attManager.importAvatar(candidates[0]!, 'user_avatar')
      const profile = await profileRepo.getProfile()
      profile.avatarPath = rel
      await profileRepo.saveProfile(profile)
      result.success = 1
    } catch (e) {
      result.failed = 1
      result.errors.push(e instanceof Error ? e.message : String(e))
    }
    return result
  }

  private async importIdentityCards(
    sp: Record<string, unknown> | null,
    config: Record<string, unknown> | null,
    profileRepo: UserProfileRepository,
    manifest: LegacySelectiveMigrationManifest,
    onProgress?: ProgressFn
  ): Promise<LegacyMigrationImportSectionResult> {
    const result = emptySectionResult('identityCards')
    onProgress?.({ phase: 'import', section: 'identityCards', message: '正在导入身份卡…' })
    try {
      const personas = resolveLegacyIdentityPersonas(sp, config)
      if (personas.length === 0) {
        result.skipped = 1
        return result
      }
      const profile = await profileRepo.getProfile()
      manifest.personas = manifest.personas ?? {}
      let changed = false
      for (const persona of personas) {
        if (this.wasCancelled()) break
        const manifestKey = personaManifestKey(persona.id, persona.facts)
        if (manifest.personas[manifestKey]) {
          result.skipped += 1
          continue
        }
        let newId = appendTwoRandomDigits(persona.id)
        while (profile.personas[newId]) {
          newId = appendTwoRandomDigits(persona.id)
        }
        profile.personas[newId] = { id: newId, facts: { ...persona.facts } }
        manifest.personas[manifestKey] = true
        changed = true
        result.success += 1
      }
      if (changed) {
        await profileRepo.saveProfile(profile)
      }
    } catch (e) {
      result.failed += 1
      result.errors.push(e instanceof Error ? e.message : String(e))
    }
    return result
  }

  private async importConfig(
    legacyImporter: LegacyImportService,
    config: Record<string, unknown> | null,
    onProgress?: ProgressFn
  ): Promise<LegacyMigrationImportSectionResult> {
    const result = emptySectionResult('config')
    onProgress?.({ phase: 'import', section: 'config', message: '正在合并配置…' })
    try {
      if (!config) {
        result.skipped = 1
        return result
      }
      await legacyImporter.restoreConfig(config, { skipProfileFields: true })
      result.success = Object.keys(config).length
    } catch (e) {
      result.failed = 1
      result.errors.push(e instanceof Error ? e.message : String(e))
    }
    return result
  }

  private async importDiaries(
    sourceDir: string,
    manifest: LegacySelectiveMigrationManifest,
    onProgress?: ProgressFn
  ): Promise<LegacyMigrationImportSectionResult> {
    const result = emptySectionResult('diaries')
    const vaultNames = await discoverVaultNames(this.fileSystem, sourceDir)
    const { baishouDbs } = await scanLegacyDatabases(this.fileSystem, sourceDir)
    manifest.diaries = manifest.diaries ?? {}

    const markdownEntries: LegacyDiaryMarkdownEntry[] = []
    for (const vaultName of vaultNames) {
      const journalsDir = join(sourceDir, vaultName, 'Journals')
      const vaultEntries = await collectLegacyDiaryMarkdownEntries(
        this.fileSystem,
        journalsDir,
        vaultName
      )
      markdownEntries.push(...vaultEntries)
    }

    const sqliteEntries: LegacyDiarySqliteEntry[] = []
    for (const dbPath of baishouDbs) {
      const vaultName = mapBaishouDbToVaultName(dbPath, vaultNames) ?? vaultNames[0] ?? 'Personal'
      for (const row of readLegacyBaishouDiaries(dbPath)) {
        if (!isValidDateKey(row.dateKey)) continue
        const content = row.content.trim()
        if (!content) continue
        sqliteEntries.push({
          vaultName,
          dateKey: row.dateKey,
          content,
          contentHash: hashDiaryContent(content),
          tags: row.tags,
          weather: row.weather,
          mood: row.mood,
          location: row.location,
          locationDetail: row.locationDetail,
          isFavorite: row.isFavorite ?? false
        })
      }
    }

    const items = buildLegacyDiaryImportItems(markdownEntries, sqliteEntries)
    const total = items.length
    let index = 0

    for (const item of items) {
      if (this.wasCancelled()) break
      index += 1
      onProgress?.({
        phase: 'import',
        section: 'diaries',
        message: `正在导入日记 ${index}/${total}`,
        current: index,
        total
      })
      const manifestKey = diaryManifestKey(item.vaultName, item.dateKey, item.contentHash)
      if (manifest.diaries![manifestKey]) {
        result.skipped += 1
        continue
      }
      try {
        await this.ensureTargetVault(item.vaultName)
        const diaryManager = await getDiaryManagerForVault(item.vaultName)
        const date = safeParseDate(item.dateKey)
        await diaryManager.save(null, {
          date,
          content: item.content,
          tags: item.tags,
          weather: item.weather,
          mood: item.mood,
          location: item.location,
          locationDetail: item.locationDetail,
          isFavorite: item.isFavorite
        })
        manifest.diaries![manifestKey] = true
        result.success += 1
      } catch (e) {
        result.failed += 1
        result.errors.push(
          `${item.vaultName}/${item.dateKey}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }

    return result
  }

  private async ensureTargetVault(vaultName: string): Promise<void> {
    if (!vaultService.vaultExists(vaultName)) {
      await vaultService.createVault(vaultName)
    }
  }

  private async importAssistants(
    sourceDir: string,
    attManager: DesktopAttachmentManagerService,
    existingMap: Map<string, string>,
    onProgress?: ProgressFn
  ): Promise<{ result: LegacyMigrationImportSectionResult; idMap: Map<string, string> }> {
    const result = emptySectionResult('assistants')
    const idMap = new Map(existingMap)
    const { assistantManager } = getAgentManagers()
    const { agentDbs } = await scanLegacyDatabases(this.fileSystem, sourceDir)
    const seen = new Set<string>()
    const rows: LegacyAssistantRow[] = []

    for (const dbPath of agentDbs) {
      for (const row of readLegacySqlite<LegacyAssistantRow>(
        dbPath,
        'SELECT id, name, emoji, description, avatar_path, system_prompt, is_default, context_window, provider_id, model_id, compress_token_threshold, compress_keep_turns, sort_order FROM agent_assistants'
      )) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        rows.push(row)
      }
    }

    let index = 0
    for (const row of rows) {
      if (this.wasCancelled()) break
      index += 1
      onProgress?.({
        phase: 'import',
        section: 'assistants',
        message: `正在导入伙伴 ${index}/${rows.length}`,
        current: index,
        total: rows.length
      })
      try {
        const existingId = idMap.get(row.id)
        if (existingId) {
          result.skipped += 1
          continue
        }
        const newId = randomUUID()
        idMap.set(row.id, newId)
        let avatarPath: string | undefined
        if (row.avatar_path && existsSync(row.avatar_path)) {
          avatarPath = await attManager.importAvatar(row.avatar_path, 'agent_avatar')
        }
        await assistantManager.create({
          id: newId,
          name: appendTwoRandomDigits(row.name || '伙伴'),
          emoji: row.emoji ?? undefined,
          description: row.description ?? undefined,
          avatarPath,
          systemPrompt: row.system_prompt ?? undefined,
          isDefault: false,
          contextWindow: row.context_window ?? 20,
          providerId: row.provider_id,
          modelId: row.model_id,
          compressTokenThreshold: row.compress_token_threshold ?? 60000,
          compressKeepTurns: row.compress_keep_turns ?? 3,
          sortOrder: row.sort_order ?? 0,
          assistantKind: 'companion'
        })
        result.success += 1
      } catch (e) {
        result.failed += 1
        result.errors.push(`${row.name}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return { result, idMap }
  }

  private async importChatMessages(
    sourceDir: string,
    assistantIdMap: Map<string, string>,
    manifest: LegacySelectiveMigrationManifest,
    onProgress?: ProgressFn
  ): Promise<{
    result: LegacyMigrationImportSectionResult
    sessionMap: Record<string, string>
  }> {
    const result = emptySectionResult('chatMessages')
    const sessionMap: Record<string, string> = {}
    const { sessionManager, realSessionRepo } = getAgentManagers()
    const { agentDbs } = await scanLegacyDatabases(this.fileSystem, sourceDir)

    const sessions: LegacySessionRow[] = []
    const sessionIds = new Set<string>()
    for (const dbPath of agentDbs) {
      for (const row of readLegacySqlite<LegacySessionRow>(
        dbPath,
        'SELECT id, title, vault_name, assistant_id, is_pinned, system_prompt, provider_id, model_id FROM agent_sessions'
      )) {
        if (sessionIds.has(row.id)) continue
        sessionIds.add(row.id)
        sessions.push(row)
      }
    }

    let index = 0
    for (const session of sessions) {
      if (this.wasCancelled()) break
      index += 1
      onProgress?.({
        phase: 'import',
        section: 'chatMessages',
        message: `正在导入聊天记录 ${index}/${sessions.length}`,
        current: index,
        total: sessions.length
      })

      const alreadyImported = manifest.sessions[session.id]
      if (alreadyImported) {
        sessionMap[session.id] = alreadyImported
        result.skipped += 1
        continue
      }

      try {
        const mappedAssistantId = session.assistant_id
          ? assistantIdMap.get(session.assistant_id)
          : undefined
        if (session.assistant_id && !mappedAssistantId) {
          result.skipped += 1
          result.errors.push(`会话「${session.title}」：找不到对应伙伴映射，已跳过`)
          continue
        }

        const vaultName = session.vault_name?.trim() || 'Personal'
        await this.ensureTargetVault(vaultName)

        const newSessionId = randomUUID()
        await sessionManager.upsertSession({
          id: newSessionId,
          title: session.title || '导入的对话',
          vaultName,
          assistantId: mappedAssistantId,
          systemPrompt: session.system_prompt ?? undefined,
          providerId: session.provider_id || 'default',
          modelId: session.model_id || 'default'
        })

        if (session.is_pinned === 1) {
          await realSessionRepo.togglePin(newSessionId, true)
        }

        const messages = this.readMessagesForSession(agentDbs, session.id)
        for (const msg of messages) {
          const newMsgId = randomUUID()
          const parts = this.readPartsForMessage(agentDbs, msg.id).map((part) => ({
            id: randomUUID(),
            messageId: newMsgId,
            sessionId: newSessionId,
            type: this.normalizePartType(part.type),
            data: this.parsePartData(part.data, part.type)
          }))
          await sessionManager.insertMessageWithParts(
            {
              id: newMsgId,
              sessionId: newSessionId,
              role: this.normalizeMessageRole(msg.role),
              isSummary: msg.is_summary === 1,
              orderIndex: msg.order_index,
              inputTokens: msg.input_tokens ?? undefined,
              outputTokens: msg.output_tokens ?? undefined,
              costMicros: msg.cost_micros ?? undefined,
              providerId: msg.provider_id ?? undefined,
              modelId: msg.model_id ?? undefined
            },
            parts
          )
          result.success += 1
        }

        sessionMap[session.id] = newSessionId
      } catch (e) {
        result.failed += 1
        result.errors.push(`${session.title}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return { result, sessionMap }
  }

  private normalizeMessageRole(
    role: string
  ): 'system' | 'user' | 'assistant' | 'tool' {
    return (['system', 'user', 'assistant', 'tool'].includes(role)
      ? role
      : 'user') as 'system' | 'user' | 'assistant' | 'tool'
  }

  private normalizePartType(type: string): 'text' | 'tool' | 'stepFinish' | 'compaction' {
    if (type === 'tool' || type === 'stepFinish' || type === 'compaction') return type
    return 'text'
  }

  private readMessagesForSession(agentDbs: string[], sessionId: string): LegacyMessageRow[] {
    const messages: LegacyMessageRow[] = []
    const seen = new Set<string>()
    for (const dbPath of agentDbs) {
      for (const row of readLegacySqlite<LegacyMessageRow>(
        dbPath,
        'SELECT id, session_id, role, order_index, is_summary, ask_id, provider_id, model_id, input_tokens, output_tokens, cost_micros FROM agent_messages WHERE session_id = ? ORDER BY order_index ASC',
        sessionId
      )) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        messages.push(row)
      }
    }
    return messages.sort((a, b) => a.order_index - b.order_index)
  }

  private readPartsForMessage(agentDbs: string[], messageId: string): LegacyPartRow[] {
    const parts: LegacyPartRow[] = []
    const seen = new Set<string>()
    for (const dbPath of agentDbs) {
      for (const row of readLegacySqlite<LegacyPartRow>(
        dbPath,
        'SELECT id, message_id, session_id, type, data FROM agent_parts WHERE message_id = ?',
        messageId
      )) {
        if (seen.has(row.id)) continue
        seen.add(row.id)
        parts.push(row)
      }
    }
    return parts
  }

  private parsePartData(raw: string, type: string): Record<string, unknown> {
    try {
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, unknown>
      }
    } catch {
      // fall through
    }
    if (type === 'text' || !type) return { text: raw }
    return { text: raw, raw }
  }

  private async importWorkspaces(
    sourceDir: string,
    onProgress?: ProgressFn
  ): Promise<LegacyMigrationImportSectionResult> {
    const result = emptySectionResult('workspaces')
    const vaultNames = await discoverVaultNames(this.fileSystem, sourceDir)
    const targetRoot = await new DesktopStoragePathService().getRootDirectory()

    for (const vaultName of vaultNames) {
      if (this.wasCancelled()) break
      onProgress?.({
        phase: 'import',
        section: 'workspaces',
        message: `正在登记工作空间 ${vaultName}`
      })
      try {
        if (!vaultService.vaultExists(vaultName)) {
          await vaultService.createVault(vaultName)
        }
        const srcVault = join(sourceDir, vaultName)
        const destVault = join(targetRoot, vaultName)
        const copyFailures: string[] = []
        for (const sub of WORKSPACE_COPY_SUBDIRS) {
          const src = join(srcVault, sub)
          const dest = join(destVault, sub)
          if (await this.fileSystem.exists(src)) {
            const failed = await mergeDirectoriesSkipExisting(this.fileSystem, src, dest)
            copyFailures.push(...failed)
          }
        }
        if (copyFailures.length > 0) {
          result.failed += 1
          result.errors.push(
            `${vaultName}: ${copyFailures.length} 个文件复制失败（示例: ${copyFailures.slice(0, 2).join(', ')})`
          )
        } else {
          result.success += 1
        }
      } catch (e) {
        result.failed += 1
        result.errors.push(`${vaultName}: ${e instanceof Error ? e.message : String(e)}`)
      }
    }
    return result
  }
}

export const legacySelectiveMigrationService = new LegacySelectiveMigrationService()
