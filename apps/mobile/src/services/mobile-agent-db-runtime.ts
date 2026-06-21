import type { AppDatabase } from '@baishou/database'
import type { ExpoSqliteDatabase } from '@baishou/database/expo'
import {
  SessionRepository,
  AssistantRepository,
  SettingsRepository,
  SummaryRepositoryImpl,
  UserProfileRepository,
  SnapshotRepository,
  SqliteHybridSearchRepository,
  createSqlExecutorFromDrizzleDb
} from '@baishou/database'
import {
  SessionManagerService,
  SessionFileService,
  SessionSyncService,
  AssistantFileService,
  AssistantManagerService,
  SettingsFileService,
  SettingsManagerService,
  SummaryFileService,
  SummarySyncService,
  SummaryManagerService,
  MissingSummaryDetector,
  SummaryGeneratorService,
  type IFileSystem
} from '@baishou/core-mobile'
import { HybridSearchService } from '@baishou/ai'
import type { MobileStoragePathService } from './path.service'
import type { MobileAttachmentManagerService } from './mobile-attachment-manager.service'
import { buildMobileSummaryAiClient } from './mobile-summary-ai-client'
import { resolveSummaryTemplatesForGeneration, logger } from '@baishou/shared'

export type AgentDbRuntime = {
  expoDb: ExpoSqliteDatabase
  drizzleDb: AppDatabase
  sessionRepo: SessionRepository
  assistantRepo: AssistantRepository
  settingsRepo: SettingsRepository
  summaryRepo: SummaryRepositoryImpl
  profileRepo: UserProfileRepository
  snapshotRepo: SnapshotRepository
  sessionManager: SessionManagerService
  assistantManager: AssistantManagerService
  settingsManager: SettingsManagerService
  summaryManager: SummaryManagerService
  summaryGenerator: SummaryGeneratorService
  missingSummaryDetector: MissingSummaryDetector
  summarySyncService: SummarySyncService
  sqlExecutor: ReturnType<typeof createSqlExecutorFromDrizzleDb>
  hsRepo: SqliteHybridSearchRepository
  hybridSearchService: HybridSearchService
}

export type CreateAgentDbRuntimeOptions = {
  expoDb: ExpoSqliteDatabase
  drizzleDb: AppDatabase
  pathService: MobileStoragePathService
  fileSystem: IFileSystem
  attachmentManager: MobileAttachmentManagerService
  diaryRepoAdapter: unknown
}

export type SummaryPipelineServices = {
  summaryManager: SummaryManagerService
  summaryGenerator: SummaryGeneratorService
  missingSummaryDetector: MissingSummaryDetector
  summarySyncService: SummarySyncService
}

/** 归档/快照恢复后须用新的 diaryRepoAdapter 重建总结管线，否则统计与缺失检测仍读旧 Shadow 索引 */
export async function createSummaryPipelineServices(options: {
  drizzleDb: AppDatabase
  pathService: MobileStoragePathService
  fileSystem: IFileSystem
  settingsManager: SettingsManagerService
  diaryRepoAdapter: unknown
}): Promise<SummaryPipelineServices> {
  const { drizzleDb, pathService, fileSystem, settingsManager, diaryRepoAdapter } = options
  const summaryRepo = new SummaryRepositoryImpl(drizzleDb)
  const summaryConfig = (await settingsManager.get<Record<string, unknown>>('summary_config')) || {}
  const customTemplates = resolveSummaryTemplatesForGeneration(summaryConfig) as Record<
    string,
    string
  >
  const promptLocale = ((summaryConfig?.promptLocale as string | undefined) ?? 'zh') as 'zh' | 'en'
  const summaryAiClient = buildMobileSummaryAiClient(settingsManager)
  const summaryFileService = new SummaryFileService(pathService, fileSystem)
  const missingSummaryDetector = new MissingSummaryDetector(
    diaryRepoAdapter as never,
    summaryRepo as never
  )
  const summaryGenerator = new SummaryGeneratorService(
    diaryRepoAdapter as never,
    summaryRepo as never,
    summaryAiClient as never,
    customTemplates,
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
  return { summaryManager, summaryGenerator, missingSummaryDetector, summarySyncService }
}

/** 工作区切换后重建总结管线，并将 SQLite 总结缓存与当前 Vault 磁盘文件对齐 */
export async function rebindSummaryPipelineForVault(
  options: {
    drizzleDb: AppDatabase
    pathService: MobileStoragePathService
    fileSystem: IFileSystem
    settingsManager: SettingsManagerService
    diaryRepoAdapter: unknown
    activeVaultName?: string | null
  }
): Promise<SummaryPipelineServices> {
  const pipeline = await createSummaryPipelineServices({
    drizzleDb: options.drizzleDb,
    pathService: options.pathService,
    fileSystem: options.fileSystem,
    settingsManager: options.settingsManager,
    diaryRepoAdapter: options.diaryRepoAdapter
  })

  if (options.activeVaultName) {
    try {
      await pipeline.summarySyncService.fullScanArchives({
        activeVaultName: options.activeVaultName
      })
    } catch (e) {
      logger.warn('[SummaryPipeline] fullScanArchives after vault rebind failed:', e as Error)
    }
  }

  return pipeline
}

export async function createAgentDbRuntime(
  options: CreateAgentDbRuntimeOptions
): Promise<AgentDbRuntime> {
  const { expoDb, drizzleDb, pathService, fileSystem, attachmentManager, diaryRepoAdapter } =
    options

  const sessionRepo = new SessionRepository(drizzleDb)
  const assistantRepo = new AssistantRepository(drizzleDb)
  const settingsRepo = new SettingsRepository(drizzleDb)
  const summaryRepo = new SummaryRepositoryImpl(drizzleDb)
  const profileRepo = new UserProfileRepository(drizzleDb)
  const snapshotRepo = new SnapshotRepository(drizzleDb)

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

  const settingsFileService = new SettingsFileService(pathService, fileSystem)
  const settingsManager = new SettingsManagerService(settingsRepo, settingsFileService)

  const { summaryManager, summaryGenerator, missingSummaryDetector, summarySyncService } =
    await createSummaryPipelineServices({
      drizzleDb,
      pathService,
      fileSystem,
      settingsManager,
      diaryRepoAdapter
    })

  const sqlExecutor = createSqlExecutorFromDrizzleDb(drizzleDb)
  const hsRepo = new SqliteHybridSearchRepository(sqlExecutor)
  const hybridSearchService = new HybridSearchService(hsRepo)

  return {
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
}
