import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react'
import { Platform } from 'react-native'
import * as SQLite from 'expo-sqlite'
import {
  ensureExpoAgentDatabaseInstalled,
  releaseExpoAgentDatabaseInstall,
  backfillExpoAgentMessagesFts,
  enterAgentMigrationArchiveImport,
  exitAgentMigrationArchiveImport,
  type ExpoSqliteDatabase
} from '@baishou/database/expo'
import {
  createAgentDbRuntime,
  createSummaryPipelineServices,
  rebindSummaryPipelineForVault,
  type AgentDbRuntime
} from '../services/mobile-agent-db-runtime'
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
  buildSharedContextText,
  type ImportResult,
  type SyncConfig
} from '@baishou/core-mobile'
import {
  resolveSummaryTemplatesForGeneration,
  resolveSyncDeviceId,
  isConfiguredProviderId,
  isConfiguredDialogueModelId,
  type SummaryPromptLocale
} from '@baishou/shared'
import { getTtsPlaybackSettings } from '../services/mobile-tts-settings.service'
import { shouldRefreshVaultAfterArchiveImport } from '../services/archive-guards.util'

import {
  SessionRepository,
  AssistantRepository,
  SettingsRepository,
  UserProfileRepository,
  SummaryRepositoryImpl,
  SnapshotRepository,
  shadowConnectionManager,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
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

import { MobileStoragePathService } from '../services/path.service'
import {
  loadContextAtMessage,
  buildMobileStreamUserConfig,
  type MobileContextAtMessagePayload
} from '../services/mobile-context-at-message.service'
import { createMobileFileSystem } from '../services/create-mobile-file-system'
import { setupMobileLocalFileReader } from '../services/mobile-local-file-reader.service'
import { setupMobileTtsRefAudioReader } from '../services/mobile-tts-ref-audio.service'
import { MobileArchiveService } from '../services/archive.service'
import type { MobileArchiveDbBridge } from '../services/mobile-archive-db.bridge'
import { getAppDocumentDirectory } from '../services/mobile-app-paths'
import { MobileLanSyncService } from '../services/lan-sync.service'
import { MobileCloudSyncService } from '../services/cloud-sync.service'
import { createMobileRagService, type MobileRagService } from '../services/mobile-rag.service'
import { setMobileDiaryEmbeddingDeps } from '../services/mobile-diary-embedding.service'
import { MobileIncrementalSyncService } from '../services/mobile-incremental-sync.service'
import { MobileMcpService } from '../services/mobile-mcp.service'
import {
  buildMobileMcpToolContext,
  buildMobileMcpToolListContext
} from '../services/mobile-mcp-context.service'
import { mobileDataBootstrapper } from '../services/mobile-bootstrapper.service'
import { vaultFileWatcher } from '../services/vault-file-watcher.service'
import { mobileDeveloperService, type MobileDeveloperService } from '../services/developer.service'
import { MobileUpdaterService } from '../services/mobile-updater.service'
import { mobilePricingService, type MobilePricingService } from '../services/mobile-pricing.service'
import type { VaultFileWatcherService } from '../services/vault-file-watcher.service'
import type { MobileDataBootstrapper } from '../services/mobile-bootstrapper.service'
import { ensureMobileCompressionBridge } from '../services/mobile-compression-event.service'
import { recompressSessionContext } from '../services/mobile-context-recompress.service'
import { setContextRecompressInvoker } from '@baishou/store'
import type { IFileSystem } from '@baishou/core-mobile'
import { buildMobileSummaryAiClient } from '../services/mobile-summary-ai-client'
import { MobileAttachmentManagerService } from '../services/mobile-attachment-manager.service'
import { warmAgentScreenCaches } from '../lib/agent-user-profile.util'
import { reconcileAssistantAvatarsAfterStorageChange } from '../lib/assistant-avatar-reconcile.util'
import {
  initMobileCacheCoordinator,
  emitSyncMutation,
  emitVaultSwitchMutation
} from '../cache/mobile-cache-coordinator'
import { sessionFileWatcher } from '../services/session-file-watcher.service'
import { summaryFileWatcher } from '../services/summary-file-watcher.service'
import {
  activateVaultRuntime,
  createUnavailableDiaryService,
  createVaultDiaryServiceProxy,
  EMPTY_DIARY_REPO_ADAPTER,
  EMPTY_DIARY_SEARCHER,
  initVaultLayer,
  quiesceStorageForFileCopy,
  rebootstrapAfterStorageRootChange,
  registerVaultBootstrapDeps,
  resumeStorageAfterFileCopy,
  resyncEcosystemAfterFileMutation,
  switchVaultRuntime,
  deleteVaultWithShadowCleanup,
  type VaultBoundDiaryStack
} from '../services/mobile-vault-runtime.service'
import { consumeAppUpgradeShadowResync } from '../services/mobile-app-upgrade-shadow.util'
import {
  bindShadowVaultScanState,
  getShadowVaultScanning,
  subscribeShadowVaultScanning,
  unbindShadowVaultScanState
} from '../services/mobile-shadow-scan-state.service'
import { logger } from '@baishou/shared'
import type {
  SessionRepository as SessionRepositoryType,
  SnapshotRepository as SnapshotRepositoryType
} from '@baishou/database'
import {
  ONBOARDING_STORAGE_KEY,
  FLUTTER_LEGACY_MIGRATED_SOURCE_KEY,
  PENDING_RESTORE_CLOUD_SYNC_CONFIG_KEY
} from '@/src/constants/storage'
import {
  detectFlutterLegacyMigrationPending,
  deleteMigratedLegacySourceRoot,
  markFlutterLegacyMigrationComplete,
  resolveFlutterLegacyMigrationTargetRoot,
  runMobileLegacyZipMigration,
  type FlutterLegacyMigrationPending
} from '../services/mobile-legacy-migration.service'
import { getMobileInstallInstanceId } from '../services/install-instance.service'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { isExternalStorageNativeAvailable } from 'expo-baishou-server'
import {
  hasStoragePermission,
  isExternalStorageRequiredError,
  requestStoragePermission
} from '../services/storage-permission.service'

// 采用类似于桌面端 db.ts 里的静态导出，但在 RN 里我们走 Context 更加 React 化
interface BaishouContextValue {
  dbReady: boolean
  /** Android：是否已成功挂载外部 BaiShou_Root（无权限时为 false） */
  storageReady: boolean
  /** 旧版 Flutter 升级后需重新嵌入 RAG */
  legacyRagReembedRequired: boolean
  /** 检测到旧版目录有数据、尚未迁移 */
  pendingFlutterLegacyMigration: FlutterLegacyMigrationPending | null
  /** 迁移完成后可删除的旧版根目录 */
  legacyMigrationSourcePendingDeletion: string | null
  /** 迁移验证通过后删除旧版目录 */
  deleteMigratedLegacySource: () => Promise<boolean>
  /** 工作空间切换后递增，供列表等 UI 重新拉取数据 */
  vaultRevision: number
  /** 全量导入/快照恢复成功后递增 vaultRevision，供 UI 刷新 */
  notifyArchiveRestoreComplete: (result: ImportResult) => void
  /** 版本迁移板块导入成功后递增 vaultRevision，供列表刷新 */
  notifyVersionMigrationComplete: () => void
  /** 归档恢复后递增，供日记页重置月份/筛选 */
  archiveRestoreEpoch: number
  /** 工作空间切换进行中（重建 diary stack / 后台 resync） */
  vaultSwitching: boolean
  /** 正在从磁盘恢复日记/会话/总结索引 */
  storageIndexing: boolean
  /** 后台 ecosystem resync 完成时递增（与 vaultRevision 分离，避免重复刷新） */
  ecosystemResyncEpoch: number
  /** Android：授权后重试挂载 BaiShou_Root 并同步磁盘 */
  retryStorageSetup: (options?: { forceDeferResync?: boolean }) => Promise<boolean>
  /** 暂停文件监听与 Shadow DB，执行磁盘操作后自动恢复（用于目录迁移） */
  runWithStorageQuiesced: <T>(fn: () => Promise<T>) => Promise<T>
  /** 版本迁移等直写磁盘后阻塞重建 Shadow 索引，供日记列表热刷新 */
  resyncAfterMigration: () => Promise<void>
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
    deleteVault: (vaultName: string) => Promise<void>
    memorySearch: (
      query: string,
      options?: { topK?: number; minScore?: number }
    ) => Promise<Array<{ chunkText: string; score: number; createdAt?: number }>>
    mobileMcpService: MobileMcpService
    ragService: MobileRagService
    incrementalSyncService: MobileIncrementalSyncService
    attachmentManager: MobileAttachmentManagerService
    expoDb: unknown
    settingsRepo: SettingsRepository
    profileRepo: UserProfileRepository
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
      forceRecompress?: boolean
      streamClaimGeneration?: number
      attachments?: unknown[]
    }
  ) => Promise<void>
}

const BaishouContext = createContext<BaishouContextValue>({
  dbReady: false,
  storageReady: Platform.OS !== 'android',
  legacyRagReembedRequired: false,
  pendingFlutterLegacyMigration: null,
  legacyMigrationSourcePendingDeletion: null,
  deleteMigratedLegacySource: async () => false,
  vaultRevision: 0,
  notifyArchiveRestoreComplete: () => {},
  notifyVersionMigrationComplete: () => {},
  archiveRestoreEpoch: 0,
  vaultSwitching: false,
  storageIndexing: false,
  ecosystemResyncEpoch: 0,
  retryStorageSetup: async () => Platform.OS !== 'android',
  runWithStorageQuiesced: async (fn) => fn(),
  resyncAfterMigration: async () => {},
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
  const retryStorageSetupRef = useRef<
    (options?: { forceDeferResync?: boolean }) => Promise<boolean>
  >(async () => false)
  const runWithStorageQuiescedRef = useRef<<T>(fn: () => Promise<T>) => Promise<T>>(async (fn) =>
    fn()
  )
  const deleteMigratedLegacySourceRef = useRef<() => Promise<boolean>>(async () => false)
  const notifyArchiveRestoreCompleteRef = useRef<(result: ImportResult) => void>(() => {})
  const notifyVersionMigrationCompleteRef = useRef<() => void>(() => {})
  const resyncAfterMigrationRef = useRef<() => Promise<void>>(async () => {})
  const agentDbRuntimeRef = useRef<AgentDbRuntime | null>(null)
  const reloadAgentDatabaseRef = useRef<() => Promise<void>>(async () => {})
  const archiveFullRestoreDoneRef = useRef(false)
  const vaultBootstrapCtxRef = useRef<{
    pathService: MobileStoragePathService
    vaultService: VaultService
    fileSystem: ReturnType<typeof createMobileFileSystem>
    attachmentManager: MobileAttachmentManagerService
    bootstrapDeps: {
      sessionManager: SessionManagerService
      assistantManager: AssistantManagerService
      settingsManager: SettingsManagerService
      summarySyncService: SummarySyncService
    }
    watcherDeps: {
      pathService: MobileStoragePathService
      fileSystem: ReturnType<typeof createMobileFileSystem>
      sessionFileService: SessionFileService
      sessionSyncService: SessionSyncService
      sessionManager: SessionManagerService
      summarySyncService: SummarySyncService
    }
    registry: AIProviderRegistry
    mobileMcpService: MobileMcpService | null
    ragServiceRef: { current: ReturnType<typeof createMobileRagService> }
  } | null>(null)
  const migrationRuntimeRef = useRef<{
    fileSystem: IFileSystem
    expoDb: unknown
    settingsRepo: SettingsRepository
    profileRepo: UserProfileRepository
    pathService: MobileStoragePathService
    installInstanceId: string
  } | null>(null)
  const diaryStackRef = useRef<VaultBoundDiaryStack | null>(null)
  const [value, setValue] = useState<BaishouContextValue>({
    dbReady: false,
    storageReady: Platform.OS !== 'android',
    legacyRagReembedRequired: false,
    pendingFlutterLegacyMigration: null,
    legacyMigrationSourcePendingDeletion: null,
    deleteMigratedLegacySource: () => deleteMigratedLegacySourceRef.current(),
    vaultRevision: 0,
    notifyArchiveRestoreComplete: (result) => notifyArchiveRestoreCompleteRef.current(result),
    notifyVersionMigrationComplete: () => notifyVersionMigrationCompleteRef.current(),
    archiveRestoreEpoch: 0,
    vaultSwitching: false,
    storageIndexing: mobileDataBootstrapper.getStatus() === 'running',
    ecosystemResyncEpoch: 0,
    retryStorageSetup: (options) => retryStorageSetupRef.current(options),
    runWithStorageQuiesced: (fn) => runWithStorageQuiescedRef.current(fn),
    resyncAfterMigration: () => resyncAfterMigrationRef.current(),
    services: null
  })

  useEffect(() => {
    const unsubscribeCacheCoordinator = initMobileCacheCoordinator()
    return unsubscribeCacheCoordinator
  }, [])

  useEffect(() => {
    let isMounted = true
    let mobileMcpService: MobileMcpService | null = null
    let wasStorageIndexing =
      mobileDataBootstrapper.getStatus() === 'running' || getShadowVaultScanning()

    const publishStorageIndexing = () => {
      if (!isMounted) return
      const indexing =
        mobileDataBootstrapper.getStatus() === 'running' || getShadowVaultScanning()
      if (wasStorageIndexing && !indexing) {
        emitSyncMutation('resync-complete', 'storage-indexing-complete')
      }
      setValue((prev) => ({
        ...prev,
        storageIndexing: indexing,
        ecosystemResyncEpoch:
          wasStorageIndexing && !indexing
            ? prev.ecosystemResyncEpoch + 1
            : prev.ecosystemResyncEpoch
      }))
      wasStorageIndexing = indexing
    }

    const unsubscribeBootstrapper = mobileDataBootstrapper.subscribe(() => {
      publishStorageIndexing()
    })
    const unsubscribeShadowScan = subscribeShadowVaultScanning(() => {
      publishStorageIndexing()
    })

    async function init() {
      try {
        // 1. 初始化 SQLite 环境（单例，避免并发 open + 迁移）
        const { drizzleDb, expoDb, sqliteVecLoaded, sqliteVecLoadReason } =
          await ensureExpoAgentDatabaseInstalled(
            () => SQLite.openDatabaseAsync('baishou_next_mobile.db') as Promise<ExpoSqliteDatabase>
          )

        if (sqliteVecLoaded) {
          logger.info('[BaishouProvider] Native sqlite-vec extension active on agent database.')
        } else {
          logger.warn(
            '[BaishouProvider] sqlite-vec not active; vector search uses JS fallback. Rebuild with pnpm dev:mobile:clear if needed.',
            sqliteVecLoadReason
          )
        }

        const fileSystem = createMobileFileSystem()
        setupMobileLocalFileReader(fileSystem)
        setupMobileTtsRefAudioReader(fileSystem)
        const pathService = new MobileStoragePathService(fileSystem) as any

        // 3. 构建 Repositories
        const sessionRepo = new SessionRepository(drizzleDb)
        const assistantRepo = new AssistantRepository(drizzleDb)
        const settingsRepo = new SettingsRepository(drizzleDb)
        const summaryRepo = new SummaryRepositoryImpl(drizzleDb)
        const profileRepo = new UserProfileRepository(drizzleDb)
        const attachmentManager = new MobileAttachmentManagerService(pathService, fileSystem)

        try {
          const pendingCloudSyncRaw = await AsyncStorage.getItem(
            PENDING_RESTORE_CLOUD_SYNC_CONFIG_KEY
          )
          if (pendingCloudSyncRaw) {
            await AsyncStorage.removeItem(PENDING_RESTORE_CLOUD_SYNC_CONFIG_KEY)
            await settingsRepo.set(
              'cloud_sync_config' as never,
              JSON.parse(pendingCloudSyncRaw) as never
            )
          }
        } catch (pendingCloudSyncError) {
          logger.warn(
            '[BaishouProvider] Failed to apply deferred cloud_sync_config after restore:',
            pendingCloudSyncError as Error
          )
        }

        let legacyRagReembedRequired = false
        let pendingFlutterLegacyMigration: FlutterLegacyMigrationPending | null = null
        let legacyMigrationSourcePendingDeletion: string | null = null

        try {
          const installInstanceId = await getMobileInstallInstanceId()
          migrationRuntimeRef.current = {
            fileSystem,
            expoDb,
            settingsRepo,
            profileRepo,
            pathService,
            installInstanceId
          }

          pendingFlutterLegacyMigration = await detectFlutterLegacyMigrationPending(
            fileSystem,
            installInstanceId
          )
          legacyMigrationSourcePendingDeletion = await AsyncStorage.getItem(
            FLUTTER_LEGACY_MIGRATED_SOURCE_KEY
          )
        } catch (legacyDetectError) {
          logger.warn(
            '[BaishouProvider] Legacy migration detection failed:',
            legacyDetectError as Error
          )
        }

        try {
          const pending = await settingsRepo.get<boolean>('legacy_upgrade_rag_pending' as never)
          if (pending) legacyRagReembedRequired = true
        } catch {
          // ignore
        }

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
        const assistantManager = new AssistantManagerService(
          assistantRepo,
          assistantFileService,
          attachmentManager
        )

        const vaultService = new VaultService(pathService, fileSystem)

        const settingsFileService = new SettingsFileService(pathService, fileSystem)
        const settingsManager = new SettingsManagerService(settingsRepo, settingsFileService)
        const vaultRuntimeDeps = { pathService, vaultService, fileSystem, settingsManager }

        let diaryStack: VaultBoundDiaryStack | null = null
        let storageReady = Platform.OS !== 'android'
        let summaryConfig: Record<string, unknown> = {}
        if (Platform.OS === 'android') {
          try {
            const [stack, summaryConfigRaw] = await Promise.all([
              initVaultLayer(vaultRuntimeDeps),
              settingsManager.get<Record<string, unknown>>('summary_config')
            ])
            diaryStack = stack
            diaryStackRef.current = diaryStack
            summaryConfig = summaryConfigRaw || {}
          } catch (e) {
            if (isExternalStorageRequiredError(e)) {
              logger.info(
                '[BaishouProvider] Waiting for MANAGE_EXTERNAL_STORAGE; diary UI will prompt user'
              )
              storageReady = false
              summaryConfig =
                (await settingsManager.get<Record<string, unknown>>('summary_config')) || {}
            } else {
              throw e
            }
          }
        } else {
          const [stack, summaryConfigRaw] = await Promise.all([
            initVaultLayer(vaultRuntimeDeps),
            settingsManager.get<Record<string, unknown>>('summary_config')
          ])
          diaryStack = stack
          diaryStackRef.current = diaryStack
          summaryConfig = summaryConfigRaw || {}
        }

        const diaryServiceProxy = createVaultDiaryServiceProxy(diaryStackRef)
        const diarySearcher = diaryStack?.diarySearcher ?? EMPTY_DIARY_SEARCHER

        const summaryFileService = new SummaryFileService(pathService, fileSystem)
        const diaryRepoAdapter = diaryStack?.diaryRepoAdapter ?? EMPTY_DIARY_REPO_ADAPTER
        const customTemplates = resolveSummaryTemplatesForGeneration(summaryConfig)
        const promptLocale = (summaryConfig?.promptLocale ?? 'zh') as SummaryPromptLocale
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

        const MOBILE_DB_NAME = 'baishou_next_mobile.db'
        const openAgentDatabase = (options?: { newConnection?: boolean }) => () =>
          SQLite.openDatabaseAsync(
            MOBILE_DB_NAME,
            options?.newConnection ? { useNewConnection: true } : undefined
          ) as Promise<ExpoSqliteDatabase>

        const sqlExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
        const hsRepo = new SqliteHybridSearchRepository(sqlExecutor)
        const hybridSearchService = new HybridSearchService(hsRepo)

        agentDbRuntimeRef.current = {
          expoDb,
          drizzleDb,
          sessionRepo,
          assistantRepo,
          settingsRepo,
          summaryRepo,
          profileRepo,
          snapshotRepo,
          sessionManager,
          assistantManager,
          settingsManager,
          summaryManager,
          summaryGenerator,
          missingSummaryDetector,
          summarySyncService,
          sqlExecutor,
          hsRepo,
          hybridSearchService
        }

        const archiveDbBridge: MobileArchiveDbBridge = {
          flushBeforeExport: async () => {
            const runtime = agentDbRuntimeRef.current
            if (!runtime) return
            await runtime.settingsManager.flushToDisk()
            try {
              await runtime.expoDb.execAsync('PRAGMA wal_checkpoint(FULL)')
            } catch (checkpointError) {
              logger.error(
                '[MobileArchive] WAL checkpoint before export failed:',
                checkpointError as Error
              )
              throw new Error('数据库刷盘失败，已取消导出以保护备份完整性')
            }
          },
          getMaxSnapshotCount: async () => {
            const runtime = agentDbRuntimeRef.current
            if (!runtime) return 5
            const config = await runtime.settingsManager.get<SyncConfig>('cloud_sync_config')
            return config?.maxSnapshotCount ?? 5
          },
          exportDevicePreferences: async () => {
            const runtime = agentDbRuntimeRef.current
            if (!runtime) return {}
            const prefs = await runtime.settingsRepo.getAll()
            const profile = await runtime.profileRepo.getProfile()
            return { ...prefs, user_profile_data: profile }
          },
          importDevicePreferences: async (prefs) => {
            const runtime = agentDbRuntimeRef.current
            if (!runtime) return
            for (const [key, value] of Object.entries(prefs)) {
              if (key === 'user_profile_data' || key === 'user_profile') continue
              if (value !== undefined && value !== null) {
                await runtime.settingsRepo.set(key, value as never)
              }
            }
            if (prefs.user_profile_data) {
              await runtime.profileRepo.saveProfile(prefs.user_profile_data as never)
            } else if (prefs.user_profile) {
              await runtime.profileRepo.saveProfile(prefs.user_profile as never)
            }
            await runtime.settingsManager.flushToDisk()
          },
          readPreservedImportSettings: async () => {
            const runtime = agentDbRuntimeRef.current
            if (!runtime) return {}
            return {
              cloud_sync_config: await runtime.settingsRepo.get('cloud_sync_config' as never)
            }
          },
          getAgentDatabaseUri: async () => `${getAppDocumentDirectory()}SQLite/${MOBILE_DB_NAME}`,
          replaceAgentDatabaseFrom: async (sourceUri) => {
            await releaseExpoAgentDatabaseInstall()
            const sqliteDir = `${getAppDocumentDirectory()}SQLite/`
            const destBase = `${sqliteDir}${MOBILE_DB_NAME}`
            for (const suffix of ['', '-wal', '-shm']) {
              const candidate = `${destBase}${suffix}`
              if (await fileSystem.exists(candidate)) {
                await fileSystem.unlink(candidate)
              }
            }
            await fileSystem.copyFile(sourceUri, destBase)
            await reloadAgentDatabaseRef.current()
          },
          runArchiveImportQuiesced: async (fn) => {
            archiveFullRestoreDoneRef.current = false
            enterAgentMigrationArchiveImport()
            try {
              return await runWithStorageQuiescedRef.current(fn)
            } finally {
              exitAgentMigrationArchiveImport()
              archiveFullRestoreDoneRef.current = false
            }
          },
          rebootstrapAfterArchiveRestore: async (options) => {
            const ctx = vaultBootstrapCtxRef.current
            if (!ctx) return
            // 数据根已被覆盖，旧 diary stack 指向已删除路径，不可再用于 prepareVaultSwitch
            diaryStackRef.current = null
            emitVaultSwitchMutation(undefined, 'archive-restore')
            const stack = await rebootstrapAfterStorageRootChange(
              {
                pathService: ctx.pathService,
                vaultService: ctx.vaultService,
                fileSystem: ctx.fileSystem,
                bootstrapDeps: ctx.bootstrapDeps,
                watcherDeps: ctx.watcherDeps
              },
              { blockingResync: options?.blockingResync ?? true }
            )
            diaryStackRef.current = stack
            archiveFullRestoreDoneRef.current = true
            const runtime = agentDbRuntimeRef.current
            if (!runtime) return
            await reconcileUserAvatarProfileAfterStorageChange(
              runtime.settingsManager,
              ctx.pathService,
              ctx.fileSystem
            )
            await reconcileAssistantAvatarsAfterStorageChange(
              runtime.assistantManager,
              ctx.pathService,
              ctx.fileSystem
            )

            const summaryPipeline = await createSummaryPipelineServices({
              drizzleDb: runtime.drizzleDb,
              pathService: ctx.pathService,
              fileSystem: ctx.fileSystem,
              settingsManager: runtime.settingsManager,
              diaryRepoAdapter: stack.diaryRepoAdapter
            })
            ctx.bootstrapDeps.summarySyncService = summaryPipeline.summarySyncService
            ctx.watcherDeps.summarySyncService = summaryPipeline.summarySyncService
            registerVaultBootstrapDeps(stack, ctx.bootstrapDeps)
            agentDbRuntimeRef.current = {
              ...runtime,
              summaryManager: summaryPipeline.summaryManager,
              summaryGenerator: summaryPipeline.summaryGenerator,
              missingSummaryDetector: summaryPipeline.missingSummaryDetector,
              summarySyncService: summaryPipeline.summarySyncService
            }
            if (options?.deferSummaryScan) {
              void summaryPipeline.summarySyncService.fullScanArchives().catch((e) => {
                logger.warn(
                  '[BaishouProvider] deferred summary fullScanArchives after archive restore failed:',
                  e as Error
                )
              })
            } else {
              try {
                await summaryPipeline.summarySyncService.fullScanArchives()
              } catch (e) {
                logger.warn(
                  '[BaishouProvider] summary fullScanArchives after archive restore failed:',
                  e as Error
                )
              }
            }

            void backfillExpoAgentMessagesFts(runtime.drizzleDb, runtime.expoDb).catch((e) => {
              logger.warn('[BaishouProvider] Agent FTS backfill after archive import failed:', e)
            })

            const nextRagDeps = {
              settingsManager: runtime.settingsManager,
              diaryService: stack.diaryService,
              hsRepo: runtime.hsRepo,
              hybridSearchService: runtime.hybridSearchService,
              registry: ctx.registry,
              rawSqlClient: runtime.sqlExecutor
            }
            setMobileDiaryEmbeddingDeps(nextRagDeps)
            ctx.ragServiceRef.current = createMobileRagService(nextRagDeps)
            if (isMounted) {
              setValue((prev) => ({
                ...prev,
                vaultRevision: prev.vaultRevision + 1,
                archiveRestoreEpoch: prev.archiveRestoreEpoch + 1,
                services: prev.services
                  ? {
                      ...prev.services,
                      ragService: ctx.ragServiceRef.current,
                      summaryManager: summaryPipeline.summaryManager,
                      summaryGenerator: summaryPipeline.summaryGenerator,
                      missingSummaryDetector: summaryPipeline.missingSummaryDetector
                    }
                  : prev.services
              }))
            }
          },
          importLegacyFlutterZip: async (extractDir, stagingRoot, options) => {
            const runtime = agentDbRuntimeRef.current
            if (!runtime) {
              throw new Error('数据库运行时未就绪，无法导入原版备份')
            }
            await runMobileLegacyZipMigration({
              fileSystem,
              extractDir,
              targetRoot: stagingRoot,
              settingsRepo: runtime.settingsRepo,
              profileRepo: runtime.profileRepo,
              onCopyProgress: options?.onCopyProgress
            })
            await runtime.settingsRepo.set('legacy_upgrade_rag_pending' as never, true as never)
          }
        }

        const syncMetaDir = `${await pathService.getGlobalRegistryDirectory()}/sync-meta`
        const syncDeviceId = await resolveSyncDeviceId('mobile', syncMetaDir, {
          exists: (p) => fileSystem.exists(p),
          read: (p) => fileSystem.readFile(p),
          write: (p, content) => fileSystem.writeFile(p, content),
          mkdir: (p) => fileSystem.mkdir(p, { recursive: true })
        })

        const archiveService = new MobileArchiveService(
          pathService,
          vaultService,
          fileSystem,
          archiveDbBridge
        )
        const lanSyncService = new MobileLanSyncService(archiveService, fileSystem, syncDeviceId)
        const cloudSyncService = new MobileCloudSyncService(archiveService, fileSystem)
        const incrementalSyncService = new MobileIncrementalSyncService(
          settingsManager,
          archiveService,
          pathService,
          fileSystem,
          mobileDataBootstrapper,
          syncDeviceId,
          () => {
            if (!isMounted) return
            setValue((prev) => ({
              ...prev,
              vaultRevision: prev.vaultRevision + 1
            }))
          },
          assistantManager
        )

        const updaterService = new MobileUpdaterService(settingsManager)
        const pricingService = mobilePricingService

        void pricingService.ensureLoaded()
        void updaterService.checkOnBootIfEnabled().catch((e) => {
          logger.warn('[MobileUpdater] boot check failed:', e)
        })

        const toolRegistry = new ToolRegistry()
        const registry = AIProviderRegistry.getInstance()
        registry.initializeDefaultProviders()

        // 日记全文搜索器（与桌面端 createDiarySearcher 对齐）
        const getDiarySearcher = () => diaryStackRef.current?.diarySearcher ?? diarySearcher

        mobileMcpService = new MobileMcpService(
          settingsManager,
          toolRegistry,
          () => {
            const runtime = agentDbRuntimeRef.current
            return buildMobileMcpToolContext({
              settingsManager: runtime?.settingsManager ?? settingsManager,
              pathService,
              getDiarySearcher,
              drizzleDb: runtime?.drizzleDb ?? drizzleDb,
              webSearchResultFetcher: webFetchContent,
              fetchSearchPage: fetchSearchPageHtml
            })
          },
          () =>
            buildMobileMcpToolListContext({
              settingsManager: agentDbRuntimeRef.current?.settingsManager ?? settingsManager,
              pathService
            })
        )

        const ragServiceDeps = {
          settingsManager,
          diaryService: diaryServiceProxy,
          hsRepo,
          hybridSearchService,
          registry,
          rawSqlClient: sqlExecutor
        }
        setMobileDiaryEmbeddingDeps(ragServiceDeps)
        const ragServiceRef = {
          current: createMobileRagService(ragServiceDeps)
        }

        /**
         * RAG 语义记忆搜索
         * 使用向量嵌入 + 混合搜索（FTS + 向量）进行真正的语义检索
         */
        const memorySearch = async (
          query: string,
          options?: { topK?: number; minScore?: number }
        ): Promise<Array<{ chunkText: string; score: number; createdAt?: number }>> => {
          if (!query.trim()) return []
          const runtime = agentDbRuntimeRef.current
          if (!runtime) return []
          try {
            const providers = (await runtime.settingsManager.get<any[]>('ai_providers')) || []
            const globalModels = await runtime.settingsManager.get<any>('global_models')

            // 获取嵌入模型配置
            const embeddingProviderId = globalModels?.globalEmbeddingProviderId
            const embeddingModelId = globalModels?.globalEmbeddingModelId

            if (!embeddingProviderId || !embeddingModelId) {
              logger.warn('[MemorySearch] 嵌入模型未配置，降级为 FTS 搜索')
              const ftsResults = await runtime.hsRepo.queryFTS(query, options?.topK ?? 20)
              return ftsResults.map((r) => ({
                chunkText: r.chunkText,
                score: r.score,
                createdAt: r.createdAt
              }))
            }

            const embeddingProviderConfig = providers.find((p: any) => p.id === embeddingProviderId)
            if (!embeddingProviderConfig) {
              logger.warn('[MemorySearch] 嵌入供应商配置未找到，降级为 FTS 搜索')
              const ftsResults = await runtime.hsRepo.queryFTS(query, options?.topK ?? 20)
              return ftsResults.map((r) => ({
                chunkText: r.chunkText,
                score: r.score,
                createdAt: r.createdAt
              }))
            }

            const embeddingProvider = registry.getOrUpdateProvider(embeddingProviderConfig)
            const embAdapter = new EmbeddingAdapter(
              embeddingProvider,
              embeddingModelId,
              runtime.hsRepo
            )

            // 生成查询向量
            const queryVector = await embAdapter.embedQuery(query)
            if (!queryVector) {
              logger.warn('[MemorySearch] 查询向量生成失败，降级为 FTS 搜索')
              const ftsResults = await runtime.hsRepo.queryFTS(query, options?.topK ?? 20)
              return ftsResults.map((r) => ({
                chunkText: r.chunkText,
                score: r.score,
                createdAt: r.createdAt
              }))
            }

            // 执行混合搜索（FTS + 向量 RRF 融合）
            const topK = options?.topK ?? 20
            const minScore = options?.minScore ?? 0.3

            const results = await runtime.hybridSearchService.search({
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
            const ftsResults = await runtime.hsRepo.queryFTS(query, options?.topK ?? 20)
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
            forceRecompress?: boolean
            streamClaimGeneration?: number
            attachments?: unknown[]
          }
        ) => {
          try {
            const runtime = agentDbRuntimeRef.current
            if (!runtime) throw new Error('数据库未就绪')
            const providers = (await runtime.settingsManager.get<any[]>('ai_providers')) || []
            const globalModels = await runtime.settingsManager.get<any>('global_models')

            const providerId = overrides?.providerId || globalModels?.globalDialogueProviderId
            const config =
              providers.find((p: any) => p.id === providerId) ||
              providers.find((p: any) => p.isEnabled)

            if (!config) throw new Error('No active provider configured')

            const provider = registry.getOrUpdateProvider(config)

            const searchMode = overrides?.searchMode ?? false
            const userConfig = await buildMobileStreamUserConfig(
              runtime.settingsManager,
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

            const namingModelConfigured =
              isConfiguredProviderId(globalModels?.globalNamingProviderId) &&
              isConfiguredDialogueModelId(globalModels?.globalNamingModelId)
            let namingProvider
            let namingModelId: string | undefined
            if (namingModelConfigured) {
              const namingConfig = providers.find(
                (p: any) => p.id === globalModels.globalNamingProviderId
              )
              if (namingConfig) {
                namingProvider = registry.getOrUpdateProvider(namingConfig)
                namingModelId = globalModels.globalNamingModelId
              }
            }

            const modelId =
              overrides?.modelId ||
              globalModels?.globalDialogueModelId ||
              config.defaultDialogueModel ||
              config.models[0]

            const systemModels = {
              namingModelConfigured,
              ...(namingProvider && namingModelId ? { namingProvider, namingModelId } : {}),
              ...(embeddingProvider && embeddingModelId
                ? { embeddingProvider, embeddingModelId }
                : {})
            }

            await agentService.streamChat(
              {
                sessionId,
                userText,
                provider,
                modelId,
                toolRegistry,
                sessionRepo: runtime.sessionRepo,
                snapshotRepo: runtime.snapshotRepo,
                userConfig,
                systemModels: Object.keys(systemModels).length > 0 ? systemModels : undefined,
                diarySearcher: getDiarySearcher(),
                webSearchResultFetcher: webFetchContent,
                fetchSearchPage: fetchSearchPageHtml,
                abortSignal: overrides?.abortSignal,
                userMessageId: overrides?.userMessageId,
                skipUserMessageRecording: overrides?.skipUserMessageRecording,
                forceRecompress: overrides?.forceRecompress,
                streamClaimGeneration: overrides?.streamClaimGeneration,
                attachments: overrides?.attachments as any
              },
              callbacks
            )
          } catch (e) {
            logger.error('Mobile Agent Chat Failed:', e as Error)
            throw e
          }
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
          summarySyncService,
          getActiveVaultName: () => pathService.getActiveVaultNameForContext()
        }

        const watcherDeps = {
          pathService,
          fileSystem,
          sessionFileService,
          sessionSyncService,
          sessionManager,
          summarySyncService
        }

        vaultBootstrapCtxRef.current = {
          pathService,
          vaultService,
          fileSystem,
          attachmentManager,
          bootstrapDeps,
          watcherDeps,
          registry,
          mobileMcpService,
          ragServiceRef
        }

        reloadAgentDatabaseRef.current = async () => {
          const ctx = vaultBootstrapCtxRef.current
          if (!ctx) {
            throw new Error('数据库运行时未就绪，无法完成恢复')
          }

          const priorMcp = ctx.mobileMcpService
          const mcpWasRunning = priorMcp?.isServerRunning() ?? false
          if (mcpWasRunning && priorMcp) {
            await priorMcp.stop()
          }

          const { drizzleDb: newDrizzleDb, expoDb: newExpoDb } =
            await ensureExpoAgentDatabaseInstalled(openAgentDatabase({ newConnection: true }))

          const diaryRepoAdapter =
            diaryStackRef.current?.diaryRepoAdapter ?? EMPTY_DIARY_REPO_ADAPTER

          const newRuntime = await createAgentDbRuntime({
            expoDb: newExpoDb,
            drizzleDb: newDrizzleDb,
            pathService: ctx.pathService,
            fileSystem: ctx.fileSystem,
            attachmentManager: ctx.attachmentManager,
            diaryRepoAdapter
          })
          agentDbRuntimeRef.current = newRuntime

          if (migrationRuntimeRef.current) {
            migrationRuntimeRef.current = {
              ...migrationRuntimeRef.current,
              expoDb: newExpoDb,
              settingsRepo: newRuntime.settingsRepo,
              profileRepo: newRuntime.profileRepo
            }
          }

          ctx.bootstrapDeps.sessionManager = newRuntime.sessionManager
          ctx.bootstrapDeps.assistantManager = newRuntime.assistantManager
          ctx.bootstrapDeps.settingsManager = newRuntime.settingsManager
          ctx.bootstrapDeps.summarySyncService = newRuntime.summarySyncService
          ctx.watcherDeps.sessionManager = newRuntime.sessionManager
          ctx.watcherDeps.summarySyncService = newRuntime.summarySyncService

          const stack = diaryStackRef.current
          const nextRagDeps = {
            settingsManager: newRuntime.settingsManager,
            diaryService: stack?.diaryService ?? diaryServiceProxy,
            hsRepo: newRuntime.hsRepo,
            hybridSearchService: newRuntime.hybridSearchService,
            registry: ctx.registry,
            rawSqlClient: newRuntime.sqlExecutor
          }
          setMobileDiaryEmbeddingDeps(nextRagDeps)
          ctx.ragServiceRef.current = createMobileRagService(nextRagDeps)
          emitSyncMutation('resync-complete', 'agent-db-reload')

          mobileMcpService = new MobileMcpService(
            newRuntime.settingsManager,
            toolRegistry,
            () => {
              const runtime = agentDbRuntimeRef.current
              return buildMobileMcpToolContext({
                settingsManager: runtime?.settingsManager ?? newRuntime.settingsManager,
                pathService: ctx.pathService,
                getDiarySearcher,
                drizzleDb: runtime?.drizzleDb ?? newDrizzleDb,
                webSearchResultFetcher: webFetchContent,
                fetchSearchPage: fetchSearchPageHtml
              })
            },
            () =>
              buildMobileMcpToolListContext({
                settingsManager: newRuntime.settingsManager,
                pathService: ctx.pathService
              })
          )
          ctx.mobileMcpService = mobileMcpService
          if (mcpWasRunning) {
            await mobileMcpService.start().catch((mcpErr) => {
              logger.warn('[BaishouProvider] MCP restart after DB reload failed:', mcpErr as Error)
            })
          }

          const nextIncrementalSyncService = new MobileIncrementalSyncService(
            newRuntime.settingsManager,
            archiveService,
            ctx.pathService,
            ctx.fileSystem,
            mobileDataBootstrapper,
            syncDeviceId,
            () => {
              if (!isMounted) return
              setValue((prev) => ({
                ...prev,
                vaultRevision: prev.vaultRevision + 1
              }))
            },
            newRuntime.assistantManager
          )

          if (isMounted) {
            setValue((prev) => ({
              ...prev,
              services: prev.services
                ? {
                    ...prev.services,
                    sessionManager: newRuntime.sessionManager,
                    sessionRepo: newRuntime.sessionRepo,
                    snapshotRepo: newRuntime.snapshotRepo,
                    assistantManager: newRuntime.assistantManager,
                    settingsManager: newRuntime.settingsManager,
                    summaryManager: newRuntime.summaryManager,
                    summaryGenerator: newRuntime.summaryGenerator,
                    missingSummaryDetector: newRuntime.missingSummaryDetector,
                    ragService: ctx.ragServiceRef.current,
                    mobileMcpService: mobileMcpService!,
                    incrementalSyncService: nextIncrementalSyncService,
                    updaterService: new MobileUpdaterService(newRuntime.settingsManager)
                  }
                : prev.services
            }))
          }
        }

        const runStorageBootstrap = async (options?: {
          forceDeferResync?: boolean
          resyncReason?: string
        }): Promise<VaultBoundDiaryStack> => {
          const stack = diaryStackRef.current ?? (await initVaultLayer(vaultRuntimeDeps))
          diaryStackRef.current = stack

          const activeVault = vaultService.getActiveVault()
          if (activeVault?.path) {
            const forceShadowResync = await consumeAppUpgradeShadowResync()
            await activateVaultRuntime(
              {
                pathService,
                vaultService,
                fileSystem,
                diaryStack: stack,
                bootstrapDeps,
                watcherDeps
              },
              {
                deferResync: true,
                forceDeferResync: options?.forceDeferResync,
                forceShadowResync,
                resyncReason: options?.resyncReason ?? 'cold-start',
                onResyncComplete: () => {
                  if (!isMounted) return
                  setValue((prev) => ({
                    ...prev,
                    vaultRevision: prev.vaultRevision + 1
                  }))
                }
              }
            )
          } else {
            logger.warn('[BaishouProvider] No active vault; skipped bootstrap and file watcher')
          }

          return stack
        }

        const switchVault = async (vaultName: string) => {
          const active = vaultService.getActiveVault()
          if (active?.name === vaultName) {
            return
          }

          if (isMounted) {
            setValue((prev) => ({ ...prev, vaultSwitching: true }))
          }

          try {
            const stack = await switchVaultRuntime(vaultName, {
              pathService,
              vaultService,
              fileSystem,
              bootstrapDeps,
              watcherDeps,
              currentStack: diaryStackRef.current ?? undefined,
              callbacks: {
                onStackInvalidated: () => {
                  diaryStackRef.current = null
                  setMobileDiaryEmbeddingDeps(null)
                },
                onStackReady: (readyStack) => {
                  diaryStackRef.current = readyStack
                  const nextRagDeps = {
                    settingsManager,
                    diaryService: readyStack.diaryService,
                    hsRepo,
                    hybridSearchService,
                    registry,
                    rawSqlClient: sqlExecutor
                  }
                  setMobileDiaryEmbeddingDeps(nextRagDeps)
                  ragServiceRef.current = createMobileRagService(nextRagDeps)
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

            const runtime = agentDbRuntimeRef.current
            if (runtime && stack && isMounted) {
              const activeVaultName = vaultService.getActiveVault()?.name ?? null
              const summaryPipeline = await rebindSummaryPipelineForVault({
                drizzleDb: runtime.drizzleDb,
                pathService,
                fileSystem,
                settingsManager,
                diaryRepoAdapter: stack.diaryRepoAdapter,
                activeVaultName
              })
              bootstrapDeps.summarySyncService = summaryPipeline.summarySyncService
              watcherDeps.summarySyncService = summaryPipeline.summarySyncService
              registerVaultBootstrapDeps(stack, bootstrapDeps)
              agentDbRuntimeRef.current = {
                ...runtime,
                summaryManager: summaryPipeline.summaryManager,
                summaryGenerator: summaryPipeline.summaryGenerator,
                missingSummaryDetector: summaryPipeline.missingSummaryDetector,
                summarySyncService: summaryPipeline.summarySyncService
              }
              setValue((prev) => ({
                ...prev,
                vaultRevision: prev.vaultRevision + 1,
                services: prev.services
                  ? {
                      ...prev.services,
                      ragService: ragServiceRef.current,
                      summaryManager: summaryPipeline.summaryManager,
                      summaryGenerator: summaryPipeline.summaryGenerator,
                      missingSummaryDetector: summaryPipeline.missingSummaryDetector,
                      switchVault,
                      deleteVault
                    }
                  : prev.services
              }))
            }

            emitVaultSwitchMutation(vaultName)
          } catch (e) {
            logger.error('[BaishouProvider] switchVault failed:', e as Error)
            throw e
          } finally {
            if (isMounted) {
              setValue((prev) => ({ ...prev, vaultSwitching: false }))
            }
          }
        }

        const deleteVault = async (vaultName: string) => {
          await deleteVaultWithShadowCleanup(vaultName, { vaultService })
          if (isMounted) {
            setValue((prev) => ({
              ...prev,
              vaultRevision: prev.vaultRevision + 1
            }))
          }
        }

        if (diaryStack) {
          storageReady = true
          try {
            await runStorageBootstrap()
          } catch (e) {
            if (Platform.OS === 'android' && isExternalStorageRequiredError(e)) {
              logger.info(
                '[BaishouProvider] Vault bootstrap deferred until external storage is granted'
              )
              if (isMounted) {
                setValue((prev) => ({ ...prev, storageReady: false }))
              }
            } else {
              logger.error('[BaishouProvider] Vault bootstrap failed:', e as Error)
              if (isMounted) {
                setValue((prev) => ({ ...prev, storageReady: false }))
              }
            }
          }
        }

        retryStorageSetupRef.current = async (options?: { forceDeferResync?: boolean }) => {
          try {
            if (Platform.OS === 'android') {
              const applied = await pathService.applyExternalRootWhenPermitted()
              if (!applied && !(await hasStoragePermission())) {
                return false
              }
            }

            const priorStack = diaryStackRef.current
            const bootstrapOptions = options?.forceDeferResync
              ? { forceDeferResync: true as const, resyncReason: 'legacy-migration-complete' }
              : undefined
            const stack = !priorStack
              ? await runStorageBootstrap(bootstrapOptions)
              : await rebootstrapAfterStorageRootChange({
                  pathService,
                  vaultService,
                  fileSystem,
                  diaryStack: priorStack,
                  bootstrapDeps,
                  watcherDeps
                })
            diaryStackRef.current = stack

            ragServiceRef.current = createMobileRagService({
              settingsManager,
              diaryService: stack.diaryService,
              hsRepo,
              hybridSearchService,
              registry,
              rawSqlClient: sqlExecutor
            })
            setMobileDiaryEmbeddingDeps({
              settingsManager,
              diaryService: stack.diaryService,
              hsRepo,
              hybridSearchService,
              registry,
              rawSqlClient: sqlExecutor
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

        deleteMigratedLegacySourceRef.current = async () => {
          const runtime = migrationRuntimeRef.current
          if (!runtime) return false

          const sourceRoot = await AsyncStorage.getItem(FLUTTER_LEGACY_MIGRATED_SOURCE_KEY)
          if (!sourceRoot) return false

          const targetRoot = resolveFlutterLegacyMigrationTargetRoot()
          try {
            await deleteMigratedLegacySourceRoot({
              fileSystem: runtime.fileSystem,
              sourceRoot,
              targetRoot,
              installInstanceId: runtime.installInstanceId
            })
            await AsyncStorage.removeItem(FLUTTER_LEGACY_MIGRATED_SOURCE_KEY)
            if (isMounted) {
              setValue((prev) => ({
                ...prev,
                legacyMigrationSourcePendingDeletion: null
              }))
            }
            return true
          } catch (error) {
            logger.warn(
              '[BaishouProvider] Failed to delete migrated legacy source:',
              error as Error
            )
            return false
          }
        }

        runWithStorageQuiescedRef.current = async <T,>(fn: () => Promise<T>): Promise<T> => {
          let mcpWasRunning = false
          const stack = diaryStackRef.current
          let result: T | undefined
          let fnError: unknown
          let resumeError: unknown
          if (isMounted) {
            setValue((prev) => ({ ...prev, vaultSwitching: true }))
          }
          try {
            const runtime = agentDbRuntimeRef.current
            await quiesceStorageForFileCopy({
              currentStack: stack ?? undefined,
              settingsManager: runtime?.settingsManager ?? settingsManager
            })
            const activeMcp = vaultBootstrapCtxRef.current?.mobileMcpService ?? mobileMcpService
            if (activeMcp?.isServerRunning()) {
              mcpWasRunning = true
              await activeMcp.stop()
            }
            result = await fn()
          } catch (e) {
            fnError = e
          } finally {
            try {
              const ctx = vaultBootstrapCtxRef.current
              const runtime = agentDbRuntimeRef.current
              if (archiveFullRestoreDoneRef.current) {
                const stack = diaryStackRef.current
                if (stack && ctx && runtime) {
                  const resumedRagDeps = {
                    settingsManager: runtime.settingsManager,
                    diaryService: stack.diaryService,
                    hsRepo: runtime.hsRepo,
                    hybridSearchService: runtime.hybridSearchService,
                    registry: ctx.registry,
                    rawSqlClient: runtime.sqlExecutor
                  }
                  setMobileDiaryEmbeddingDeps(resumedRagDeps)
                  ctx.ragServiceRef.current = createMobileRagService(resumedRagDeps)
                }
              } else {
                const priorStack = diaryStackRef.current
                if (priorStack && ctx && runtime) {
                  diaryStackRef.current = null
                  try {
                    const resumedStack = await resumeStorageAfterFileCopy({
                      pathService: ctx.pathService,
                      vaultService: ctx.vaultService,
                      fileSystem: ctx.fileSystem,
                      bootstrapDeps: ctx.bootstrapDeps,
                      watcherDeps: ctx.watcherDeps
                    })
                    diaryStackRef.current = resumedStack
                    const resumedRagDeps = {
                      settingsManager: runtime.settingsManager,
                      diaryService: resumedStack.diaryService,
                      hsRepo: runtime.hsRepo,
                      hybridSearchService: runtime.hybridSearchService,
                      registry: ctx.registry,
                      rawSqlClient: runtime.sqlExecutor
                    }
                    setMobileDiaryEmbeddingDeps(resumedRagDeps)
                    ctx.ragServiceRef.current = createMobileRagService(resumedRagDeps)
                  } catch (caughtResumeError) {
                    logger.error(
                      '[BaishouProvider] resumeStorageAfterFileCopy failed, retrying setup:',
                      caughtResumeError as Error
                    )
                    const recovered = await retryStorageSetupRef.current()
                    if (!recovered) {
                      diaryStackRef.current = priorStack
                      resumeError = caughtResumeError
                    }
                  }
                } else {
                  await retryStorageSetupRef.current()
                }
              }
              if (mcpWasRunning) {
                const activeMcp = vaultBootstrapCtxRef.current?.mobileMcpService ?? mobileMcpService
                await activeMcp?.start()
              }
              if (isMounted) {
                const ragRef = vaultBootstrapCtxRef.current?.ragServiceRef ?? ragServiceRef
                const stack = diaryStackRef.current
                setValue((prev) => ({
                  ...prev,
                  vaultSwitching: false,
                  vaultRevision: prev.vaultRevision + 1,
                  services: prev.services
                    ? {
                        ...prev.services,
                        ragService: ragRef.current,
                        ...(stack ? { diaryService: stack.diaryService } : {})
                      }
                    : prev.services
                }))
              }
            } catch (e) {
              logger.error('[BaishouProvider] runWithStorageQuiesced resume failed:', e as Error)
              if (isMounted) {
                setValue((prev) => ({ ...prev, vaultSwitching: false }))
              }
            }
          }
          if (resumeError) throw resumeError
          if (fnError) throw fnError
          return result as T
        }

        const getContextAtMessage = (sessionId: string, messageId: string, searchMode = false) => {
          const runtime = agentDbRuntimeRef.current
          if (!runtime) {
            return Promise.resolve({ messages: [], totalTokens: 0 } as never)
          }
          return loadContextAtMessage(
            {
              sessionRepo: runtime.sessionRepo,
              snapshotRepo: runtime.snapshotRepo,
              assistantManager: runtime.assistantManager,
              settingsManager: runtime.settingsManager,
              toolRegistry,
              diarySearcher: getDiarySearcher(),
              webSearchResultFetcher: webFetchContent,
              fetchSearchPage: fetchSearchPageHtml
            },
            sessionId,
            messageId,
            searchMode
          )
        }

        void getTtsPlaybackSettings(settingsManager).catch(() => {})

        if (Platform.OS === 'android' && !storageReady && (await hasStoragePermission())) {
          const mounted = await retryStorageSetupRef.current()
          if (mounted) storageReady = true
        }

        if (isMounted) {
          notifyArchiveRestoreCompleteRef.current = (result: ImportResult) => {
            if (!isMounted || !shouldRefreshVaultAfterArchiveImport(result)) return
            setValue((prev) => ({
              ...prev,
              vaultRevision: prev.vaultRevision + 1,
              archiveRestoreEpoch: prev.archiveRestoreEpoch + 1
            }))
          }

          resyncAfterMigrationRef.current = async () => {
            const stack = diaryStackRef.current
            const ctx = vaultBootstrapCtxRef.current
            if (!stack || !ctx) return
            await resyncEcosystemAfterFileMutation({
              diaryStack: stack,
              vaultService: ctx.vaultService,
              bootstrapDeps: ctx.bootstrapDeps,
              watcherDeps: ctx.watcherDeps
            })
            if (!isMounted) return
            emitSyncMutation('resync-complete', 'ecosystem-resync')
            setValue((prev) => ({
              ...prev,
              ecosystemResyncEpoch: prev.ecosystemResyncEpoch + 1
            }))
          }

          notifyVersionMigrationCompleteRef.current = () => {
            void (async () => {
              let markedComplete = false
              const runtime = migrationRuntimeRef.current
              if (runtime) {
                try {
                  const targetRoot = await runtime.pathService.getRootDirectory()
                  await markFlutterLegacyMigrationComplete({
                    installInstanceId: runtime.installInstanceId,
                    targetRoot
                  })
                  markedComplete = true
                } catch (error) {
                  logger.warn(
                    '[BaishouProvider] markFlutterLegacyMigrationComplete failed:',
                    error as Error
                  )
                }
              }
              if (!isMounted) return
              setValue((prev) => ({
                ...prev,
                vaultRevision: prev.vaultRevision + 1,
                ...(markedComplete ? { pendingFlutterLegacyMigration: null } : {})
              }))
            })()
          }

          setValue({
            dbReady: true,
            storageReady,
            legacyRagReembedRequired,
            pendingFlutterLegacyMigration,
            legacyMigrationSourcePendingDeletion,
            deleteMigratedLegacySource: () => deleteMigratedLegacySourceRef.current(),
            vaultRevision: 0,
            notifyArchiveRestoreComplete: (result) =>
              notifyArchiveRestoreCompleteRef.current(result),
            notifyVersionMigrationComplete: () => notifyVersionMigrationCompleteRef.current(),
            archiveRestoreEpoch: 0,
            vaultSwitching: false,
            storageIndexing: mobileDataBootstrapper.getStatus() === 'running',
            ecosystemResyncEpoch: 0,
            retryStorageSetup: (options) => retryStorageSetupRef.current(options),
            runWithStorageQuiesced: (fn) => runWithStorageQuiescedRef.current(fn),
            resyncAfterMigration: () => resyncAfterMigrationRef.current(),
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
              deleteVault,
              memorySearch,
              mobileMcpService,
              ragService: ragServiceRef.current,
              incrementalSyncService,
              attachmentManager,
              expoDb: agentDbRuntimeRef.current?.expoDb ?? null,
              settingsRepo: agentDbRuntimeRef.current?.settingsRepo ?? settingsRepo,
              profileRepo: agentDbRuntimeRef.current?.profileRepo ?? profileRepo,
              buildSharedContext,
              getContextAtMessage
            },
            startAgentChat
          })
          void warmAgentScreenCaches(settingsManager, attachmentManager)
        }

        void mobileMcpService?.start().catch((mcpErr) => {
          logger.warn('[BaishouProvider] MCP server failed to start:', mcpErr as Error)
        })
      } catch (e) {
        if (isExternalStorageRequiredError(e)) {
          logger.info(
            '[BaishouProvider] External storage is not ready; waiting for user permission'
          )
          return
        }
        logger.error('Failed to init Baishou DB:', e as Error)
      }
    }

    init()

    return () => {
      isMounted = false
      unsubscribeBootstrapper()
      unsubscribeShadowScan()
      unbindShadowVaultScanState()
      vaultFileWatcher.stop()
      sessionFileWatcher.stop()
      summaryFileWatcher.stop()
      void mobileMcpService?.stop()
    }
  }, [])

  useEffect(() => {
    setContextRecompressInvoker(async (sessionId) => {
      const runtime = agentDbRuntimeRef.current
      const ctx = vaultBootstrapCtxRef.current
      if (!runtime || !ctx) {
        return { ok: false, error: 'Database not ready' }
      }
      return recompressSessionContext(
        {
          sessionRepo: runtime.sessionRepo,
          snapshotRepo: runtime.snapshotRepo,
          settingsManager: runtime.settingsManager,
          registry: ctx.registry
        },
        sessionId
      )
    })
    return () => setContextRecompressInvoker(null)
  }, [])

  return <BaishouContext.Provider value={value}>{children}</BaishouContext.Provider>
}
