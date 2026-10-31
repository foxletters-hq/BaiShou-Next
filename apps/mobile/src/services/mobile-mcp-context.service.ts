import type { AppDatabase } from '@baishou/database'
import type { ToolContext, ToolDiarySearcher, IBaishouAgentGate } from '@baishou/ai'
import {
  AIProviderRegistry,
  DatabaseAdapter,
  EmbeddingAdapter,
  MCP_EXTERNAL_SESSION_ID,
  MemoryDeduplicationServiceImpl,
  createAutoApproveAgentGate,
  syncMcpToolUserConfig
} from '@baishou/ai'
import {
  MessageRepository,
  ShadowIndexRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb,
  shadowConnectionManager
} from '@baishou/database'
import {
  DiaryService,
  FileSyncServiceImpl,
  ShadowIndexSyncService,
  VaultIndexServiceImpl,
  type IEmbeddingCallback,
  type IFileSystem,
  type IVaultService,
  type SettingsManagerService,
  type VaultInfo,
  type VaultService
} from '@baishou/core-mobile'
import {
  deriveLegacyVaultId,
  formatDiaryPreviewText,
  isConfiguredDialogueModelId,
  isConfiguredProviderId,
  logger,
  parseDateStr,
  prepareDiarySearcherEdit,
  prepareDiarySearcherWrite
} from '@baishou/shared'
import type { MobileStoragePathService } from './path.service'
import { buildMobileStreamUserConfig } from './mobile-context-at-message.service'

export interface MobileMcpToolContextDeps {
  settingsManager: SettingsManagerService
  pathService: MobileStoragePathService
  fileSystem?: IFileSystem
  vaultService?: VaultService
  getDiarySearcher: () => ToolDiarySearcher | undefined
  getAgentGate?: () => IBaishouAgentGate | undefined
  drizzleDb: unknown
  webSearchResultFetcher: (url: string) => Promise<string>
  fetchSearchPage: (url: string) => Promise<string>
}

/** MCP 外部工具调用上下文：默认绑定当前活跃工作空间，也支持按 URL 参数映射到指定工作空间 */
const MCP_CONTEXT_CACHE_TTL_MS = 5000
const mobileMcpToolContextCache = new Map<
  string,
  {
    context: ToolContext
    expiresAt: number
  }
>()

export function invalidateMobileMcpToolContextCache(): void {
  mobileMcpToolContextCache.clear()
}

import type { McpServerConfig } from '@baishou/shared'

export async function buildMobileMcpToolListContext(
  deps: Pick<MobileMcpToolContextDeps, 'settingsManager' | 'pathService' | 'vaultService'>,
  targetVault?: string
): Promise<ToolContext> {
  const resolved = await resolveMobileTargetVault(deps, targetVault)
  const [userConfig, mcpConfig] = await Promise.all([
    buildMobileStreamUserConfig(deps.settingsManager, true),
    deps.settingsManager.get<McpServerConfig>('mcp_server_config').catch(() => null)
  ])
  const mcpDisabledToolIds = Array.isArray(mcpConfig?.disabledToolIds)
    ? mcpConfig.disabledToolIds
    : []
  return {
    sessionId: MCP_EXTERNAL_SESSION_ID,
    vaultId: resolved.id,
    vaultName: resolved.name,
    userConfig: {
      ...userConfig,
      mcpDisabledToolIds
    }
  }
}

async function resolveMobileActiveVaultId(
  deps: Pick<MobileMcpToolContextDeps, 'pathService' | 'vaultService'>
): Promise<string> {
  try {
    if (deps.vaultService) {
      await deps.vaultService.initRegistry()
      const active = deps.vaultService.getActiveVault()
      if (active?.id) return active.id
    }
  } catch {
    // fallback below
  }
  const vaultName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
  return deriveLegacyVaultId(vaultName)
}

async function resolveMobileTargetVault(
  deps: Pick<MobileMcpToolContextDeps, 'pathService' | 'vaultService'>,
  targetVault?: string
): Promise<{ id: string; name: string; isScoped: boolean }> {
  const requested = typeof targetVault === 'string' ? targetVault.trim() : ''
  if (requested) {
    if (deps.vaultService) {
      await deps.vaultService.initRegistry()
      const allVaults = deps.vaultService.getAllVaults?.() ?? []
      const active = deps.vaultService.getActiveVault()
      const matched =
        allVaults.find((v) => v.id === requested || v.name === requested) ??
        allVaults.find(
          (v) =>
            v.id.toLowerCase() === requested.toLowerCase() ||
            v.name.toLowerCase() === requested.toLowerCase()
        )
      if (!matched) {
        throw new Error(`Workspace not found: ${requested}`)
      }
      const id = matched.id || deriveLegacyVaultId(matched.name)
      const isScoped = Boolean(active?.id ? active.id !== id : active?.name !== matched.name)
      return { id, name: matched.name, isScoped }
    }
    const activeName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
    const activeId = deriveLegacyVaultId(activeName)
    if (requested === activeId || requested === activeName) {
      return { id: activeId, name: activeName, isScoped: false }
    }
    throw new Error(`Workspace not found: ${requested}`)
  }

  const vaultName = await deps.pathService.getActiveVaultNameForContext().catch(() => 'Personal')
  const vaultId = await resolveMobileActiveVaultId(deps)
  return { id: vaultId, name: vaultName, isScoped: false }
}

function diaryPreviewFromRaw(raw: string | null | undefined): string {
  const cleaned = formatDiaryPreviewText(raw)
  const firstLine = cleaned
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'))
  if (!firstLine) return '(empty)'
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine
}

async function createScopedMobileDiarySearcher(params: {
  vaultId: string
  vaultName: string
  scopedPathService: MobileStoragePathService
  fileSystem?: IFileSystem
  vaultService?: VaultService
}): Promise<ToolDiarySearcher | undefined> {
  if (!shadowConnectionManager.isConnected()) return undefined
  const shadowRepo = new ShadowIndexRepository(shadowConnectionManager.getDb(), params.vaultId)
  const fs = params.fileSystem
  const baseVaultService = params.vaultService
  let diaryService: DiaryService | null = null
  if (fs && baseVaultService) {
    const rawRuntime = await import('./mobile-raw-data-source.runtime')
    const rawManager = rawRuntime.getMobileRawDataSourceManagerForVault(
      params.vaultName,
      params.scopedPathService
    )
    const fileSyncService = new FileSyncServiceImpl(
      params.scopedPathService,
      fs,
      rawManager ?? undefined
    )
    const vaultPath = (await params.scopedPathService.getActiveVaultPath()) || ''
    const fixedVaultService: IVaultService = {
      initRegistry: () => baseVaultService.initRegistry(),
      getActiveVault: (): VaultInfo => ({
        id: params.vaultId,
        name: params.vaultName,
        path: vaultPath,
        createdAt: new Date(),
        lastAccessedAt: new Date()
      }),
      resolveActiveVault: () => ({ id: params.vaultId, name: params.vaultName }),
      getAllVaults: () => baseVaultService.getAllVaults(),
      vaultExists: (name) => baseVaultService.vaultExists(name),
      findRegistryNameConflicts: () => baseVaultService.findRegistryNameConflicts(),
      createVault: (name) => baseVaultService.createVault(name),
      switchVault: (name) => baseVaultService.switchVault(name),
      deleteVault: (name) => baseVaultService.deleteVault(name),
      syncRegistryWithDisk: () => baseVaultService.syncRegistryWithDisk(),
      ensureVaultsRegistered: (names) => baseVaultService.ensureVaultsRegistered(names),
      pruneOrphanRegistryVaults: (scopes, names) =>
        baseVaultService.pruneOrphanRegistryVaults(scopes, names),
      renameVault: (oldNameOrId, newName) => baseVaultService.renameVault(oldNameOrId, newName),
      estimateVaultLocalSyncBytes: (nameOrId) =>
        baseVaultService.estimateVaultLocalSyncBytes(nameOrId)
    }
    const { getMobileDiaryEmbeddingCallback } = await import('./mobile-diary-embedding.service')
    const baseEmbeddingCb = getMobileDiaryEmbeddingCallback()
    const scopedEmbeddingCb: IEmbeddingCallback = {
      reEmbedDiary: (p) =>
        baseEmbeddingCb.reEmbedDiary({
          ...p,
          vaultName: p.vaultName ?? params.vaultName
        }),
      enqueueDiaryEmbed: baseEmbeddingCb.enqueueDiaryEmbed
        ? (p) =>
            baseEmbeddingCb.enqueueDiaryEmbed!({
              ...p,
              vaultName: p.vaultName ?? params.vaultId
            })
        : undefined,
      deleteEmbeddingsBySource: (sourceType, sourceId) =>
        baseEmbeddingCb.deleteEmbeddingsBySource(sourceType, sourceId)
    }
    const shadowIndexSyncService = new ShadowIndexSyncService(
      shadowRepo,
      params.scopedPathService,
      fixedVaultService,
      fs,
      scopedEmbeddingCb
    )
    diaryService = new DiaryService(
      shadowRepo,
      fileSyncService,
      shadowIndexSyncService,
      new VaultIndexServiceImpl()
    )
  }

  return {
    async searchFTS(query: string, limit?: number) {
      const results = await shadowRepo.searchFTS(query, limit)
      const allRecords = await shadowRepo.getAllRecords()
      const idToDateMap = new Map(allRecords.map((r) => [r.id, r.date]))
      return results.map((r) => ({
        date: idToDateMap.get(r.rowid) || '',
        contentSnippet: r.contentSnippet,
        tags: r.tags,
        rankScore: r.rankScore
      }))
    },
    async listInDateRange(startDate: string, endDate: string) {
      const rows = await shadowRepo.findByDateRange(startDate, endDate)
      return rows.map((row) => ({
        date: row.date,
        preview: diaryPreviewFromRaw((row as { rawContent?: string | null }).rawContent)
      }))
    },
    async readByDates(dates: string[]) {
      if (!diaryService) return dates.map((date) => ({ date, content: null }))
      const rows: Array<{ date: string; content: string | null }> = []
      for (const date of dates) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          rows.push({ date, content: null })
          continue
        }
        const diary = await diaryService.findByDate(parseDateStr(date))
        rows.push({ date, content: diary?.content ?? null })
      }
      return rows
    },
    async writeEntry(date: string, content: string) {
      if (!diaryService) {
        return { ok: false as const, message: 'Error: Diary service not available.' }
      }
      try {
        await diaryService.create({
          date: parseDateStr(date),
          ...prepareDiarySearcherWrite(content)
        })
        return { ok: true as const }
      } catch (e) {
        if (e instanceof Error && e.name === 'DiaryDateConflictError') {
          return {
            ok: false as const,
            message: `Error: A diary entry for ${date} already exists. Use diary_edit to modify it.`
          }
        }
        return {
          ok: false as const,
          message: `Error: Failed to create diary entry: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    },
    async editEntry({ date, content, mode }) {
      if (!diaryService) {
        return { ok: false as const, message: 'Error: Diary service not available.' }
      }
      try {
        const existing = await diaryService.findByDate(parseDateStr(date))
        if (!existing?.id) {
          return {
            ok: false as const,
            message: `Error: Diary entry for ${date} does not exist. Use diary_write to create it instead.`
          }
        }
        await diaryService.update(
          existing.id,
          prepareDiarySearcherEdit(existing.content, content, mode)
        )
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          message: `Error: Failed to edit diary: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    },
    async deleteEntry(date: string) {
      if (!diaryService) {
        return { ok: false as const, message: 'Error: Diary service not available.' }
      }
      try {
        const existing = await diaryService.findByDate(parseDateStr(date))
        if (!existing?.id) {
          return {
            ok: false as const,
            message: `Error: Could not find diary entry for ${date} to delete.`
          }
        }
        await diaryService.delete(existing.id)
        return { ok: true as const }
      } catch (e) {
        return {
          ok: false as const,
          message: `Error: Failed to delete diary: ${e instanceof Error ? e.message : String(e)}`
        }
      }
    }
  }
}

export async function buildMobileMcpToolContext(
  deps: MobileMcpToolContextDeps,
  targetVault?: string
): Promise<ToolContext> {
  const resolved = await resolveMobileTargetVault(deps, targetVault)
  const vaultName = resolved.name
  const vaultId = resolved.id
  const now = Date.now()

  const cached = mobileMcpToolContextCache.get(vaultId)
  if (cached && cached.expiresAt > now) {
    return cached.context
  }

  const [baseUserConfig, mcpConfig] = await Promise.all([
    buildMobileStreamUserConfig(deps.settingsManager, true),
    deps.settingsManager.get<McpServerConfig>('mcp_server_config').catch(() => null)
  ])
  const mcpDisabledToolIds = Array.isArray(mcpConfig?.disabledToolIds)
    ? mcpConfig.disabledToolIds
    : []
  const baseAgentGate = deps.getAgentGate?.()
  // 外部 MCP 客户端调用不在应用内弹确认：写/删除直接执行，仅保留 Deny 规则。
  const agentGate = baseAgentGate ? createAutoApproveAgentGate(baseAgentGate) : baseAgentGate
  const userConfig = {
    ...baseUserConfig,
    mcpDisabledToolIds
  }

  const usePinnedVaultRuntime = Boolean(targetVault?.trim()) || resolved.isScoped
  const scopedPathService =
    usePinnedVaultRuntime && typeof deps.pathService.forVault === 'function'
      ? deps.pathService.forVault(vaultName)
      : deps.pathService
  const diarySearcher = usePinnedVaultRuntime
    ? ((await createScopedMobileDiarySearcher({
        vaultId,
        vaultName,
        scopedPathService,
        fileSystem: deps.fileSystem,
        vaultService: deps.vaultService
      })) ?? deps.getDiarySearcher())
    : deps.getDiarySearcher()

  const drizzleDb = deps.drizzleDb as AppDatabase | undefined
  if (!drizzleDb) {
    return {
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId,
      vaultName,
      userConfig,
      diarySearcher,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate
    }
  }

  try {
    const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
    const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
    const msgRepo = new MessageRepository(drizzleDb)
    const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb, () => vaultId)

    const globalModels = await deps.settingsManager.get<any>('global_models')
    const providers = (await deps.settingsManager.get<any[]>('ai_providers')) || []
    const embeddingProviderId = globalModels?.globalEmbeddingProviderId
    const embeddingModelId = globalModels?.globalEmbeddingModelId

    let embAdapter: EmbeddingAdapter | undefined
    let embeddingProvider: ReturnType<AIProviderRegistry['getOrUpdateProvider']> | undefined

    if (embeddingProviderId && embeddingModelId && embeddingModelId !== 'off') {
      const embConfig = providers.find((p) => p.id === embeddingProviderId && p.isEnabled !== false)
      if (embConfig) {
        embeddingProvider = AIProviderRegistry.getInstance().getOrUpdateProvider(embConfig)
        embAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
      }
    }

    let dedupService: MemoryDeduplicationServiceImpl | undefined
    if (embAdapter && isConfiguredProviderId(globalModels?.globalDialogueProviderId)) {
      const dialogueModelId = globalModels?.globalDialogueModelId
      const dialogueConfig = isConfiguredDialogueModelId(dialogueModelId)
        ? providers.find(
            (row) => row.id === globalModels.globalDialogueProviderId && row.isEnabled !== false
          )
        : undefined
      if (dialogueConfig && dialogueModelId) {
        const chatProvider = AIProviderRegistry.getInstance().getOrUpdateProvider(dialogueConfig)
        dedupService = new MemoryDeduplicationServiceImpl(
          embAdapter,
          dbAdapter,
          chatProvider,
          dialogueModelId.trim()
        )
      }
    }

    const rawDataRuntime = await import('./mobile-raw-data-source.runtime')
    const rawDataSourceManager = usePinnedVaultRuntime
      ? (rawDataRuntime.getMobileRawDataSourceManagerForVault(vaultName, scopedPathService) ??
        rawDataRuntime.getMobileRawDataSourceManager() ??
        undefined)
      : (rawDataRuntime.getMobileRawDataSourceManager() ?? undefined)

    const context = syncMcpToolUserConfig({
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId,
      vaultName,
      userConfig,
      diarySearcher,
      embeddingService: embAdapter,
      vectorStore: dbAdapter,
      messageSearcher: dbAdapter,
      summaryReader: dbAdapter,
      deduplicationService: dedupService,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate,
      skillsReader: (await import('./mobile-agent-skills.service')).createMobileSkillsReader(),
      rawDataSourceManager
    })

    mobileMcpToolContextCache.set(vaultId, {
      context,
      expiresAt: now + MCP_CONTEXT_CACHE_TTL_MS
    })

    return context
  } catch (e) {
    logger.warn(
      '[buildMobileMcpToolContext] DB adapters unavailable, using degraded context',
      e as Error
    )
    return {
      sessionId: MCP_EXTERNAL_SESSION_ID,
      vaultId,
      vaultName,
      userConfig,
      diarySearcher,
      webSearchResultFetcher: deps.webSearchResultFetcher,
      fetchSearchPage: deps.fetchSearchPage,
      agentGate
    }
  }
}
