import type {
  EmbeddingMigrationRollbackConfig,
  EmbeddingMigrationStateRecord,
  EmbeddingMigrationStateView,
  EmbeddingMigrationStatus
} from '@baishou/shared'
import { EMBEDDING_MIGRATION_STATE_KEY } from '@baishou/shared'
import { DesktopEmbeddingStorage } from '../ipc/rag.storage'
import { settingsManager } from '../ipc/settings.ipc'

const IDLE_STATE: EmbeddingMigrationStateRecord = {
  status: 'idle'
}

export class EmbeddingMigrationStateService {
  private readonly storage = new DesktopEmbeddingStorage()
  private isMigrationActive: () => boolean = () => false

  setMigrationActiveChecker(checker: () => boolean): void {
    this.isMigrationActive = checker
  }

  async getState(): Promise<EmbeddingMigrationStateView> {
    await this.reconcile()
    return this.buildView(await this.readRecord())
  }

  async markInProgress(rollbackConfig?: EmbeddingMigrationRollbackConfig): Promise<void> {
    await settingsManager.set(EMBEDDING_MIGRATION_STATE_KEY, {
      status: 'in_progress',
      startedAt: Date.now(),
      rollbackConfig,
      completedAt: undefined
    } satisfies EmbeddingMigrationStateRecord)
  }

  async markCompleted(): Promise<void> {
    await settingsManager.set(EMBEDDING_MIGRATION_STATE_KEY, {
      status: 'completed',
      startedAt: undefined,
      completedAt: Date.now(),
      rollbackConfig: undefined
    } satisfies EmbeddingMigrationStateRecord)
  }

  async markInterrupted(): Promise<void> {
    const current = await this.readRecord()
    await settingsManager.set(EMBEDDING_MIGRATION_STATE_KEY, {
      ...current,
      status: 'interrupted'
    } satisfies EmbeddingMigrationStateRecord)
  }

  async markIdle(): Promise<void> {
    await settingsManager.set(EMBEDDING_MIGRATION_STATE_KEY, IDLE_STATE)
  }

  async reconcile(): Promise<void> {
    const record = await this.readRecord()
    const hasRollback = await this.storage.hasRollbackSnapshot()
    const hasPending = await this.storage.hasPendingMigration()

    if (record.status === 'in_progress') {
      // Do not mark interrupted while the main-process migration generator is still running.
      if (!this.isMigrationActive()) {
        await this.markInterrupted()
      }
      return
    }

    if (hasRollback && record.status !== 'interrupted') {
      await settingsManager.set(EMBEDDING_MIGRATION_STATE_KEY, {
        ...record,
        status: 'interrupted'
      } satisfies EmbeddingMigrationStateRecord)
      return
    }

    if (record.status === 'interrupted' && !hasRollback && !hasPending) {
      await this.markIdle()
    }
  }

  private async readRecord(): Promise<EmbeddingMigrationStateRecord> {
    const raw = await settingsManager.get<EmbeddingMigrationStateRecord>(
      EMBEDDING_MIGRATION_STATE_KEY
    )
    if (!raw?.status) return { ...IDLE_STATE }
    return raw
  }

  private async buildView(
    record: EmbeddingMigrationStateRecord
  ): Promise<EmbeddingMigrationStateView> {
    const hasRollback = await this.storage.hasRollbackSnapshot()
    const hasPending = await this.storage.hasPendingMigration()
    const status = record.status as EmbeddingMigrationStatus

    return {
      ...record,
      canRestore: hasRollback && (status === 'interrupted' || status === 'in_progress'),
      canResume: hasPending && status === 'interrupted'
    }
  }
}

let migrationStateService: EmbeddingMigrationStateService | null = null

export function getEmbeddingMigrationStateService(): EmbeddingMigrationStateService {
  if (!migrationStateService) {
    migrationStateService = new EmbeddingMigrationStateService()
  }
  return migrationStateService
}
