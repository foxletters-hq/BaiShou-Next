import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'
import { ensureExpoAgentDatabaseInstalled, detectVecSupport } from '@baishou/database/expo'
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
  SummaryFileService,
  SummarySyncService,
  VaultService,
  MissingSummaryDetector,
  SummaryGeneratorService,
  buildSharedContextText
} from '@baishou/core-mobile'
import { resolveSummaryTemplatesForGeneration } from '@baishou/shared'
import { getTtsPlaybackSettings } from '../services/mobile-tts-settings.service'

import {
  SessionRepository,
  AssistantRepository,
  SettingsRepository,
  SummaryRepositoryImpl,
  SnapshotRepository,
  shadowConnectionManager
} from '@baishou/database'

import {
  AIProviderRegistry,
  ToolRegistry,
  AgentSessionService,
  StreamChatCallbacks,
  htmlToPlainText,
  EmbeddingAdapter,
  HybridSearchService
} from '@baishou/ai'
import { SqliteHybridSearchRepository } from '@baishou/database'

import { MobileStoragePathService } from '../services/path.service'
import {
  loadContextAtMessage,
  buildMobileStreamUserConfig,
  type MobileContextAtMessagePayload
} from '../services/mobile-context-at-message.service'
import { createMobileFileSystem } from '../services/create-mobile-file-system'
import { setupMobileLocalFileReader } from '../services/mobile-local-file-reader.service'
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
import { ensureMobileCompressionBridge } from '../services/mobile-compression-event.service'
import type { IFileSystem } from '@baishou/core-mobile'
import { buildMobileSummaryAiClient } from '../services/mobile-summary-ai-client'
import { MobileAttachmentManagerService } from '../services/mobile-attachment-manager.service'
import { sessionFileWatcher } from '../services/session-file-watcher.service'
import { summaryFileWatcher } from '../services/summary-file-watcher.service'
import {
  activateVaultRuntime,
  createUnavailableDiaryService,
  createVaultDiaryServiceProxy,
  EMPTY_DIARY_REPO_ADAPTER,
  EMPTY_DIARY_SEARCHER,
  initVaultLayer,
  switchVaultRuntime,
  type VaultBoundDiaryStack
} from '../services/mobile-vault-runtime.service'
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
  /** 工作空间切换后递增，供列表等 UI 重新拉取数据 */
  vaultRevision: number
  /** 工作空间切换进行中（Shadow DB 重连窗口） */
  vaultSwitching: boolean
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
    missingSummaryDetector: MissingSummaryDetector
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
    switchVault: (vaultName: string) => Promise<void>
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
    /** 与桌面 agent:get-context-at-message 一致 */
    getContextAtMessage: (
      sessionId: string,
      messageId: string,
      searchMode?: boolean
    ) => Promise<MobileContextAtMessagePayload>
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
  vaultRevision: 0,
  vaultSwitching: false,
  retryStorageSetup: async () => Platform.OS !== 'android',
  services: null
})

export const useBaishou = () => useContext(BaishouContext)

const MOBILE_BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9'
}

const WEB_FETCH_TIMEOUT_MS = 15_000

function createWebFetchSignal(timeoutMs: number): AbortSignal {
  if (
    typeof AbortSignal !== 'undefined' &&
    'timeout' in AbortSignal &&
    typeof AbortSignal.timeout === 'function'
  ) {
    return AbortSignal.timeout(timeoutMs)
  }
  const controller = new AbortController()
  setTimeout(() => controller.abort(), timeoutMs)
  return controller.signal
}

/** 获取搜索页原始 HTML（供 local-bing / local-google 解析，对齐桌面端 fetchSearchPage 契约） */
async function fetchSearchPageHtml(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: MOBILE_BROWSER_HEADERS,
      signal: createWebFetchSignal(WEB_FETCH_TIMEOUT_MS)
    })
    if (!response.ok) {
      return ''
    }
    return await response.text()
  } catch {
    // 单个 URL 失败不影响搜索主流程，静默跳过
    return ''
  }
}

/** 使用 native fetch 获取网页内容并转换为正文（长度限制由工具层按设置处理） */
async function webFetchContent(url: string): Promise<string> {
  const html = await fetchSearchPageHtml(url)
  if (!html) {
    return 'The webpage is empty or cannot be parsed textually.'
  }
  try {
    const plainText = htmlToPlainText(html)
    return plainText || 'The webpage is empty or cannot be parsed textually.'
  } catch {
    return 'The webpage is empty or cannot be parsed textually.'
  }
}

export function BaishouProvider({ children }: { children: ReactNode }) {
  const retryStorageSetupRef = useRef<() => Promise<boolean>>(async () => false)
  const diaryStackRef = useRef<VaultBoundDiaryStack | null>(null)
  const [value, setValue] = useState<BaishouContextValue>({
    dbReady: false,
    storageReady: Platform.OS !== 'android',
    vaultRevision: 0,
    vaultSwitching: false,
    retryStorageSetup: () => retryStorageSetupRef.current(),
    services: null
  })

  useEffect(() => {
    let isMounted = true
    let mobileMcpService: MobileMcpService | null = null

    async function init() {
      try {
        // 1. 初始化 SQLite 环境（单例，避免并发 open + 迁移）
        const { drizzleDb, driver } = await ensureExpoAgentDatabaseInstalled(() =>
          SQLite.openDatabaseAsync('baishou_next_mobile.db')
        )

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
        setupMobileLocalFileReader(fileSystem)
        const pathService = new MobileStoragePathService(fileSystem) as any

        // 3. 构建 Repositories
        const sessionRepo = new SessionRepository(drizzleDb)
        const assistantRepo = new AssistantRepository(drizzleDb)
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

        const vaultService = new VaultService(pathService, fileSystem)
        const vaultRuntimeDeps = { pathService, vaultService, fileSystem }

        const settingsFileService = new SettingsFileService(pathService, fileSystem)
        const settingsManager = new SettingsManagerService(settingsRepo, settingsFileService)

        let diaryStack: VaultBoundDiaryStack | null = null
        let storageReady = Platform.OS !== 'android'

        if (Platform.OS === 'android') {
          try {
            diaryStack = await initVaultLayer(vaultRuntimeDeps)
            diaryStackRef.current = diaryStack
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
          diaryStack = await initVaultLayer(vaultRuntimeDeps)
          diaryStackRef.current = diaryStack
        }

        const diaryServiceProxy = createVaultDiaryServiceProxy(diaryStackRef)
        const diarySearcher = diaryStack?.diarySearcher ?? EMPTY_DIARY_SEARCHER

        const summaryFileService = new SummaryFileService(pathService, fileSystem)
        const diaryRepoAdapter = diaryStack?.diaryRepoAdapter ?? EMPTY_DIARY_REPO_ADAPTER
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
          const stack = diaryStackRef.current
          if (!stack) return ''
          const allSummaries = await summaryManager.list()
          const diaries = await stack.shadowRepo.listAllWithFTS({ limit: 10000 })
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
        const getDiarySearcher = () => diaryStackRef.current?.diarySearcher ?? diarySearcher

        // 构建 RAG 记忆搜索所需的底层组件
        const rawClient = (drizzleDb as any)?.session?.client || (drizzleDb as any)
        const hsRepo = new SqliteHybridSearchRepository(rawClient)
        const hybridSearchService = new HybridSearchService(hsRepo)
        const ragServiceRef = {
          current: createMobileRagService({
            settingsManager,
            diaryService: diaryServiceProxy,
            hsRepo,
            hybridSearchService,
            registry,
            rawSqlClient: rawClient
          })
        }

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

            const searchMode = overrides?.searchMode ?? false
            const userConfig = await buildMobileStreamUserConfig(
              settingsManager,
              searchMode
            )

            const embeddingProviderId = globalModels?.globalEmbeddingProviderId
            const embeddingModelId = globalModels?.globalEmbeddingModelId
            let embeddingProvider
            if (embeddingProviderId && embeddingModelId && embeddingModelId !== 'off') {
              const embConfig = providers.find((p: any) => p.id === embeddingProviderId)
              if (embConfig) {
                embeddingProvider = registry.getOrUpdateProvider(embConfig)
              }
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
                systemModels: embeddingProvider
                  ? { embeddingProvider, embeddingModelId }
                  : undefined,
                diarySearcher: getDiarySearcher(),
                webSearchResultFetcher: webFetchContent,
                fetchSearchPage: fetchSearchPageHtml,
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

        ensureMobileCompressionBridge()

        logger.info('Mobile DB and DI Container Ready!')
        if (Platform.OS === 'android') {
          logger.info(
            `[BaishouProvider] External storage native API: ${isExternalStorageNativeAvailable() ? 'available' : 'MISSING — run pnpm dev:mobile:clear'}`
          )
        }

        const bootstrapDeps = {
          sessionManager,
          assistantManager,
          settingsManager,
          summarySyncService
        }

        const watcherDeps = {
          pathService,
          fileSystem,
          sessionFileService,
          sessionSyncService,
          sessionManager,
          summarySyncService
        }

        const runStorageBootstrap = async (): Promise<VaultBoundDiaryStack> => {
          const stack = diaryStackRef.current ?? (await initVaultLayer(vaultRuntimeDeps))
          diaryStackRef.current = stack

          const activeVault = vaultService.getActiveVault()
          if (activeVault?.path) {
            await activateVaultRuntime({
              pathService,
              vaultService,
              fileSystem,
              diaryStack: stack,
              bootstrapDeps,
              watcherDeps
            })
          } else {
            logger.warn('[BaishouProvider] No active vault; skipped bootstrap and file watcher')
          }

          return stack
        }

        const switchVault = async (vaultName: string) => {
          const active = vaultService.getActiveVault()
          if (active?.name === vaultName && shadowConnectionManager.isConnected()) {
            return
          }

          if (isMounted) {
            setValue((prev) => ({ ...prev, vaultSwitching: true }))
          }

          try {
            await switchVaultRuntime(vaultName, {
              pathService,
              vaultService,
              fileSystem,
              bootstrapDeps,
              watcherDeps,
              currentStack: diaryStackRef.current ?? undefined,
              callbacks: {
                onStackInvalidated: () => {
                  diaryStackRef.current = null
                },
                onStackReady: (stack) => {
                  diaryStackRef.current = stack
                  ragServiceRef.current = createMobileRagService({
                    settingsManager,
                    diaryService: stack.diaryService,
                    hsRepo,
                    hybridSearchService,
                    registry,
                    rawSqlClient: rawClient
                  })
                  if (!isMounted) return
                  setValue((prev) => ({
                    ...prev,
                    vaultRevision: prev.vaultRevision + 1,
                    services: prev.services
                      ? {
                          ...prev.services,
                          ragService: ragServiceRef.current,
                          switchVault
                        }
                      : prev.services
                  }))
                },
                onResyncComplete: () => {
                  if (!isMounted) return
                  setValue((prev) => ({
                    ...prev,
                    vaultRevision: prev.vaultRevision + 1
                  }))
                }
              }
            })
          } catch (e) {
            logger.error('[BaishouProvider] switchVault failed:', e as Error)
            throw e
          } finally {
            if (isMounted) {
              setValue((prev) => ({ ...prev, vaultSwitching: false }))
            }
          }
        }

        if (diaryStack) {
          try {
            await runStorageBootstrap()
            storageReady = true
          } catch (e) {
            if (Platform.OS === 'android' && isExternalStorageRequiredError(e)) {
              logger.info(
                '[BaishouProvider] Vault bootstrap deferred until external storage is granted'
              )
              storageReady = false
            } else {
              throw e
            }
          }
        }

        retryStorageSetupRef.current = async () => {
          try {
            const stack = await runStorageBootstrap()
            ragServiceRef.current = createMobileRagService({
              settingsManager,
              diaryService: stack.diaryService,
              hsRepo,
              hybridSearchService,
              registry,
              rawSqlClient: rawClient
            })
            if (isMounted) {
              setValue((prev) => ({
                ...prev,
                storageReady: true,
                vaultRevision: prev.vaultRevision + 1,
                services: prev.services
                  ? {
                      ...prev.services,
                      ragService: ragServiceRef.current
                    }
                  : prev.services
              }))
            }
            return true
          } catch (e) {
            if (!isExternalStorageRequiredError(e)) {
              logger.error('[BaishouProvider] retryStorageSetup failed:', e as Error)
            }
            return false
          }
        }

        const getContextAtMessage = (
          sessionId: string,
          messageId: string,
          searchMode = false
        ) =>
          loadContextAtMessage(
            {
              sessionRepo,
              snapshotRepo,
              assistantManager,
              settingsManager,
              toolRegistry,
              diarySearcher: getDiarySearcher(),
              webSearchResultFetcher: webFetchContent,
              fetchSearchPage: fetchSearchPageHtml
            },
            sessionId,
            messageId,
            searchMode
          )

        void getTtsPlaybackSettings(settingsManager).catch(() => {})

        if (isMounted) {
          setValue({
            dbReady: true,
            storageReady,
            vaultRevision: 0,
            vaultSwitching: false,
            retryStorageSetup: () => retryStorageSetupRef.current(),
            services: {
              agentService,
              sessionManager,
              sessionRepo,
              snapshotRepo,
              assistantManager,
              diaryService: diaryServiceProxy,
              settingsManager,
              summaryManager,
              summaryGenerator,
              missingSummaryDetector,
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
              switchVault,
              memorySearch,
              mobileMcpService,
              ragService: ragServiceRef.current,
              incrementalSyncService,
              attachmentManager,
              buildSharedContext,
              getContextAtMessage
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
