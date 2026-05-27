import { net } from 'electron'
import {
  SessionRepository,
  AssistantRepository,
  MessageRepository,
  connectionManager,
  shadowConnectionManager,
  ShadowIndexRepository,
  UserProfileRepository,
  SnapshotRepository
} from '@baishou/database'
import {
  SessionFileService,
  SessionSyncService,
  SessionManagerService,
  AssistantFileService,
  AssistantManagerService,
  AttachmentManagerService
} from '@baishou/core'
import { pathService } from './vault.ipc'
import { settingsManager } from './settings.ipc'
import { AIProviderConfig, GlobalModelsConfig, logger } from '@baishou/shared'
import { searchService } from '../services/search.service'
import {
  AgentSessionService,
  ToolRegistry,
  AIProviderRegistry,
  htmlToPlainText,
  EMPTY_WEB_PAGE_MESSAGE,
  UNAVAILABLE_WEB_PAGE_MESSAGE,
  webSearchConfigToUserConfig
} from '@baishou/ai'

export const toolRegistry = new ToolRegistry()
export const agentService = new AgentSessionService()

// 动态工厂：确保每一次响应 IPC 时都锁定在用户当前所切环境的 Database 句柄上
export function getAgentManagers() {
  const db = connectionManager.getDb()

  const realSessionRepo = new SessionRepository(db)
  const sessionFileService = new SessionFileService(pathService)
  const sessionSyncService = new SessionSyncService(realSessionRepo, sessionFileService)
  const sessionManager = new SessionManagerService(
    realSessionRepo,
    sessionFileService,
    sessionSyncService
  )

  const realAssistantRepo = new AssistantRepository(db)
  const assistantFileService = new AssistantFileService(pathService)
  const attachmentManager = new AttachmentManagerService(pathService)
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
    const shadowDb = shadowConnectionManager.getDb()
    const shadowRepo = new ShadowIndexRepository(shadowDb)
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
      }
    }
  } catch {
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
        html = await fetchUrlHtmlViaBrowserWindow(url)
      } catch (browserErr: any) {
        logger.warn(
          `[createWebSearchResultFetcher] BrowserWindow fetch failed for ${url}, falling back to net.fetch:`,
          browserErr
        )
        html = await fetchUrlHtmlViaNet(url)
      }

      const plainText = htmlToPlainText(html)
      return plainText || EMPTY_WEB_PAGE_MESSAGE
    } catch (e: any) {
      logger.error(`Failed to fetch URL: ${url}`, e)
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

  // 获取用户身份卡信息
  let userCard: string | undefined
  try {
    const db = connectionManager.getDb()
    const profileRepo = new UserProfileRepository(db)
    const profile = await profileRepo.getProfile()

    if (profile && profile.activePersonaId && profile.personas[profile.activePersonaId]) {
      const activePersona = profile.personas[profile.activePersonaId]
      const facts = activePersona.facts

      // 将身份卡的 facts 转换为可读的字符串格式
      if (facts && Object.keys(facts).length > 0) {
        const factsList = Object.entries(facts)
          .filter(([_, value]) => value && value.trim().length > 0)
          .map(([key, value]) => `- ${key}: ${value}`)
          .join('\n')

        if (factsList) {
          userCard = `[User Identity Card / Persona: ${activePersona.id}]\n${factsList}`
        }
      }
    }
  } catch (e: any) {
    logger.warn('[buildStreamConfig] Failed to load user profile:', e.message || e)
  }

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

  const ragConfig = await settingsManager.get<any>('rag_config')
  const toolManagementConfig = await settingsManager.get<any>('tool_management_config')
  const behaviorConfig = await settingsManager.get<any>('agent_behavior_config')
  const webSearchConfig = await settingsManager.get<any>('web_search_config')

  const embeddingProviderId = globalModels?.globalEmbeddingProviderId
  let embeddingModelId = globalModels?.globalEmbeddingModelId
  let embeddingProvider: any = undefined

  if (embeddingProviderId && embeddingModelId && embeddingModelId !== 'off') {
    try {
      embeddingProvider = await getActiveProvider(embeddingProviderId)
    } catch (e) {
      embeddingModelId = undefined
    }
  } else {
    embeddingModelId = undefined
  }

  const hasEmbeddingModel = !!embeddingProvider && !!embeddingModelId

  const userConfig = {
    ragEnabled: ragConfig?.ragEnabled ?? true,
    hasEmbeddingModel,
    disabledToolIds: toolManagementConfig?.disabledToolIds || [],
    recentCount:
      assistantContextWindow !== undefined
        ? assistantContextWindow < 0
          ? 0
          : assistantContextWindow
        : (behaviorConfig?.agentContextWindowSize ?? 30),
    web_search_enabled: searchMode ?? false,
    ...webSearchConfigToUserConfig(webSearchConfig),
    userCard
  }

  return {
    provider,
    globalModels,
    systemModels: {
      namingProvider,
      namingModelId,
      summaryProvider,
      summaryModelId,
      embeddingProvider,
      embeddingModelId
    },
    userConfig
  }
}
