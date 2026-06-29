import { net } from 'electron'
import {
  SessionRepository,
  AssistantRepository,
  MessageRepository,
  connectionManager,
  UserProfileRepository,
  SnapshotRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database-desktop'
import {
  SessionFileService,
  SessionSyncService,
  SessionManagerService,
  AssistantFileService,
  AssistantManagerService
} from '@baishou/core-desktop'
import { DesktopAttachmentManagerService } from '../services/desktop-attachment-manager.service'
import { fileSystem, pathService, getActiveVaultShadowRepo, vaultService } from './vault.ipc'
import { settingsManager } from './settings.ipc'
import {
  AIProviderConfig,
  GlobalModelsConfig,
  formatDiaryPreviewText,
  buildDiaryWritingGuidelinesForSystemPrompt,
  prepareDiaryAppendContent,
  prepareDiaryWriteContent,
  logger,
  parseDateStr,
  formatUserCardFromProfile,
  isConfiguredProviderId,
  isConfiguredDialogueModelId
} from '@baishou/shared'

function previewDiaryRow(raw: string | null | undefined): string {
  const cleaned = formatDiaryPreviewText(raw)
  const firstLine = cleaned
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#') && !l.startsWith('---'))
  if (!firstLine) return '(empty)'
  return firstLine.length > 80 ? `${firstLine.slice(0, 80)}...` : firstLine
}
import { searchService } from '../services/search.service'
import {
  AgentSessionService,
  ToolRegistry,
  AIProviderRegistry,
  htmlToPlainText,
  EMPTY_WEB_PAGE_MESSAGE,
  UNAVAILABLE_WEB_PAGE_MESSAGE,
  webSearchConfigToUserConfig,
  mergeDiaryTags,
  DatabaseAdapter,
  EmbeddingAdapter,
  MemoryDeduplicationServiceImpl,
  type ToolContext
} from '@baishou/ai'
import { getDiaryManager } from './diary.ipc'

export const toolRegistry = new ToolRegistry()
export const agentService = new AgentSessionService()

// 动态工厂：确保每一次响应 IPC 时都锁定在用户当前所切环境的 Database 句柄上
export function getAgentManagers() {
  const db = connectionManager.getDb()

  const realSessionRepo = new SessionRepository(db)
  const sessionFileService = new SessionFileService(pathService, fileSystem)
  const sessionSyncService = new SessionSyncService(realSessionRepo, sessionFileService)
  const sessionManager = new SessionManagerService(
    realSessionRepo,
    sessionFileService,
    sessionSyncService
  )

  const realAssistantRepo = new AssistantRepository(db)
  const assistantFileService = new AssistantFileService(pathService, fileSystem)
  const attachmentManager = new DesktopAttachmentManagerService(pathService)
  const assistantManager = new AssistantManagerService(
    realAssistantRepo,
    assistantFileService,
    attachmentManager
  )

  const realMessageRepo = new MessageRepository(db)
  const realSnapshotRepo = new SnapshotRepository(db)

  return {
    sessionManager,
    assistantManager,
    realMessageRepo,
    realSessionRepo,
    realSnapshotRepo,
    realAssistantRepo
  }
}

/** 创建日记 FTS5 搜索适配器，注入到 ToolContext 供 diary_search 工具使用 */
export function createDiarySearcher() {
  try {
    const shadowRepo = getActiveVaultShadowRepo()
    return {
      async searchFTS(query: string, limit?: number) {
        const results = await shadowRepo.searchFTS(query, limit)
        // 需要将 rowid 映射为 date 字符串
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
          preview: previewDiaryRow((row as { rawContent?: string | null }).rawContent)
        }))
      },
      async readByDates(dates: string[]) {
        const diaryService = getDiaryManager()
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
      async writeEntry(date: string, content: string, tags?: string) {
        try {
          const diaryService = getDiaryManager()
          const templateConfig = (await settingsManager.get<any>('diary_template_config')) || {}
          const tagsStr = tags
            ?.split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .join(',')
          await diaryService.create({
            date: parseDateStr(date),
            content: prepareDiaryWriteContent(content, templateConfig, new Date()),
            ...(tagsStr ? { tags: tagsStr } : {})
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
      async editEntry({ date, content, mode, tags }) {
        try {
          const diaryService = getDiaryManager()
          const existing = await diaryService.findByDate(parseDateStr(date))
          if (!existing?.id) {
            return {
              ok: false as const,
              message: `Error: Diary entry for ${date} does not exist. Use diary_write to create it instead.`
            }
          }

          let finalContent = content
          if (mode === 'append') {
            const templateConfig = (await settingsManager.get<any>('diary_template_config')) || {}
            finalContent = prepareDiaryAppendContent(
              existing.content,
              content,
              templateConfig,
              new Date()
            )
          }

          await diaryService.update(existing.id, {
            content: finalContent,
            ...(tags ? { tags: mergeDiaryTags(existing.tags, tags) } : {})
          })
          return { ok: true as const }
        } catch (e) {
          return {
            ok: false as const,
            message: `Error: Failed to edit diary: ${e instanceof Error ? e.message : String(e)}`
          }
        }
      },
      async deleteEntry(date: string) {
        try {
          const diaryService = getDiaryManager()
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
  } catch (e) {
    logger.warn(
      '[Agent] createDiarySearcher failed; diary CRUD tools will be unavailable:',
      e instanceof Error ? e.message : String(e)
    )
    return undefined
  }
}

const WEB_FETCH_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

async function fetchUrlHtmlViaBrowserWindow(url: string): Promise<string> {
  const uid = `fetch-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  try {
    return await searchService.openUrlInSearchWindow(uid, url)
  } finally {
    await searchService.closeSearchWindow(uid)
  }
}

async function fetchUrlHtmlViaNet(url: string): Promise<string> {
  const response = await net.fetch(url, {
    headers: { 'User-Agent': WEB_FETCH_USER_AGENT }
  })

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} - ${response.statusText}`)
  }

  return response.text()
}

/**
 * 创建网页内容获取器。
 * 负责抓取并转换为正文，不在此处截断长度；
 * 截取长度由设置项 webSearchPlainSnippetLength 经 userConfig 注入到 url_read / web_search 工具。
 */
export function createWebSearchResultFetcher() {
  return async (url: string): Promise<string> => {
    try {
      let html = ''
      try {
        html = await fetchUrlHtmlViaNet(url)
      } catch (netErr: any) {
        logger.warn(
          `[createWebSearchResultFetcher] net.fetch failed for ${url}, falling back to hidden BrowserWindow:`,
          netErr
        )
        html = await fetchUrlHtmlViaBrowserWindow(url)
      }

      const plainText = htmlToPlainText(html)
      return plainText || EMPTY_WEB_PAGE_MESSAGE
    } catch (e: any) {
      logger.debug(`Web fetch skipped for ${url}:`, e)
      return UNAVAILABLE_WEB_PAGE_MESSAGE
    }
  }
}

/**
 * 创建搜索页面获取函数，使用 SearchService 的 BrowserWindow 获取搜索结果页面
 */
export function createFetchSearchPage() {
  return async (url: string): Promise<string> => {
    const uid = `search-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    try {
      const html = await searchService.openUrlInSearchWindow(uid, url)
      return html
    } finally {
      await searchService.closeSearchWindow(uid)
    }
  }
}

export async function getActiveProvider(requestedProviderId?: string) {
  const providers = (await settingsManager.get<AIProviderConfig[]>('ai_providers')) || []
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

  const providerId = requestedProviderId || globalModels?.globalDialogueProviderId
  const config = providers.find((p: AIProviderConfig) => p.id === providerId)

  const actualConfig = config || providers.find((p: AIProviderConfig) => p.isEnabled)
  if (!actualConfig) throw new Error('No active provider configured')

  const registry = AIProviderRegistry.getInstance()
  const provider = registry.getOrUpdateProvider(actualConfig)
  if (!provider) throw new Error(`Failed to instantiate provider ${actualConfig.id}`)
  return provider
}

type ResolvedProvider = Awaited<ReturnType<typeof getActiveProvider>>

async function resolveEmbeddingSystemModels(globalModels?: GlobalModelsConfig | null): Promise<{
  hasEmbeddingModel: boolean
  embeddingProvider?: ResolvedProvider
  embeddingModelId?: string
}> {
  const models =
    globalModels ?? (await settingsManager.get<GlobalModelsConfig>('global_models'))
  const embeddingProviderId = models?.globalEmbeddingProviderId
  let embeddingModelId = models?.globalEmbeddingModelId
  let embeddingProvider: ResolvedProvider | undefined

  if (embeddingProviderId && embeddingModelId && embeddingModelId !== 'off') {
    try {
      embeddingProvider = await getActiveProvider(embeddingProviderId)
    } catch {
      embeddingModelId = undefined
    }
  } else {
    embeddingModelId = undefined
  }

  return {
    hasEmbeddingModel: Boolean(embeddingProvider && embeddingModelId),
    embeddingProvider,
    embeddingModelId
  }
}

/** 从设置构建 Agent/MCP 工具上下文用的 userConfig，不依赖对话模型 Provider */
export async function buildAgentUserConfigFromSettings(options?: {
  assistantContextWindow?: number
  searchMode?: boolean
  globalModels?: GlobalModelsConfig | null
  hasEmbeddingModel?: boolean
}): Promise<Record<string, unknown>> {
  const ragConfig = await settingsManager.get<any>('rag_config')
  const toolManagementConfig = await settingsManager.get<any>('tool_management_config')
  const behaviorConfig = await settingsManager.get<any>('agent_behavior_config')
  const webSearchConfig = await settingsManager.get<any>('web_search_config')
  const diaryTemplateConfig = (await settingsManager.get<any>('diary_template_config')) || {}

  const hasEmbeddingModel =
    options?.hasEmbeddingModel ??
    (await resolveEmbeddingSystemModels(options?.globalModels)).hasEmbeddingModel

  let userCard: string | undefined
  try {
    const db = connectionManager.getDb()
    const profileRepo = new UserProfileRepository(db)
    const profile = await profileRepo.getProfile()
    userCard = formatUserCardFromProfile(profile)
  } catch (e: any) {
    logger.warn('[buildAgentUserConfigFromSettings] Failed to load user profile:', e.message || e)
  }

  return {
    ragEnabled: ragConfig?.ragEnabled ?? true,
    hasEmbeddingModel,
    disabledToolIds: toolManagementConfig?.disabledToolIds || [],
    recentCount:
      options?.assistantContextWindow !== undefined
        ? options.assistantContextWindow < 0
          ? 0
          : options.assistantContextWindow
        : (behaviorConfig?.agentContextWindowSize ?? 30),
    web_search_enabled: options?.searchMode ?? false,
    ...webSearchConfigToUserConfig(webSearchConfig),
    userCard,
    diaryAiWritingPrompt: buildDiaryWritingGuidelinesForSystemPrompt(diaryTemplateConfig)
  }
}

/**
 * 构建 Agent 流式调用所需的通用配置
 * @param assistantContextWindow 助手的上下文轮数配置，优先于全局配置
 */
export async function buildStreamConfig(
  requestedProviderId?: string,
  requestedModelId?: string,
  searchMode?: boolean,
  assistantContextWindow?: number
) {
  const provider = await getActiveProvider(requestedProviderId)
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')

  const namingProviderId = globalModels?.globalNamingProviderId || provider.config.id
  let namingModelId =
    globalModels?.globalNamingModelId ||
    requestedModelId ||
    globalModels?.globalDialogueModelId ||
    'deepseek-chat'
  let namingProvider = provider
  if (namingProviderId !== provider.config.id) {
    try {
      namingProvider = await getActiveProvider(namingProviderId)
    } catch (e) {
      namingModelId = requestedModelId || globalModels?.globalDialogueModelId || 'deepseek-chat'
    }
  }

  const summaryProviderId = globalModels?.globalSummaryProviderId || provider.config.id
  let summaryModelId =
    globalModels?.globalSummaryModelId ||
    requestedModelId ||
    globalModels?.globalDialogueModelId ||
    'deepseek-chat'
  let summaryProvider = provider
  if (summaryProviderId !== provider.config.id) {
    try {
      summaryProvider = await getActiveProvider(summaryProviderId)
    } catch (e) {
      summaryModelId = requestedModelId || globalModels?.globalDialogueModelId || 'deepseek-chat'
    }
  }

  const { hasEmbeddingModel, embeddingProvider, embeddingModelId } =
    await resolveEmbeddingSystemModels(globalModels)

  const userConfig = await buildAgentUserConfigFromSettings({
    assistantContextWindow,
    searchMode,
    globalModels,
    hasEmbeddingModel
  })

  const namingModelConfigured =
    isConfiguredProviderId(globalModels?.globalNamingProviderId) &&
    isConfiguredDialogueModelId(globalModels?.globalNamingModelId)

  return {
    provider,
    globalModels,
    systemModels: {
      namingProvider,
      namingModelId,
      namingModelConfigured,
      summaryProvider,
      summaryModelId,
      embeddingProvider,
      embeddingModelId
    },
    userConfig
  }
}

/** MCP 外部工具调用上下文：绑定当前活跃工作空间，与应用内 Agent 对齐 */
const MCP_CONTEXT_CACHE_TTL_MS = 5000
let mcpToolContextCache: {
  vaultName: string
  context: ToolContext
  expiresAt: number
} | null = null

export function invalidateMcpToolContextCache(): void {
  mcpToolContextCache = null
}

export async function buildMcpToolContext(): Promise<ToolContext> {
  const activeVault = vaultService.getActiveVault()
  const vaultName = activeVault?.name || 'Personal'
  const now = Date.now()

  if (
    mcpToolContextCache &&
    mcpToolContextCache.vaultName === vaultName &&
    mcpToolContextCache.expiresAt > now
  ) {
    return mcpToolContextCache.context
  }

  const userConfig = await buildAgentUserConfigFromSettings()
  const { embeddingProvider, embeddingModelId } = await resolveEmbeddingSystemModels()

  const drizzleDb = connectionManager.getDb()
  const clientExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
  const hsRepo = new SqliteHybridSearchRepository(clientExecutor)
  const msgRepo = new MessageRepository(drizzleDb)
  const dbAdapter = new DatabaseAdapter(hsRepo, msgRepo, drizzleDb)

  let embAdapter: EmbeddingAdapter | undefined
  if (embeddingProvider && embeddingModelId) {
    embAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)
  }

  let dedupService: MemoryDeduplicationServiceImpl | undefined
  if (embAdapter && embeddingProvider && embeddingModelId) {
    dedupService = new MemoryDeduplicationServiceImpl(
      embAdapter,
      dbAdapter,
      embeddingProvider,
      embeddingModelId
    )
  }

  const context: ToolContext = {
    sessionId: 'mcp-external',
    vaultName,
    userConfig,
    diarySearcher: createDiarySearcher(),
    embeddingService: embAdapter,
    vectorStore: dbAdapter,
    messageSearcher: dbAdapter,
    summaryReader: dbAdapter,
    deduplicationService: dedupService,
    webSearchResultFetcher: createWebSearchResultFetcher(),
    fetchSearchPage: createFetchSearchPage()
  }

  mcpToolContextCache = {
    vaultName,
    context,
    expiresAt: now + MCP_CONTEXT_CACHE_TTL_MS
  }

  return context
}
