import { net, app } from 'electron'
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
import { getAgentGate } from '../services/agent-gate.service'
import { resolveActiveWorkspaceToolContext } from '../services/agent-workspace-tool-context'
import { fileSystem, pathService, vaultService } from './vault.ipc'
import { settingsManager } from './settings.ipc'
import {
  AIProviderConfig,
  GlobalModelsConfig,
  buildDiaryWritingGuidelinesForSystemPrompt,
  logger,
  formatUserCardFromProfile,
  isConfiguredProviderId,
  isConfiguredDialogueModelId,
  normalizeToolManagementConfig,
  normalizeEmojiToolConfig,
  resolveAssistantEmojiConfig,
  resolveAppUiLanguageFromSystemLocale,
  type AssistantEmojiPrefs,
  DEFAULT_TOOL_MANAGEMENT_CONFIG,
  resolveWebSearchEnabled,
  BAISHOU_AGENT_GATE_CONFIG_KEY,
  DEFAULT_BAISHOU_AGENT_GATE_CONFIG,
  type BaishouAgentGateConfig,
  coalesceConfiguredId,
  requireResolvedDialogueModel,
  type ResolvedDialogueModel
} from '@baishou/shared'

import { searchService } from '../services/search.service'
import {
  AgentSessionService,
  ToolRegistry,
  AIProviderRegistry,
  htmlToPlainText,
  EMPTY_WEB_PAGE_MESSAGE,
  UNAVAILABLE_WEB_PAGE_MESSAGE,
  webSearchConfigToUserConfig,
  DatabaseAdapter,
  EmbeddingAdapter,
  MemoryDeduplicationServiceImpl,
  MCP_EXTERNAL_SESSION_ID,
  syncMcpToolUserConfig,
  type ToolContext
} from '@baishou/ai'
import { createDiarySearcher } from './agent-diary-searcher'
import { getRawDataSourceManager } from '../services/raw-data-source.runtime'
export { createDiarySearcher }

export const toolRegistry = new ToolRegistry()
export const agentService = new AgentSessionService()

type AgentManagers = {
  sessionManager: SessionManagerService
  assistantManager: AssistantManagerService
  attachmentManager: DesktopAttachmentManagerService
  realMessageRepo: MessageRepository
  realSessionRepo: SessionRepository
  realSnapshotRepo: SnapshotRepository
  realAssistantRepo: AssistantRepository
}

let cachedAgentManagers: AgentManagers | null = null
let cachedAgentManagersDb: ReturnType<typeof connectionManager.getDb> | null = null

/** DB 热切换后丢弃缓存（通常 setDb 换引用后会自动重建；显式调用更稳妥） */
export function invalidateAgentManagers(): void {
  cachedAgentManagers = null
  cachedAgentManagersDb = null
}

// 按当前 DB 句柄缓存：跨 IPC 共享 SessionManager dirty，使同步前 flushPending 生效
export function getAgentManagers(): AgentManagers {
  const db = connectionManager.getDb()
  if (cachedAgentManagers && cachedAgentManagersDb === db) {
    return cachedAgentManagers
  }

  const realSessionRepo = new SessionRepository(db)
  const sessionFileService = new SessionFileService(pathService, fileSystem, getRawDataSourceManager())
  const sessionSyncService = new SessionSyncService(realSessionRepo, sessionFileService)
  const sessionManager = new SessionManagerService(
    realSessionRepo,
    sessionFileService,
    sessionSyncService,
    {
      onBeforeWrite: (sessionId) => {
        void (async () => {
          try {
            const { sessionWatcher } = await import('../services/session-watcher.service')
            const vaultPath = await pathService.getActiveVaultPath()
            if (!vaultPath) return
            const { join } = await import('path')
            sessionWatcher.suppressPath(join(vaultPath, 'Sessions', `${sessionId}.json`))
          } catch {
            // watcher 未启动时忽略
          }
        })()
      }
    }
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

  cachedAgentManagersDb = db
  cachedAgentManagers = {
    sessionManager,
    assistantManager,
    attachmentManager,
    realMessageRepo,
    realSessionRepo,
    realSnapshotRepo,
    realAssistantRepo
  }
  return cachedAgentManagers
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

export async function resolveEmbeddingSystemModels(globalModels?: GlobalModelsConfig | null): Promise<{
  hasEmbeddingModel: boolean
  embeddingProvider?: ResolvedProvider
  embeddingModelId?: string
}> {
  const models = globalModels ?? (await settingsManager.get<GlobalModelsConfig>('global_models'))
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
  emojiGroupId?: string | null
  assistantEmojiPrefs?: AssistantEmojiPrefs
}): Promise<Record<string, unknown>> {
  const ragConfig = await settingsManager.get<any>('rag_config')
  const toolManagementConfig = normalizeToolManagementConfig(
    (await settingsManager.get<any>('tool_management_config')) ?? DEFAULT_TOOL_MANAGEMENT_CONFIG
  )
  const behaviorConfig =
    (await settingsManager.get<any>('agent_behavior')) ??
    (await settingsManager.get<any>('agent_behavior_config'))
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

  const storedSearchMode = await settingsManager.get<boolean>('search_mode_enabled')
  const appSettings = (await settingsManager.get<{ language?: string }>('settings')) || {}
  const featureSettings =
    (await settingsManager.get<{ language?: string }>('feature_settings')) || {}
  const rawLanguage = featureSettings.language || appSettings.language
  const locale =
    !rawLanguage || rawLanguage === 'system'
      ? resolveAppUiLanguageFromSystemLocale(app.getLocale())
      : rawLanguage

  const agentGateStored =
    (await settingsManager.get<BaishouAgentGateConfig>(BAISHOU_AGENT_GATE_CONFIG_KEY)) ??
    DEFAULT_BAISHOU_AGENT_GATE_CONFIG
  const baishou_agent_gate_config: BaishouAgentGateConfig = {
    ...agentGateStored,
    exclusionList: [...(agentGateStored.exclusionList ?? [])],
    allowlist: [...(agentGateStored.allowlist ?? [])]
  }

  return {
    ragEnabled: ragConfig?.ragEnabled ?? true,
    hasEmbeddingModel,
    disabledToolIds: toolManagementConfig.disabledToolIds,
    recentCount:
      options?.assistantContextWindow !== undefined
        ? options.assistantContextWindow < 0
          ? 0
          : options.assistantContextWindow
        : (behaviorConfig?.agentContextWindowSize ?? 30),
    web_search_enabled: resolveWebSearchEnabled(options?.searchMode, storedSearchMode),
    ...webSearchConfigToUserConfig(webSearchConfig),
    userCard,
    diaryAiWritingPrompt: buildDiaryWritingGuidelinesForSystemPrompt(diaryTemplateConfig),
    agentGuidelines:
      typeof behaviorConfig?.agentGuidelines === 'string' &&
      behaviorConfig.agentGuidelines.trim().length > 0
        ? behaviorConfig.agentGuidelines.trim()
        : undefined,
    emojiConfig: resolveAssistantEmojiConfig(
      normalizeEmojiToolConfig(toolManagementConfig.emojiConfig),
      options?.assistantEmojiPrefs ?? { emojiGroupId: options?.emojiGroupId }
    ),
    locale,
    baishou_agent_gate_config
  }
}

/** 流式对话权威模型链：伙伴 → 请求 → 全局 → 错误（不伪造默认模型） */
export async function resolveStreamDialogueSelection(params: {
  sessionId?: string
  requestedProviderId?: string
  requestedModelId?: string
}): Promise<ResolvedDialogueModel & { providerId: string; modelId: string }> {
  const globalModels = await settingsManager.get<GlobalModelsConfig>('global_models')
  let assistantProviderId: string | undefined
  let assistantModelId: string | undefined

  if (params.sessionId) {
    try {
      const { realSessionRepo, realAssistantRepo } = getAgentManagers()
      const session = await realSessionRepo.getSessionById(params.sessionId)
      if (session?.assistantId) {
        const assistant = await realAssistantRepo.findById(session.assistantId)
        assistantProviderId = assistant?.providerId ?? undefined
        assistantModelId = assistant?.modelId ?? undefined
      }
    } catch (e: any) {
      logger.warn('[resolveStreamDialogueSelection] failed to load assistant:', e?.message || e)
    }
  }

  return requireResolvedDialogueModel({
    assistantProviderId,
    assistantModelId,
    requestedProviderId: params.requestedProviderId,
    requestedModelId: params.requestedModelId,
    globalDialogueProviderId: globalModels?.globalDialogueProviderId,
    globalDialogueModelId: globalModels?.globalDialogueModelId
  })
}

/**
 * 构建 Agent 流式调用所需的通用配置
 * @param assistantContextWindow 助手的上下文轮数配置，优先于全局配置
 */
export async function buildStreamConfig(
  requestedProviderId?: string,
  requestedModelId?: string,
  searchMode?: boolean,
  assistantContextWindow?: number,
  assistantEmojiPrefs?: AssistantEmojiPrefs
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
    hasEmbeddingModel,
    assistantEmojiPrefs
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

  const context = syncMcpToolUserConfig({
    sessionId: MCP_EXTERNAL_SESSION_ID,
    vaultName,
    userConfig,
    diarySearcher: createDiarySearcher(),
    embeddingService: embAdapter,
    vectorStore: dbAdapter,
    messageSearcher: dbAdapter,
    summaryReader: dbAdapter,
    deduplicationService: dedupService,
    webSearchResultFetcher: createWebSearchResultFetcher(),
    fetchSearchPage: createFetchSearchPage(),
    agentGate: await getAgentGate(),
    rawDataSourceManager: (await import('../services/raw-data-source.runtime')).getRawDataSourceManager()
  })

  const activeWorkspace = resolveActiveWorkspaceToolContext()
  if (activeWorkspace) {
    context.workspace = activeWorkspace
  }

  mcpToolContextCache = {
    vaultName,
    context,
    expiresAt: now + MCP_CONTEXT_CACHE_TTL_MS
  }

  return context
}
