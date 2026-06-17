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
import { resolveSummaryTemplatesForGeneration } from '@baishou/shared'

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

export async function createAgentDbRuntime(options: CreateAgentDbRuntimeOptions): Promise<AgentDbRuntime> {
  const {
    expoDb,
    drizzleDb,
    pathService,
    fileSystem,
    attachmentManager,
    diaryRepoAdapter
  } = options

  const sessionRepo = new SessionRepository(drizzleDb)
  const assistantRepo = new AssistantRepository(drizzleDb)
  const settingsRepo = new SettingsRepository(drizzleDb)
  const summaryRepo = new SummaryRepositoryImpl(drizzleDb)
  const profileRepo = new UserProfileRepository(drizzleDb)
  const snapshotRepo = new SnapshotRepository(drizzleDb)

  const sessionFileService = new SessionFileService(pathService, fileSystem)
  const sessionSyncService = new SessionSyncService(sessionRepo, sessionFileService)
  const sessionManager = new SessionManagerService(sessionRepo, sessionFileService, sessionSyncService)

  const assistantFileService = new AssistantFileService(pathService, fileSystem)
  const assistantManager = new AssistantManagerService(
    assistantRepo,
    assistantFileService,
    attachmentManager
  )

  const settingsFileService = new SettingsFileService(pathService, fileSystem)
  const settingsManager = new SettingsManagerService(settingsRepo, settingsFileService)

  const summaryConfig = (await settingsManager.get<Record<string, unknown>>('summary_config')) || {}
  const customTemplates = resolveSummaryTemplatesForGeneration(summaryConfig) as Record<string, string>
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
  const summaryManager = new SummaryManagerService(summaryRepo, summaryFileService, summarySyncService)

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
    summarySyncService,
    sqlExecutor,
    hsRepo,
    hybridSearchService
  }
}
