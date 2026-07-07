import AsyncStorage from '@react-native-async-storage/async-storage'
import * as SQLite from 'expo-sqlite'
import { Platform } from 'react-native'
import {
  ensureExpoAgentDatabaseInstalled,
  verifyExpoAgentDatabaseIntegrity,
  type ExpoSqliteDatabase
} from '@baishou/database/expo'
import {
  SessionManagerService,
  AssistantManagerService,
  AssistantFileService,
  SettingsManagerService,
  SettingsFileService,
  SummaryManagerService,
  SummaryGeneratorService,
  MissingSummaryDetector,
  SessionFileService,
  SummaryFileService,
  VaultService
} from '@baishou/core-mobile'
import { AgentSessionService } from '@baishou/ai'
import {
  resolveSummaryTemplatesForGeneration,
  logger,
  type SummaryPromptLocale
} from '@baishou/shared'
import {
  SessionRepository,
  AssistantRepository,
  SettingsRepository,
  UserProfileRepository,
  SummaryRepositoryImpl,
  SnapshotRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database'
import { HybridSearchService } from '@baishou/ai'
import { agentDbRuntimeRef } from '../../services/mobile-agent-db-runtime-ref'
import { createMobileFileSystem } from '../../services/create-mobile-file-system'
import { setupMobileLocalFileReader } from '../../services/mobile-local-file-reader.service'
import { setupMobileImageCompressor } from '../../services/mobile-image-compressor.service'
import { setupMobileTtsRefAudioReader } from '../../services/mobile-tts-ref-audio.service'
import { MobileStoragePathService } from '../../services/path.service'
import { MobileAttachmentManagerService } from '../../services/mobile-attachment-manager.service'
import { createMobileSessionDiskPersistenceHooks } from '../../services/session-file-watcher.service'
import {
  RecoveryAwareSessionSyncService,
  RecoveryAwareSummarySyncService
} from '../../services/recovery-aware-sync.services'
import {
  mobileAgentDbRecovery,
  MOBILE_AGENT_DB_NAME,
  rebuildMobileAgentDatabase
} from '../../services/mobile-agent-db-recovery.service'
import { MobileMcpService } from '../../services/mobile-mcp.service'
import { buildMobileSummaryAiClient } from '../../services/mobile-summary-ai-client'
import {
  createVaultDiaryServiceProxy,
  EMPTY_DIARY_REPO_ADAPTER,
  EMPTY_DIARY_SEARCHER,
  initVaultLayer,
  type VaultBoundDiaryStack
} from '../../services/mobile-vault-runtime.service'
import {
  FLUTTER_LEGACY_MIGRATED_SOURCE_KEY,
  PENDING_RESTORE_CLOUD_SYNC_CONFIG_KEY
} from '@/src/constants/storage'
import {
  detectFlutterLegacyMigrationPending,
  type FlutterLegacyMigrationPending
} from '../../services/mobile-legacy-migration.service'
import { getMobileInstallInstanceId } from '../../services/install-instance.service'
import { isExternalStorageRequiredError } from '../../services/storage-permission.service'
import { createSharedContextBuilders } from './shared-context-builders'
import { bootstrapMobileSyncLayer } from './bootstrap-mobile-sync-layer'
import { finalizeVaultRuntimeHandlers } from './finalize-vault-runtime-handlers'
import { finalizeStorageRefHandlers } from './finalize-storage-ref-handlers'
import { commitMobileBaishouReadyState } from './commit-mobile-baishou-ready-state'
import type { MobileBaishouInitContext } from './init-context'

export type MobileBaishouCoreState = Record<string, unknown>

export async function bootstrapMobileBaishouCore(ctx: MobileBaishouInitContext): Promise<void> {
  const { refs } = ctx
  const mobileMcpService: MobileMcpService | null = ctx.mobileMcpServiceHolder.current
  try {
    const openAgentDatabase = (options?: { useNewConnection?: boolean }) =>
      SQLite.openDatabaseAsync(
        MOBILE_AGENT_DB_NAME,
        options?.useNewConnection ? { useNewConnection: true } : undefined
      ) as Promise<ExpoSqliteDatabase>

    // 1. 初始化 SQLite 环境（单例，避免并发 open + 迁移）
    let install = await ensureExpoAgentDatabaseInstalled(openAgentDatabase)

    const fileSystem = createMobileFileSystem()
    setupMobileLocalFileReader(fileSystem)
    setupMobileImageCompressor()
    setupMobileTtsRefAudioReader(fileSystem)
    const pathService = new MobileStoragePathService(fileSystem) as any

    const startupIntegrity = await verifyExpoAgentDatabaseIntegrity(install.expoDb)
    let agentDbRebuiltAtStartup = false
    if (!startupIntegrity.ok) {
      logger.warn(
        `[BaishouProvider] Agent DB startup integrity failed (${startupIntegrity.detail ?? 'unknown'}), rebuilding…`
      )
      install = await rebuildMobileAgentDatabase(fileSystem, (options) =>
        openAgentDatabase({ ...options, useNewConnection: true })
      )
      agentDbRebuiltAtStartup = true
    }

    const { drizzleDb, expoDb, sqliteVecLoaded, sqliteVecLoadReason } = install

    if (sqliteVecLoaded) {
      logger.info('[BaishouProvider] Native sqlite-vec extension active on agent database.')
    } else {
      logger.warn(
        '[BaishouProvider] sqlite-vec not active; vector search uses JS fallback. Rebuild with pnpm dev:mobile:clear if needed.',
        sqliteVecLoadReason
      )
    }

    // 3. 构建 Repositories
    const sessionRepo = new SessionRepository(drizzleDb)
    const assistantRepo = new AssistantRepository(drizzleDb)
    const settingsRepo = new SettingsRepository(drizzleDb)
    const summaryRepo = new SummaryRepositoryImpl(drizzleDb)
    const profileRepo = new UserProfileRepository(drizzleDb)
    const attachmentManager = new MobileAttachmentManagerService(pathService, fileSystem)

    try {
      const pendingCloudSyncRaw = await AsyncStorage.getItem(PENDING_RESTORE_CLOUD_SYNC_CONFIG_KEY)
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
      refs.migrationRuntimeRef.current = {
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
    const sessionSyncService = new RecoveryAwareSessionSyncService(
      sessionRepo,
      sessionFileService,
      mobileAgentDbRecovery
    )
    const sessionManager = new SessionManagerService(
      sessionRepo,
      sessionFileService,
      sessionSyncService,
      createMobileSessionDiskPersistenceHooks()
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
        refs.diaryStackRef.current = diaryStack
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
      refs.diaryStackRef.current = diaryStack
      summaryConfig = summaryConfigRaw || {}
    }

    const diaryServiceProxy = createVaultDiaryServiceProxy(refs.diaryStackRef)
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
    const summarySyncService = new RecoveryAwareSummarySyncService(
      missingSummaryDetector,
      summaryGenerator,
      summaryRepo,
      summaryFileService,
      mobileAgentDbRecovery
    )
    const summaryManager = new SummaryManagerService(
      summaryRepo,
      summaryFileService,
      summarySyncService
    )

    const { buildSharedContext, buildSharedContextPreview } = createSharedContextBuilders({
      diaryStackRef: refs.diaryStackRef,
      summaryManager,
      settingsManager
    })
    const agentService = new AgentSessionService()

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
      sessionSyncService,
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

    const state: MobileBaishouCoreState = {
      mobileMcpService,
      openAgentDatabase,
      fileSystem,
      pathService,
      vaultService,
      vaultRuntimeDeps,
      settingsManager,
      attachmentManager,
      sessionRepo,
      snapshotRepo,
      assistantManager,
      summaryManager,
      summaryGenerator,
      missingSummaryDetector,
      agentService,
      hsRepo,
      hybridSearchService,
      sqlExecutor,
      diaryServiceProxy,
      diarySearcher,
      agentDbRebuiltAtStartup,
      legacyRagReembedRequired,
      pendingFlutterLegacyMigration,
      legacyMigrationSourcePendingDeletion,
      storageReady,
      diaryStack,
      buildSharedContext,
      buildSharedContextPreview,
      settingsRepo,
      profileRepo,
      sessionManager,
      summarySyncService,
      sessionFileService,
      sessionSyncService,
      drizzleDb,
      expoDb
    }
    const nextState = await bootstrapMobileSyncLayer(ctx, state)
    await finalizeVaultRuntimeHandlers(ctx, nextState)
    await finalizeStorageRefHandlers(ctx, nextState)
    await commitMobileBaishouReadyState(ctx, nextState)
  } catch (e) {
    if (isExternalStorageRequiredError(e)) {
      logger.info('[BaishouProvider] External storage is not ready; waiting for user permission')
      return
    }
    logger.error('Failed to init Baishou DB:', e as Error)
  }
}
