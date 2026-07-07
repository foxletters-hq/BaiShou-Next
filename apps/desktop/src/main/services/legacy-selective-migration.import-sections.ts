import i18n from 'i18next'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { UserProfileRepository } from '@baishou/database-desktop'
import { LegacyImportService } from '@baishou/core-desktop'
import {
  appendTwoRandomDigits,
  buildLegacyDiaryImportItems,
  collectLegacyDiaryMarkdownEntries,
  diaryManifestKey,
  discoverVaultNames,
  hashDiaryContent,
  isValidDateKey,
  mapBaishouDbToVaultName,
  normalizeLegacyPartData,
  personaManifestKey,
  resolveLegacyIdentityPersonas,
  scanLegacyDatabases,
  type LegacyDiaryMarkdownEntry,
  type LegacyDiarySqliteEntry
} from '@baishou/core/shared'
import type {
  LegacyMigrationImportSectionResult,
  LegacySelectiveMigrationManifest
} from '@baishou/shared'
import { safeParseDate } from '@baishou/shared'
import { DesktopAttachmentManagerService } from './desktop-attachment-manager.service'
import { getAgentManagers } from '../ipc/agent-helpers'
import { vaultService } from '../ipc/vault.ipc'
import { getDiaryManagerForVault } from './diary-vault.factory'
import {
  emptySectionResult,
  readLegacyBaishouDiaries,
  readLegacySqlite,
  resolveUserAvatarCandidates,
  type LegacyAssistantRow,
  type LegacySessionRow,
  type ProgressFn
} from './legacy-selective-migration.helpers'

import {
  normalizeMessageRole,
  normalizePartType,
  readMessagesForSession,
  readPartsForMessage
} from './legacy-selective-migration.chat-readers'
import { type LegacyMigrationImportCtx } from './legacy-selective-migration.workspace-import'

export async function afterImportComplete(): Promise<void> {
  try {
    const { globalBootstrapper } = await import('./bootstrapper.service')
    await globalBootstrapper.fullyResyncAllEcosystems()
  } catch (e) {
    console.error('[LegacySelectiveMigration] post-import resync failed:', e)
  }
}

export async function importAvatar(
  _ctx: LegacyMigrationImportCtx,
  sourceDir: string,
  sp: Record<string, unknown> | null,
  profileRepo: UserProfileRepository,
  attManager: DesktopAttachmentManagerService,
  onProgress?: ProgressFn
): Promise<LegacyMigrationImportSectionResult> {
  const result = emptySectionResult('avatar')
  onProgress?.({
    phase: 'import',
    section: 'avatar',
    message: i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L676',
      '正在导入头像…'
    )
  })
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

export async function importIdentityCards(
  ctx: LegacyMigrationImportCtx,
  sp: Record<string, unknown> | null,
  config: Record<string, unknown> | null,
  profileRepo: UserProfileRepository,
  manifest: LegacySelectiveMigrationManifest,
  onProgress?: ProgressFn
): Promise<LegacyMigrationImportSectionResult> {
  const result = emptySectionResult('identityCards')
  onProgress?.({
    phase: 'import',
    section: 'identityCards',
    message: i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L705',
      '正在导入身份卡…'
    )
  })
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
      if (ctx.wasCancelled()) break
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

export async function importConfig(
  _ctx: LegacyMigrationImportCtx,
  legacyImporter: LegacyImportService,
  config: Record<string, unknown> | null,
  onProgress?: ProgressFn
): Promise<LegacyMigrationImportSectionResult> {
  const result = emptySectionResult('config')
  onProgress?.({
    phase: 'import',
    section: 'config',
    message: i18n.t(
      'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L747',
      '正在合并配置…'
    )
  })
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

export async function importDiaries(
  ctx: LegacyMigrationImportCtx,
  sourceDir: string,
  manifest: LegacySelectiveMigrationManifest,
  onProgress?: ProgressFn
): Promise<LegacyMigrationImportSectionResult> {
  const result = emptySectionResult('diaries')
  const vaultNames = await discoverVaultNames(ctx.fileSystem, sourceDir)
  const { baishouDbs } = await scanLegacyDatabases(ctx.fileSystem, sourceDir)
  manifest.diaries = manifest.diaries ?? {}

  const markdownEntries: LegacyDiaryMarkdownEntry[] = []
  for (const vaultName of vaultNames) {
    const journalsDir = join(sourceDir, vaultName, 'Journals')
    const vaultEntries = await collectLegacyDiaryMarkdownEntries(
      ctx.fileSystem,
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
    if (ctx.wasCancelled()) break
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
      await ensureTargetVault(item.vaultName)
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

export async function ensureTargetVault(vaultName: string): Promise<void> {
  if (!vaultService.vaultExists(vaultName)) {
    await vaultService.createVault(vaultName)
  }
}

export async function importAssistants(
  ctx: LegacyMigrationImportCtx,
  sourceDir: string,
  attManager: DesktopAttachmentManagerService,
  existingMap: Map<string, string>,
  onProgress?: ProgressFn
): Promise<{ result: LegacyMigrationImportSectionResult; idMap: Map<string, string> }> {
  const result = emptySectionResult('assistants')
  const idMap = new Map(existingMap)
  const { assistantManager } = getAgentManagers()
  const { agentDbs } = await scanLegacyDatabases(ctx.fileSystem, sourceDir)
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
    if (ctx.wasCancelled()) break
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
        name: appendTwoRandomDigits(
          row.name ||
            i18n.t(
              'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L906',
              '伙伴'
            )
        ),
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

export async function importChatMessages(
  ctx: LegacyMigrationImportCtx,
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
  const { agentDbs } = await scanLegacyDatabases(ctx.fileSystem, sourceDir)

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
    if (ctx.wasCancelled()) break
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
      await ensureTargetVault(vaultName)

      const newSessionId = randomUUID()
      await sessionManager.upsertSession({
        id: newSessionId,
        title:
          session.title ||
          i18n.t(
            'auto.apps.desktop.src.main.services.legacy.selective.migration.service.L991',
            '导入的对话'
          ),
        vaultName,
        assistantId: mappedAssistantId,
        systemPrompt: session.system_prompt ?? undefined,
        providerId: session.provider_id || 'default',
        modelId: session.model_id || 'default'
      })

      if (session.is_pinned === 1) {
        await realSessionRepo.togglePin(newSessionId, true)
      }

      const messages = readMessagesForSession(agentDbs, session.id)
      for (const msg of messages) {
        const newMsgId = randomUUID()
        const parts = readPartsForMessage(agentDbs, msg.id).map((part) => ({
          id: randomUUID(),
          messageId: newMsgId,
          sessionId: newSessionId,
          type: normalizePartType(part.type),
          data: normalizeLegacyPartData(part.data, part.type)
        }))
        await sessionManager.insertMessageWithParts(
          {
            id: newMsgId,
            sessionId: newSessionId,
            role: normalizeMessageRole(msg.role),
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
