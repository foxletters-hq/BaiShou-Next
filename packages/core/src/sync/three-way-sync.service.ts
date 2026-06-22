import type {
  IncrementalSyncPlanPreview,
  IncrementalSyncResult,
  SyncProgressCallback,
  IncrementalSyncRunOptions
} from '@baishou/shared'
import {
  assertBidirectionalSyncDivergenceAllowed,
  buildIncrementalSyncPlanPreview,
  collectManifestVaultScopes,
  finalizeIncrementalSyncManifest,
  buildIncrementalSyncPlanMergeResult,
  buildIncrementalSyncPlanReuseBaseline,
  isSyncDivergenceConfirmationRequiredError,
  resolveSyncMergeDecisions,
  SyncDeletePropagationChoiceRequiredError,
  SyncDeletePropagationBlockedError,
  SyncDivergenceConfirmationRequiredError,
  SyncDivergenceExceededError
} from '@baishou/shared'
import type { IIncrementalSyncService } from './incremental-sync.interface'
import { threeWayMerge } from './three-way-merge'
import { S3NotConfiguredError, S3SyncError } from './sync.errors'
import { ThreeWaySyncManifestMixin } from './three-way-sync.manifest'
import { limitExecute } from './three-way-sync.utils'

export { limitExecute } from './three-way-sync.utils'

/**
 * 三向合并增量同步服务
 *
 * 采用三向合并算法（本地 vs 远程 vs 祖先），支持删除传播。
 */
export class ThreeWaySyncService
  extends ThreeWaySyncManifestMixin
  implements IIncrementalSyncService
{
  async sync(
    onProgress?: SyncProgressCallback,
    runOptions?: IncrementalSyncRunOptions
  ): Promise<IncrementalSyncResult> {
    await this.loadConfig()
    if (!this.config.enabled) throw new S3NotConfiguredError()

    const startTime = Date.now()
    const result: IncrementalSyncResult = {
      uploaded: [],
      downloaded: [],
      conflicted: [],
      skipped: [],
      deletedRemote: [],
      deletedLocal: [],
      duration: 0,
      sessionId: ''
    }

    try {
      const prepared = await this.prepareSyncManifests({ onProgress })
      const {
        localManifest,
        remoteManifest,
        ancestorSnapshot,
        previousLocalManifest,
        storageHistory
      } = prepared
      assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, this.config, {
        storageHistory,
        highDivergenceConfirmed: runOptions?.highDivergenceConfirmed
      })

      const decisions = resolveSyncMergeDecisions(
        threeWayMerge(localManifest, remoteManifest, ancestorSnapshot),
        localManifest,
        remoteManifest,
        ancestorSnapshot,
        previousLocalManifest,
        { deletePropagationChoice: runOptions?.deletePropagationChoice }
      )
      const total = decisions.length
      let completedCount = 0

      const syncItem = async (d: (typeof decisions)[number]) => {
        try {
          switch (d.type) {
            case 'upload':
              await this.uploadFile(d.filePath)
              result.uploaded.push(d.filePath)
              break
            case 'download':
              if (await this.downloadFile(d.filePath)) {
                result.downloaded.push(d.filePath)
              }
              break
            case 'delete-remote':
              await this.deleteRemoteFile(d.filePath)
              result.deletedRemote.push(d.filePath)
              break
            case 'delete-local':
              await this.deleteLocalFile(d.filePath)
              result.deletedLocal.push(d.filePath)
              break
            case 'conflict-resolved': {
              result.conflicted.push(d.filePath)
              if (d.direction === 'upload') {
                if (d.localEntry) await this.backupFile(d.filePath, d.localEntry.hash)
                await this.uploadFile(d.filePath)
                result.uploaded.push(d.filePath)
              } else {
                if (d.localEntry) await this.backupFile(d.filePath, d.localEntry.hash)
                if (await this.downloadFile(d.filePath)) {
                  result.downloaded.push(d.filePath)
                }
              }
              break
            }
            case 'skip':
              result.skipped.push(d.filePath)
              break
          }
        } finally {
          completedCount++
          onProgress?.({
            phase: 'syncing',
            current: completedCount,
            total,
            fileName: d.filePath,
            action:
              d.type === 'skip'
                ? 'skip'
                : d.type === 'conflict-resolved'
                  ? d.direction === 'upload'
                    ? 'upload'
                    : 'download'
                  : (d.type as 'upload' | 'download' | 'delete')
          })
        }
      }

      const fileConcurrency = this.config.fileConcurrency || 5
      await limitExecute(decisions, fileConcurrency, syncItem)

      onProgress?.({ phase: 'finalizing', current: 0, total: 1 })
      const scanned = await this.buildLocalManifest()
      const finalManifest = finalizeIncrementalSyncManifest({
        scanned,
        baselineRemote: remoteManifest,
        decisions,
        deviceId: this.deviceId
      })
      await this.saveLocalManifest(finalManifest)
      await this.uploadManifest()
      await this.saveRemoteSnapshot(finalManifest)
      onProgress?.({ phase: 'finalizing', current: 1, total: 1 })
      this.invalidatePreparedManifests()

      this.lastConflicts = result.conflicted
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      if (error instanceof SyncDivergenceExceededError) throw error
      if (error instanceof SyncDivergenceConfirmationRequiredError) throw error
      if (error instanceof SyncDeletePropagationChoiceRequiredError) throw error
      if (error instanceof SyncDeletePropagationBlockedError) throw error
      throw new S3SyncError('Three-way sync failed', error instanceof Error ? error : undefined)
    }
  }

  async planSync(
    context: {
      registeredVaults: string[]
      diskVaultNames: string[]
      activeVaultName: string | null
    },
    runOptions?: IncrementalSyncRunOptions
  ): Promise<IncrementalSyncPlanPreview> {
    await this.loadConfig()
    if (!this.config.enabled) throw new S3NotConfiguredError()

    const {
      localManifest,
      remoteManifest,
      ancestorSnapshot,
      previousLocalManifest,
      storageHistory
    } = await this.prepareSyncManifests()

    let requiresHighDivergenceConfirm = false
    let divergencePercent: number | undefined
    let maxDivergencePercent: number | undefined

    try {
      assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, this.config, {
        storageHistory,
        highDivergenceConfirmed: runOptions?.highDivergenceConfirmed
      })
    } catch (error) {
      if (isSyncDivergenceConfirmationRequiredError(error)) {
        requiresHighDivergenceConfirm = true
        divergencePercent = error.divergencePercent
        maxDivergencePercent = error.maxDivergencePercent
      } else {
        throw error
      }
    }

    const { decisions, deleteBlock } = buildIncrementalSyncPlanMergeResult(
      localManifest,
      remoteManifest,
      ancestorSnapshot,
      previousLocalManifest,
      runOptions
    )

    return {
      ...buildIncrementalSyncPlanPreview({
        decisions,
        registeredVaults: context.registeredVaults,
        diskVaultNames: context.diskVaultNames,
        activeVaultName: context.activeVaultName,
        manifestVaultScopes: collectManifestVaultScopes(localManifest, remoteManifest),
        requiresHighDivergenceConfirm,
        divergencePercent,
        maxDivergencePercent,
        deletePropagationBlocked: deleteBlock != null,
        deletePropagationReason: deleteBlock?.reason,
        blockedDeleteCount: deleteBlock?.deleteCount,
        blockedDeleteDirection: deleteBlock?.direction
      }),
      planReuseBaseline: buildIncrementalSyncPlanReuseBaseline(localManifest, remoteManifest)
    }
  }
}
