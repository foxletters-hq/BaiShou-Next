import {
  SessionSyncService,
  SummarySyncService,
  type MissingSummaryDetector,
  type SummaryGeneratorService,
  type SessionFileService,
  type SummaryFileService
} from '@baishou/core-mobile'
import type { SummaryType } from '@baishou/shared'
import type { SessionRepository, SummaryRepository } from '@baishou/database'
import type { MobileAgentDbRecoveryCoordinator } from './mobile-agent-db-recovery.coordinator'

type SessionResyncOptions = Parameters<SessionSyncService['fullScanArchives']>[0]
type SummaryResyncOptions = Parameters<SummarySyncService['fullScanArchives']>[0]

export class RecoveryAwareSessionSyncService extends SessionSyncService {
  constructor(
    sessionRepo: SessionRepository,
    fileService: SessionFileService,
    private readonly recovery: MobileAgentDbRecoveryCoordinator
  ) {
    super(sessionRepo, fileService)
  }

  override syncSessionFile(sessionId: string): Promise<void> {
    return this.recovery.runWithRecovery(
      () => super.syncSessionFile(sessionId),
      `SessionSync.syncSessionFile(${sessionId})`
    )
  }

  override fullScanArchives(options?: SessionResyncOptions): Promise<void> {
    return this.recovery.runWithRecovery(
      () => super.fullScanArchives(options),
      'SessionSync.fullScanArchives'
    )
  }
}

export class RecoveryAwareSummarySyncService extends SummarySyncService {
  constructor(
    detector: MissingSummaryDetector | null,
    generator: SummaryGeneratorService | null,
    summaryRepo: SummaryRepository,
    fileService: SummaryFileService,
    private readonly recovery: MobileAgentDbRecoveryCoordinator
  ) {
    super(detector, generator, summaryRepo, fileService)
  }

  override syncSummaryFile(type: SummaryType, startDate: Date, endDate: Date): Promise<void> {
    return this.recovery.runWithRecovery(
      () => super.syncSummaryFile(type, startDate, endDate),
      `SummarySync.syncSummaryFile(${type})`
    )
  }

  override fullScanArchives(options?: SummaryResyncOptions): Promise<void> {
    return this.recovery.runWithRecovery(
      () => super.fullScanArchives(options),
      'SummarySync.fullScanArchives'
    )
  }
}
