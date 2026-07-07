import i18n from 'i18next'
import { join } from 'node:path'
import {
  formatMigrationSizeBytes,
  countArchiveMarkdownFiles,
  countImportableDiaryEntries,
  countJournalMarkdownFiles,
  collectLegacyDiaryMarkdownEntries,
  discoverVaultNames,
  isLegacyAppRoot,
  isValidDateKey,
  LEGACY_MIGRATION_SECTION_LABELS,
  mapBaishouDbToVaultName,
  scanLegacyDatabases,
  sumDirectorySizeBytes,
  resolveLegacyIdentityPersonas,
  type LegacyDiaryMarkdownEntry
} from '@baishou/core/shared'
import type { LegacyMigrationScanResult, LegacyMigrationSectionPreview } from '@baishou/shared'
import {
  resolveLegacyPreferencesForMigration,
  resolveLegacyRootCandidates
} from './flutter-legacy-paths.service'
import {
  buildEmptySections,
  readLegacyBaishouDiaries,
  readLegacySqlite,
  resolveUserAvatarCandidates,
  type LegacyAssistantRow,
  type LegacyMessageRow,
  type LegacySessionRow,
  type ProgressFn
} from './legacy-selective-migration.helpers'

export interface LegacyMigrationScanCtx {
  fileSystem: import('@baishou/core-desktop').NodeFileSystem
  cancelled: boolean
}

export async function scanLegacyMigration(
  ctx: LegacyMigrationScanCtx,
  sourceDir?: string,
  onProgress?: ProgressFn
): Promise<LegacyMigrationScanResult> {
  ctx.cancelled = false
  onProgress?.({
    phase: 'scan',
    message: i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L266',
      '正在检测旧版数据…'
    )
  })

  const candidates = await resolveLegacyRootCandidates()
  const resolvedSource = sourceDir?.trim() || candidates[0] || ''
  if (!resolvedSource || !(await isLegacyAppRoot(ctx.fileSystem, resolvedSource))) {
    return {
      sourceDir: resolvedSource,
      candidatePaths: candidates,
      sections: buildEmptySections(
        i18n.t(
          'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L274',
          '未检测到有效的旧版白守数据目录'
        )
      )
    }
  }

  const prefs = await resolveLegacyPreferencesForMigration(resolvedSource)
  const sp = prefs.sp
  const vaultNames = await discoverVaultNames(ctx.fileSystem, resolvedSource)
  const { agentDbs, baishouDbs } = await scanLegacyDatabases(ctx.fileSystem, resolvedSource)
  const isFileOnlyWorkspace = agentDbs.length === 0 && baishouDbs.length === 0
  const notes: string[] = []
  if (prefs.supplementedFromMachine) {
    notes.push(
      i18n.t(
        'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L286',
        '头像、身份卡或配置的部分数据来自本机 Flutter 安装目录（如 %APPDATA%\\baishou 或「文档/avatars」），与工作区文件一并展示。'
      )
    )
  }
  if (isFileOnlyWorkspace) {
    notes.push(
      i18n.t(
        'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L291',
        '此目录为纯文件工作区：可导入日记与工作空间；身份卡、伙伴或聊天记录需本机 SharedPreferences 或目录内 SQLite。'
      )
    )
  }

  const sections: LegacyMigrationSectionPreview[] = []

  const avatarPaths = resolveUserAvatarCandidates(sp, resolvedSource, {
    includeMachineAvatarPaths: true
  })
  let avatarSize = 0
  for (const p of avatarPaths) {
    try {
      const stat = await ctx.fileSystem.stat(p)
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
    identityWarnings.push(
      i18n.t(
        'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L327',
        '未检测到 shared_preferences.json 或 identity_facts，无法恢复身份卡'
      )
    )
  } else if (
    personas.length > 0 &&
    prefs.source === 'device_preferences' &&
    !sp?.['user_personas']
  ) {
    identityWarnings.push(
      i18n.t(
        'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L334',
        '仅检测到 device_preferences 中的 active 身份事实，无法恢复全部旧版身份卡'
      )
    )
  } else if (personas.length > 0) {
    identityWarnings.push(
      i18n.t(
        'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L337',
        '重复导入将跳过已迁移身份卡'
      )
    )
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
        ? [
            i18n.t(
              'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L364',
              '来自旧版目录 config/device_preferences.json'
            )
          ]
        : prefs.source === 'source_shared_preferences'
          ? [
              i18n.t(
                'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L366',
                '来自旧版目录 shared_preferences.json'
              )
            ]
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
    const stats = await countJournalMarkdownFiles(ctx.fileSystem, journalsDir)
    diarySize += stats.sizeBytes
    const vaultEntries = await collectLegacyDiaryMarkdownEntries(
      ctx.fileSystem,
      journalsDir,
      vaultName
    )
    markdownEntries.push(...vaultEntries)
    if (vaultEntries.length > 0) {
      markdownCountByVault.set(vaultName, vaultEntries.length)
      markdownDatesByVault.set(vaultName, new Set(vaultEntries.map((e) => e.dateKey)))
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
    i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L417',
      '同日多篇 Markdown 将依次追加到同一日记'
    ),
    i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L418',
      'Markdown 优先，baishou.sqlite 仅补缺同日条目'
    ),
    i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L419',
      '重复导入将跳过已迁移日记'
    )
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
      const stat = await ctx.fileSystem.stat(dbPath)
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
    warnings:
      assistantIds.size > 0
        ? [
            i18n.t(
              'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L481',
              '导入后伙伴名称将追加两位随机数字'
            ),
            i18n.t(
              'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L481',
              '重复导入将跳过已迁移伙伴'
            )
          ]
        : isFileOnlyWorkspace
          ? [
              i18n.t(
                'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L483',
                '未检测到 agent.sqlite，无法从此目录恢复伙伴'
              )
            ]
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
    warnings:
      messageCount > 0
        ? [
            i18n.t(
              'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L498',
              '需与伙伴一并导入，聊天记录将绑定到新导入的伙伴'
            ),
            i18n.t(
              'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L498',
              '重复导入将跳过已迁移会话'
            )
          ]
        : isFileOnlyWorkspace
          ? [
              i18n.t(
                'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L500',
                '未检测到 agent.sqlite，无法从此目录恢复聊天记录'
              )
            ]
          : [],
    importable: messageCount > 0 && assistantIds.size > 0
  })

  let workspaceSize = 0
  let archiveCount = 0
  const workspaceSamples: string[] = []
  for (const vaultName of vaultNames) {
    workspaceSize += await sumDirectorySizeBytes(ctx.fileSystem, join(resolvedSource, vaultName), {
      skipDirNames: new Set(['.baishou', 'Journals'])
    })
    const archiveStats = await countArchiveMarkdownFiles(
      ctx.fileSystem,
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
    i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L532',
      '仅登记工作空间并复制附件/Archives（不复制 Journals，日记请用「日记」板块导入）'
    ),
    i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L533',
      '不会自动切换当前存储根目录'
    ),
    i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L534',
      '不会覆盖已存在的附件文件'
    ),
    i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L535',
      '导入后需等待索引刷新完成'
    )
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

  onProgress?.({
    phase: 'scan',
    message: i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L552',
      '扫描完成'
    )
  })
  return { sourceDir: resolvedSource, candidatePaths: candidates, sections, notes }
}
