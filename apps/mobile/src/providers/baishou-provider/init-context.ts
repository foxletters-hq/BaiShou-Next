import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ImportResult } from '@baishou/core-mobile'
import type {
  SessionManagerService,
  AssistantManagerService,
  SettingsManagerService,
  SummarySyncService,
  SessionFileService,
  SessionSyncService,
  VaultService,
  IFileSystem
} from '@baishou/core-mobile'
import type { SettingsRepository, UserProfileRepository } from '@baishou/database'
import type { AIProviderRegistry } from '@baishou/ai'
import type { MobileMcpService } from '../../services/mobile-mcp.service'
import type { MobileStoragePathService } from '../../services/path.service'
import type { MobileAttachmentManagerService } from '../../services/mobile-attachment-manager.service'
import type { createMobileFileSystem } from '../../services/create-mobile-file-system'
import type { createMobileRagService } from '../../services/mobile-rag.service'
import type { VaultBoundDiaryStack } from '../../services/mobile-vault-runtime.service'
import type { BaishouContextValue } from './types'

export interface MobileBaishouInitRefs {
  retryStorageSetupRef: MutableRefObject<
    (options?: { forceDeferResync?: boolean }) => Promise<boolean>
  >
  runWithStorageQuiescedRef: MutableRefObject<<T>(fn: () => Promise<T>) => Promise<T>>
  deleteMigratedLegacySourceRef: MutableRefObject<() => Promise<boolean>>
  notifyArchiveRestoreCompleteRef: MutableRefObject<(result: ImportResult) => void>
  notifyVersionMigrationCompleteRef: MutableRefObject<() => void>
  resyncAfterMigrationRef: MutableRefObject<() => Promise<void>>
  reloadAgentDatabaseRef: MutableRefObject<() => Promise<void>>
  archiveFullRestoreDoneRef: MutableRefObject<boolean>
  vaultBootstrapCtxRef: MutableRefObject<{
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
  } | null>
  migrationRuntimeRef: MutableRefObject<{
    fileSystem: IFileSystem
    expoDb: unknown
    settingsRepo: SettingsRepository
    profileRepo: UserProfileRepository
    pathService: MobileStoragePathService
    installInstanceId: string
  } | null>
  diaryStackRef: MutableRefObject<VaultBoundDiaryStack | null>
}

export interface MobileBaishouInitContext {
  isMounted: () => boolean
  setValue: Dispatch<SetStateAction<BaishouContextValue>>
  refs: MobileBaishouInitRefs
  mobileMcpServiceHolder: MutableRefObject<MobileMcpService | null>
}
