import type { ReactNode } from 'react'
import type { ImportResult } from '@baishou/core-mobile'
import type {
  SessionManagerService,
  DiaryService,
  SettingsManagerService,
  SummaryManagerService,
  SummaryGeneratorService,
  MissingSummaryDetector,
  VaultService,
  IFileSystem,
  AssistantManagerService
} from '@baishou/core-mobile'
import type { SettingsRepository, UserProfileRepository } from '@baishou/database'
import type { SharedMemoryCopyPreview } from '@baishou/shared'
import type { IBaishouAgentGate, StreamChatCallbacks } from '@baishou/ai'
import type {
  SessionRepository as SessionRepositoryType,
  SnapshotRepository as SnapshotRepositoryType
} from '@baishou/database'
import type { AgentSessionService } from '@baishou/ai'
import type { MobileArchiveService } from '../../services/archive.service'
import type { MobileLanSyncService } from '../../services/lan-sync.service'
import type { MobileCloudSyncService } from '../../services/cloud-sync.service'
import type { MobileStoragePathService } from '../../services/path.service'
import type { MobileDeveloperService } from '../../services/developer.service'
import type { MobileUpdaterService } from '../../services/mobile-updater.service'
import type { MobilePricingService } from '../../services/mobile-pricing.service'
import type { MobileDataBootstrapper } from '../../services/mobile-bootstrapper.service'
import type { VaultFileWatcherService } from '../../services/vault-file-watcher.service'
import type { MobileRagService } from '../../services/mobile-rag.service'
import type { MobileIncrementalSyncService } from '../../services/mobile-incremental-sync.service'
import type { MobileAttachmentManagerService } from '../../services/mobile-attachment-manager.service'
import type { MobileMcpService } from '../../services/mobile-mcp.service'
import type { MobileContextAtMessagePayload } from '../../services/mobile-context-at-message.service'
import type { FlutterLegacyMigrationPending } from '../../services/mobile-legacy-migration.service'

export interface StartAgentChatOverrides {
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

export interface BaishouContextValue {
  dbReady: boolean
  storageReady: boolean
  legacyRagReembedRequired: boolean
  pendingFlutterLegacyMigration: FlutterLegacyMigrationPending | null
  legacyMigrationSourcePendingDeletion: string | null
  deleteMigratedLegacySource: () => Promise<boolean>
  vaultRevision: number
  notifyArchiveRestoreComplete: (result: ImportResult) => void
  notifyVersionMigrationComplete: () => void
  archiveRestoreEpoch: number
  vaultSwitching: boolean
  storageIndexing: boolean
  ecosystemResyncEpoch: number
  retryStorageSetup: (options?: { forceDeferResync?: boolean }) => Promise<boolean>
  runWithStorageQuiesced: <T>(fn: () => Promise<T>) => Promise<T>
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
    createDemoVault: () => Promise<{ vaultName: string; diaryCount: number; summaryCount: number }>
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
    buildSharedContext: (
      lookbackMonths: number,
      locale?: string,
      userCopyPrefix?: string,
      window?: { referenceDate?: Date; untilExclusive?: Date }
    ) => Promise<string>
    buildSharedContextPreview: (
      lookbackMonths: number,
      options?: { userCopyPrefix?: string; locale?: string }
    ) => Promise<SharedMemoryCopyPreview>
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
    overrides?: StartAgentChatOverrides
  ) => Promise<void>
  agentGate?: IBaishouAgentGate
  reloadAgentGateConfig?: () => Promise<void>
}

export interface BaishouProviderProps {
  children: ReactNode
}
