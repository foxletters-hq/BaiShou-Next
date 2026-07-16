import { Platform } from 'react-native'
import { resolveSyncDeviceId, logger } from '@baishou/shared'
import { AIProviderRegistry, ToolRegistry } from '@baishou/ai'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import { MobileArchiveService } from '../../services/archive.service'
import { MobileLanSyncService } from '../../services/lan-sync.service'
import { MobileCloudSyncService } from '../../services/cloud-sync.service'
import { MobileIncrementalSyncService } from '../../services/mobile-incremental-sync.service'
import { MobileMcpService } from '../../services/mobile-mcp.service'
import {
  buildMobileMcpToolContext,
  buildMobileMcpToolListContext
} from '../../services/mobile-mcp-context.service'
import { mobileDataBootstrapper } from '../../services/mobile-bootstrapper.service'
import { MobileUpdaterService } from '../../services/mobile-updater.service'
import { mobilePricingService } from '../../services/mobile-pricing.service'
import { ensureMobileCompressionBridge } from '../../services/mobile-compression-event.service'
import { createMobileRagService } from '../../services/mobile-rag.service'
import { attachMobileRagVaultScope } from '../../services/mobile-rag-vault-scope'
import { setMobileDiaryEmbeddingDeps } from '../../services/mobile-diary-embedding.service'
import { isExternalStorageNativeAvailable } from 'expo-baishou-server'
import { fetchSearchPageHtml, webFetchContent } from './web-fetch'
import type {
  DiaryService,
  SessionManagerService,
  AssistantManagerService,
  SettingsManagerService,
  SessionFileService,
  SessionSyncService,
  VaultService,
  IFileSystem
} from '@baishou/core-mobile'
import type { AgentSessionService } from '@baishou/ai'
import type { SqliteHybridSearchRepository } from '@baishou/database'
import type { HybridSearchService, ToolDiarySearcher } from '@baishou/ai'
import type { MobileStoragePathService } from '../../services/path.service'
import type { MobileAttachmentManagerService } from '../../services/mobile-attachment-manager.service'
import type { VaultDiarySearcher } from '../../services/mobile-vault-runtime.service'
import type { SummarySyncService } from '@baishou/core-mobile'
import { createArchiveDbBridge } from './archive-db-bridge'
import { createMemorySearch } from './memory-search'
import { createStartAgentChat } from './start-agent-chat'
import { createMobileAgentGateRuntime } from './agent-gate-runtime'
import { assignReloadAgentDatabaseHandler } from './reload-agent-database'
import { createGetContextAtMessage } from './get-context-at-message'
import type { MobileBaishouInitContext } from './init-context'
import type { MobileBaishouCoreState } from './bootstrap-mobile-baishou-core'

export async function bootstrapMobileSyncLayer(
  ctx: MobileBaishouInitContext,
  state: MobileBaishouCoreState
): Promise<MobileBaishouCoreState> {
  const { refs } = ctx
  const isMounted = ctx.isMounted
  let mobileMcpService = state.mobileMcpService as MobileMcpService | null
  const openAgentDatabase = state.openAgentDatabase as (options?: {
    useNewConnection?: boolean
  }) => Promise<import('@baishou/database/expo').ExpoSqliteDatabase>
  const fileSystem = state.fileSystem as IFileSystem
  const pathService = state.pathService as MobileStoragePathService
  const vaultService = state.vaultService as VaultService
  const settingsManager = state.settingsManager as SettingsManagerService
  const agentService = state.agentService as AgentSessionService
  const hsRepo = state.hsRepo as SqliteHybridSearchRepository
  const hybridSearchService = state.hybridSearchService as HybridSearchService
  const sqlExecutor = state.sqlExecutor as ReturnType<
    typeof import('@baishou/database').createSqlExecutorFromDrizzleDb
  >
  const diaryServiceProxy = state.diaryServiceProxy as DiaryService
  const diarySearcher = state.diarySearcher as VaultDiarySearcher
  const sessionManager = state.sessionManager as SessionManagerService
  const assistantManager = state.assistantManager as AssistantManagerService
  const attachmentManager = state.attachmentManager as MobileAttachmentManagerService
  const summarySyncService = state.summarySyncService
  const sessionFileService = state.sessionFileService as SessionFileService
  const sessionSyncService = state.sessionSyncService as SessionSyncService
  const drizzleDb = state.drizzleDb
  const archiveDbBridge = createArchiveDbBridge({
    fileSystem,
    pathService,
    vaultService,
    refs,
    isMounted,
    setValue: ctx.setValue
  })
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
      if (!isMounted()) return
      ctx.setValue((prev) => ({
        ...prev,
        vaultRevision: prev.vaultRevision + 1
      }))
    },
    assistantManager,
    sessionManager
  )

  const updaterService = new MobileUpdaterService(settingsManager)
  const pricingService = mobilePricingService

  void pricingService.ensureLoaded()

  const toolRegistry = new ToolRegistry()
  const registry = AIProviderRegistry.getInstance()
  registry.initializeDefaultProviders()

  // 日记全文搜索器（与桌面端 createDiarySearcher 对齐）
  const getDiarySearcher = (): ToolDiarySearcher | undefined =>
    refs.diaryStackRef.current?.diarySearcher ?? diarySearcher

  ctx.mobileMcpServiceHolder.current = mobileMcpService = new MobileMcpService(
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

  const ragServiceDeps = attachMobileRagVaultScope(
    {
      settingsManager,
      diaryService: diaryServiceProxy,
      hsRepo,
      hybridSearchService,
      registry,
      rawSqlClient: sqlExecutor
    },
    pathService,
    vaultService
  )
  setMobileDiaryEmbeddingDeps(ragServiceDeps)
  const ragServiceRef = {
    current: createMobileRagService(ragServiceDeps)
  }

  const memorySearch = createMemorySearch({ pathService, registry, agentDbRuntimeRef })
  const agentGateRuntime = createMobileAgentGateRuntime(settingsManager)
  const startAgentChat = createStartAgentChat({
    agentService,
    toolRegistry,
    registry,
    agentDbRuntimeRef,
    getDiarySearcher,
    getAgentGate: agentGateRuntime.getAgentGate,
    persistBaishouAgentGateConfig: agentGateRuntime.persistBaishouAgentGateConfig
  })
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
    summarySyncService: summarySyncService as SummarySyncService,
    getActiveVaultName: () => pathService.getActiveVaultNameForContext(),
    getDiskVaultNames: async () => {
      const { listDiskVaultFolderNames } = await import('@baishou/core-mobile')
      const syncRoot = await pathService.getRootDirectory()
      return listDiskVaultFolderNames(fileSystem, syncRoot)
    }
  }

  const watcherDeps = {
    pathService,
    fileSystem,
    sessionFileService,
    sessionSyncService: sessionSyncService as SessionSyncService,
    sessionManager,
    summarySyncService: summarySyncService as SummarySyncService
  }

  refs.vaultBootstrapCtxRef.current = {
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

  assignReloadAgentDatabaseHandler(ctx, {
    openAgentDatabase,
    vaultService,
    pathService,
    toolRegistry,
    archiveService,
    syncDeviceId,
    getDiarySearcher,
    diaryServiceProxy,
    setValue: ctx.setValue,
    mobileMcpServiceHolder: ctx.mobileMcpServiceHolder
  })

  const getContextAtMessage = createGetContextAtMessage({
    toolRegistry,
    agentDbRuntimeRef,
    getDiarySearcher,
    getAgentGate: agentGateRuntime.getAgentGate
  })
  return {
    ...state,
    mobileMcpService,
    archiveService,
    lanSyncService,
    cloudSyncService,
    incrementalSyncService,
    updaterService,
    pricingService,
    toolRegistry,
    registry,
    syncDeviceId,
    ragServiceRef,
    memorySearch,
    startAgentChat,
    agentGate: agentGateRuntime.getAgentGate(),
    reloadAgentGateConfig: agentGateRuntime.reloadAgentGateConfig,
    getContextAtMessage,
    bootstrapDeps,
    watcherDeps,
    getDiarySearcher
  }
}
