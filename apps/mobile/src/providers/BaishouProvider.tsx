import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'
import { installExpoDatabaseSchema, detectVecSupport } from '@baishou/database/expo'
import {
  SessionManagerService,
  DiaryService,
  SettingsManagerService,
  SummaryManagerService,
  SessionFileService,
  SessionSyncService,
  AssistantFileService,
  AssistantManagerService,
  SettingsFileService,
  FileSyncService,
  FileSyncServiceImpl,
  VaultIndexService,
  VaultIndexServiceImpl,
  SummaryFileService,
  SummarySyncService,
  ShadowIndexSyncService,
  VaultService,
  MissingSummaryDetector,
  SummaryGeneratorService,
  buildSharedContextText
} from '@baishou/core-mobile'
import { resolveSummaryTemplatesForGeneration } from '@baishou/shared'

import {
  SessionRepository,
  AssistantRepository,
  ShadowIndexRepository,
  SettingsRepository,
  SummaryRepositoryImpl,
  SnapshotRepository
} from '@baishou/database'

import {
  AIProviderRegistry,
  ToolRegistry,
  AgentSessionService,
  StreamChatCallbacks,
  htmlToPlainText,
  webSearchConfigToUserConfig,
  EmbeddingAdapter,
  HybridSearchService
} from '@baishou/ai'
import { SqliteHybridSearchRepository } from '@baishou/database'

import { MobileStoragePathService } from '../services/path.service'
import { createMobileFileSystem } from '../services/create-mobile-file-system'
import { MobileArchiveService } from '../services/archive.service'
import { MobileLanSyncService } from '../services/lan-sync.service'
import { MobileCloudSyncService } from '../services/cloud-sync.service'
import { createMobileRagService, type MobileRagService } from '../services/mobile-rag.service'
import { MobileIncrementalSyncService } from '../services/mobile-incremental-sync.service'
import { MobileMcpService } from '../services/mobile-mcp.service'
import { mobileDataBootstrapper } from '../services/mobile-bootstrapper.service'
import { vaultFileWatcher } from '../services/vault-file-watcher.service'
import { mobileDeveloperService, type MobileDeveloperService } from '../services/developer.service'
import { MobileUpdaterService } from '../services/mobile-updater.service'
import { mobilePricingService, type MobilePricingService } from '../services/mobile-pricing.service'
import type { VaultFileWatcherService } from '../services/vault-file-watcher.service'
import type { MobileDataBootstrapper } from '../services/mobile-bootstrapper.service'
import type { IFileSystem } from '@baishou/core-mobile'
import { createShadowDiaryRepoAdapter } from '../services/shadow-diary-adapter'
import { buildMobileSummaryAiClient } from '../services/mobile-summary-ai-client'
import { MobileAttachmentManagerService } from '../services/mobile-attachment-manager.service'
import { sessionFileWatcher } from '../services/session-file-watcher.service'
import { summaryFileWatcher } from '../services/summary-file-watcher.service'
import { logger } from '@baishou/shared'
import type {
  SessionRepository as SessionRepositoryType,
  SnapshotRepository as SnapshotRepositoryType
} from '@baishou/database'
import { isExternalStorageRequiredError } from '../services/storage-permission.service'
import { isExternalStorageNativeAvailable } from 'expo-baishou-server'

// 采用类似于桌面端 db.ts 里的静态导出，但在 RN 里我们走 Context 更加 React 化
interface BaishouContextValue {
  dbReady: boolean
  /** Android：是否已成功挂载外部 BaiShou_Root（无权限时为 false） */
  storageReady: boolean
  /** Android：授权后重试挂载 BaiShou_Root 并同步磁盘 */
  retryStorageSetup: () => Promise<boolean>
  services: {
    agentService: AgentSessionService
    sessionManager: SessionManagerService
    sessionRepo: SessionRepositoryType
    snapshotRepo: SnapshotRepositoryType
    assistantManager: AssistantManagerService
    diaryService: DiaryService
    settingsManager: SettingsManagerService
    summaryManager: SummaryManagerService
    summaryGenerator: SummaryGeneratorService
    archiveService: MobileArchiveService
    lanSyncService: MobileLanSyncService
    cloudSyncService: MobileCloudSyncService
    vaultService: VaultService
    pathService: MobileStoragePathService
    fileSystem: IFileSystem
    developerService: MobileDeveloperService
    updaterService: MobileUpdaterService
    pricingService: MobilePricingService
    bootstrapper: MobileDataBootstrapper
    vaultFileWatcher: VaultFileWatcherService
    memorySearch: (
      query: string,
      options?: { topK?: number; minScore?: number }
    ) => Promise<Array<{ chunkText: string; score: number; createdAt?: number }>>
    mobileMcpService: MobileMcpService
    ragService: MobileRagService
    incrementalSyncService: MobileIncrementalSyncService
    attachmentManager: MobileAttachmentManagerService
    /** 与桌面 summary:buildSharedContext 一致（总结 + 级联折叠后的日记） */
    buildSharedContext: (lookbackMonths: number, locale?: string) => Promise<string>
  } | null
  startAgentChat?: (
    sessionId: string,
    userText: string,
    callbacks: StreamChatCallbacks,
    overrides?: {
      providerId?: string
      modelId?: string
      searchMode?: boolean
      abortSignal?: AbortSignal
      userMessageId?: string
      skipUserMessageRecording?: boolean
      attachments?: unknown[]
    }
  ) => Promise<void>
}

const BaishouContext = createContext<BaishouContextValue>({
  dbReady: false,
  storageReady: Platform.OS !== 'android',
  retryStorageSetup: async () => Platform.OS !== 'android',
  services: null
})

export const useBaishou = () => useContext(BaishouContext)

/** 使用 native fetch 获取网页内容并转换为正文（长度限制由工具层按设置处理） */
async function webFetchContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`)
    }

    const plainText = htmlToPlainText(await response.text())
    return plainText || 'The webpage is empty or cannot be parsed textually.'
  } catch (e: any) {
    logger.error(`Failed to fetch URL: ${url}`, e)
    return `Failed to read URL: ${e.message || String(e)}`
  }
}

/** 搜索 DuckDuckGo 并获取搜索结果页面 */
async function fetchDuckDuckGoSearch(query: string): Promise<string> {
  const encoded = encodeURIComponent(query)
  const url = `https://html.duckduckgo.com/html/?q=${encoded}`
  return webFetchContent(url)
}

export function BaishouProvider({ children }: { children: ReactNode }) {
  const retryStorageSetupRef = useRef<() => Promise<boolean>>(async () => false)
  const [value, setValue] = useState<BaishouContextValue>({
    dbReady: false,
    storageReady: Platform.OS !== 'android',
    retryStorageSetup: () => retryStorageSetupRef.current(),
    services: null
  })

  useEffect(() => {
    let isMounted = true
    let mobileMcpService: MobileMcpService | null = null

    async function init() {
      try {
        // 1. 初始化 SQLite 环境
        const expoDb = await SQLite.openDatabaseAsync('baishou_next_mobile.db')

        const { drizzleDb, driver } = await installExpoDatabaseSchema(expoDb as any)

        const vecCapability = await detectVecSupport(driver)
        if (vecCapability.available) {
          logger.info('[BaishouProvider] Native sqlite-vec extension detected on mobile.')
        } else {
          logger.warn(
            '[BaishouProvider] Native sqlite-vec extension not detected on mobile. RAG will fallback to JS calculation.',
            vecCapability.reason
          )
        }

        const fileSystem = createMobileFileSystem()
        const pathService = new MobileStoragePathService(fileSystem) as any

        // 3. 构建 Repositories
        const sessionRepo = new SessionRepository(drizzleDb)
        const assistantRepo = new AssistantRepository(drizzleDb)
        const shadowRepo = new ShadowIndexRepository(drizzleDb)
        const settingsRepo = new SettingsRepository(drizzleDb)
        const summaryRepo = new SummaryRepositoryImpl(drizzleDb)

        const snapshotRepo = new SnapshotRepository(drizzleDb)

        // 4. 构建 Core Services并进行依赖注入
        const sessionFileService = new SessionFileService(pathService, fileSystem)
        const sessionSyncService = new SessionSyncService(sessionRepo, sessionFileService)
        const sessionManager = new SessionManagerService(
          sessionRepo,
          sessionFileService,
          sessionSyncService
        )

        const assistantFileService = new AssistantFileService(pathService, fileSystem)
        const attachmentManager = new MobileAttachmentManagerService(pathService, fileSystem)
        const assistantManager = new AssistantManagerService(
          assistantRepo,
          assistantFileService,
          attachmentManager
        )

        const fileSyncService = new FileSyncServiceImpl(pathService, fileSystem)
        const vaultIndexService = new VaultIndexServiceImpl()
        const vaultService = new VaultService(pathService, fileSystem)
        const shadowIndexSyncService = new ShadowIndexSyncService(
          shadowRepo,
          pathService,
          vaultService,
          fileSystem
        )
        const diaryService = new DiaryService(
          shadowRepo,
          fileSyncService,
          shadowIndexSyncService,
          vaultIndexService
        )

        const settingsFileService = new SettingsFileService(pathService, fileSystem)
        const settingsManager = new SettingsManagerService(settingsRepo, settingsFileService)

        const summaryFileService = new SummaryFileService(pathService, fileSystem)
        const diaryRepoAdapter = createShadowDiaryRepoAdapter(shadowRepo)
        const summaryConfig = (await settingsManager.get<any>('summary_config')) || {}
        const customTemplates = resolveSummaryTemplatesForGeneration(summaryConfig)
        const promptLocale = summaryConfig?.promptLocale ?? 'zh'
        const summaryAiClient = buildMobileSummaryAiClient(settingsManager)
        const missingSummaryDetector = new MissingSummaryDetector(
          diaryRepoAdapter as any,
          summaryRepo as any
        )
        const summaryGenerator = new SummaryGeneratorService(
          diaryRepoAdapter as any,
          summaryRepo as any,
          summaryAiClient,
          customTemplates as Record<string, string>,
          promptLocale
        )
        const summarySyncService = new SummarySyncService(
          missingSummaryDetector,
          summaryGenerator,
          summaryRepo,
          summaryFileService
        )
        const summaryManager = new SummaryManagerService(
          summaryRepo,
          summaryFileService,
          summarySyncService
        )

        const buildSharedContext = async (lookbackMonths: number, locale?: string) => {
          const allSummaries = await summaryManager.list()
          const diaries = await shadowRepo.listAllWithFTS({ limit: 10000 })
          return buildSharedContextText(allSummaries, lookbackMonths, locale, { diaries })
        }

        const agentService = new AgentSessionService()

        // 创建归档服务和局域网同步服务
        const archiveService = new MobileArchiveService(pathService, vaultService, fileSystem)
        const lanSyncService = new MobileLanSyncService(archiveService, fileSystem)
        const cloudSyncService = new MobileCloudSyncService(archiveService, fileSystem)
        const incrementalSyncService = new MobileIncrementalSyncService(
          settingsManager,
          archiveService,
          pathService,
          fileSystem
        )

        const updaterService = new MobileUpdaterService(settingsManager)
        const pricingService = mobilePricingService

        void pricingService.ensureLoaded()
        void updaterService.checkOnBootIfEnabled().catch((e) => {
          logger.warn('[MobileUpdater] boot check failed:', e)
        })

        const toolRegistry = new ToolRegistry()
        mobileMcpService = new MobileMcpService(settingsManager, toolRegistry, () =>
          pathService.getActiveVaultNameForContext()
        )
        const registry = AIProviderRegistry.getInstance()
        registry.initializeDefaultProviders()

        // 日记全文搜索器（与桌面端 createDiarySearcher 对齐）
        const diarySearcher = {
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
          }
        }

        // 构建 RAG 记忆搜索所需的底层组件
        const rawClient = (drizzleDb as any)?.session?.client || (drizzleDb as any)
        const hsRepo = new SqliteHybridSearchRepository(rawClient)
        const hybridSearchService = new HybridSearchService(hsRepo)
        const ragService = createMobileRagService({
          settingsManager,
          diaryService,
          hsRepo,
          hybridSearchService,
          registry,
          rawSqlClient: rawClient
        })

        /**
         * RAG 语义记忆搜索
         * 使用向量嵌入 + 混合搜索（FTS + 向量）进行真正的语义检索
         */
        const memorySearch = async (
          query: string,
          options?: { topK?: number; minScore?: number }
        ): Promise<Array<{ chunkText: string; score: number; createdAt?: number }>> => {
          try {
            const providers = (await settingsManager.get<any[]>('ai_providers')) || []
            const globalModels = await settingsManager.get<any>('global_models')

            // 获取嵌入模型配置
            const embeddingProviderId = globalModels?.globalEmbeddingProviderId
            const embeddingModelId = globalModels?.globalEmbeddingModelId

            if (!embeddingProviderId || !embeddingModelId) {
              logger.warn('[MemorySearch] 嵌入模型未配置，降级为 FTS 搜索')
              const ftsResults = await hsRepo.queryFTS(query, options?.topK ?? 20)
              return ftsResults.map((r) => ({
                chunkText: r.chunkText,
                score: r.score,
                createdAt: r.createdAt
              }))
            }

            const embeddingProviderConfig = providers.find((p: any) => p.id === embeddingProviderId)
            if (!embeddingProviderConfig) {
              logger.warn('[MemorySearch] 嵌入供应商配置未找到，降级为 FTS 搜索')
              const ftsResults = await hsRepo.queryFTS(query, options?.topK ?? 20)
              return ftsResults.map((r) => ({
                chunkText: r.chunkText,
                score: r.score,
                createdAt: r.createdAt
              }))
            }

            const embeddingProvider = registry.getOrUpdateProvider(embeddingProviderConfig)
            const embAdapter = new EmbeddingAdapter(embeddingProvider, embeddingModelId, hsRepo)

            // 生成查询向量
            const queryVector = await embAdapter.embedQuery(query)
            if (!queryVector) {
              logger.warn('[MemorySearch] 查询向量生成失败，降级为 FTS 搜索')
              const ftsResults = await hsRepo.queryFTS(query, options?.topK ?? 20)
              return ftsResults.map((r) => ({
                chunkText: r.chunkText,
                score: r.score,
                createdAt: r.createdAt
              }))
            }

            // 执行混合搜索（FTS + 向量 RRF 融合）
            const topK = options?.topK ?? 20
            const minScore = options?.minScore ?? 0.3

            const results = await hybridSearchService.search({
              queryVector,
              queryText: query,
              topK,
              similarityThreshold: minScore
            })

            return results.map((r) => ({
              chunkText: r.chunkText,
              score: r.score,
              createdAt: r.createdAt
            }))
          } catch (e) {
            logger.error('[MemorySearch] RAG 搜索失败，降级为 FTS:', e as Error)
            const ftsResults = await hsRepo.queryFTS(query, options?.topK ?? 20)
            return ftsResults.map((r) => ({
              chunkText: r.chunkText,
              score: r.score,
              createdAt: r.createdAt
            }))
          }
        }

        const startAgentChat = async (
          sessionId: string,
          userText: string,
          callbacks: StreamChatCallbacks,
          overrides?: {
            providerId?: string
            modelId?: string
            searchMode?: boolean
            abortSignal?: AbortSignal
            userMessageId?: string
            skipUserMessageRecording?: boolean
            attachments?: unknown[]
          }
        ) => {
          try {
            const providers = (await settingsManager.get<any[]>('ai_providers')) || []
            const globalModels = await settingsManager.get<any>('global_models')

            const providerId = overrides?.providerId || globalModels?.globalDialogueProviderId
            const config =
              providers.find((p: any) => p.id === providerId) ||
              providers.find((p: any) => p.isEnabled)

            if (!config) throw new Error('No active provider configured')

            const provider = registry.getOrUpdateProvider(config)

            // 读取搜索相关配置
            const searchMode = overrides?.searchMode ?? false
            const webSearchConfig = await settingsManager.get<any>('web_search_config')
            const ragConfig = await settingsManager.get<any>('rag_config')

            const userConfig: Record<string, unknown> = {
              web_search_enabled: searchMode,
              ...webSearchConfigToUserConfig(webSearchConfig),
              ragEnabled: ragConfig?.ragEnabled ?? true
            }

            const modelId =
              overrides?.modelId ||
              globalModels?.globalDialogueModelId ||
              config.defaultDialogueModel ||
              config.models[0]

            await agentService.streamChat(
              {
                sessionId,
                userText,
                provider,
                modelId,
                toolRegistry,
                sessionRepo,
                snapshotRepo,
                userConfig,
                diarySearcher,
                webSearchResultFetcher: webFetchContent,
                fetchSearchPage: fetchDuckDuckGoSearch,
                abortSignal: overrides?.abortSignal,
                userMessageId: overrides?.userMessageId,
                skipUserMessageRecording: overrides?.skipUserMessageRecording,
                attachments: overrides?.attachments as any
              },
              callbacks
            )
          } catch (e) {
            logger.error('Mobile Agent Chat Failed:', e as Error)
            throw e
          }
        }

        try {
          await mobileMcpService.start()
        } catch (mcpErr) {
          logger.warn('[BaishouProvider] MCP server failed to start:', mcpErr as Error)
        }

        logger.info('Mobile DB and DI Container Ready!')
        if (Platform.OS === 'android') {
          logger.info(
            `[BaishouProvider] External storage native API: ${isExternalStorageNativeAvailable() ? 'available' : 'MISSING — run pnpm dev:mobile:clear'}`
          )
        }

        const bootstrapDeps = {
          shadowIndexSyncService,
          sessionManager,
          assistantManager,
          settingsManager,
          summarySyncService
        }

        const runStorageBootstrap = async () => {
          await pathService.getRootDirectory()
          await vaultService.initRegistry()
          mobileDataBootstrapper.registerDeps(bootstrapDeps)
          const activeVault = await vaultService.getActiveVault()
          if (activeVault?.path) {
            await mobileDataBootstrapper.runWhenVaultReady(bootstrapDeps)
            vaultFileWatcher.start(activeVault.path, {
              shadowIndexSyncService,
              fileSystem
            })
            const sessionsDir = await pathService.getSessionsBaseDirectory()
            sessionFileWatcher.start(sessionsDir, {
              sessionFileService,
              sessionSyncService,
              sessionManager,
              fileSystem
            })
            summaryFileWatcher.start(summarySyncService)
          } else {
            logger.warn('[BaishouProvider] No active vault; skipped bootstrap and file watcher')
          }
        }

        let storageReady = Platform.OS !== 'android'
        if (Platform.OS === 'android') {
          try {
            await runStorageBootstrap()
            storageReady = true
          } catch (e) {
            if (isExternalStorageRequiredError(e)) {
              logger.info(
                '[BaishouProvider] Waiting for MANAGE_EXTERNAL_STORAGE; diary UI will prompt user'
              )
              storageReady = false
            } else {
              throw e
            }
          }
        } else {
          await runStorageBootstrap()
          storageReady = true
        }

        retryStorageSetupRef.current = async () => {
          try {
            await runStorageBootstrap()
            if (isMounted) {
              setValue((prev) => ({ ...prev, storageReady: true }))
            }
            return true
          } catch (e) {
            if (!isExternalStorageRequiredError(e)) {
              logger.error('[BaishouProvider] retryStorageSetup failed:', e as Error)
            }
            return false
          }
        }

        if (isMounted) {
          setValue({
            dbReady: true,
            storageReady,
            retryStorageSetup: () => retryStorageSetupRef.current(),
            services: {
              agentService,
              sessionManager,
              sessionRepo,
              snapshotRepo,
              assistantManager,
              diaryService,
              settingsManager,
              summaryManager,
              summaryGenerator,
              archiveService,
              lanSyncService,
              cloudSyncService,
              vaultService,
              pathService,
              fileSystem,
              developerService: mobileDeveloperService,
              updaterService,
              pricingService,
              bootstrapper: mobileDataBootstrapper,
              vaultFileWatcher,
              memorySearch,
              mobileMcpService,
              ragService,
              incrementalSyncService,
              attachmentManager,
              buildSharedContext
            },
            startAgentChat
          })
        }
      } catch (e) {
        logger.error('Failed to init Baishou DB:', e as Error)
      }
    }

    init()

    return () => {
      isMounted = false
      vaultFileWatcher.stop()
      sessionFileWatcher.stop()
      summaryFileWatcher.stop()
      void mobileMcpService?.stop()
    }
  }, [])

  return <BaishouContext.Provider value={value}>{children}</BaishouContext.Provider>
}
