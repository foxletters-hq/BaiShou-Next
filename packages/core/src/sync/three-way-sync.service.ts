import type {
  IncrementalSyncPlanPreview,
  IncrementalSyncResult,
  SyncProgressCallback,
  IncrementalSyncRunOptions
} from '@baishou/shared'
import {
  assertBidirectionalDeletePropagationAllowed,
  assertBidirectionalSyncDivergenceAllowed,
  buildIncrementalSyncPlanPreview,
  isSyncDivergenceConfirmationRequiredError,
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
      const localManifest = await this.buildLocalManifest()
      const remoteManifest = await this.getRemoteManifest()
      const storageHistory = await this.getSyncStorageHistoryState()
      assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, this.config, {
        storageHistory,
        highDivergenceConfirmed: runOptions?.highDivergenceConfirmed
      })
      const ancestorSnapshot = await this.getRemoteSnapshot()
      const previousLocalManifest = await this.getLocalManifest()

      const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)
      assertBidirectionalDeletePropagationAllowed(
        decisions,
        localManifest,
        remoteManifest,
        ancestorSnapshot,
        previousLocalManifest
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
              await this.downloadFile(d.filePath)
              result.downloaded.push(d.filePath)
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
                await this.downloadFile(d.filePath)
                result.downloaded.push(d.filePath)
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

      const finalManifest = await this.buildLocalManifest()
      await this.saveLocalManifest(finalManifest)
      await this.uploadManifest()
      await this.saveRemoteSnapshot(finalManifest)

      this.lastConflicts = result.conflicted
      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      if (error instanceof SyncDivergenceExceededError) throw error
      if (error instanceof SyncDivergenceConfirmationRequiredError) throw error
      if (error instanceof SyncDeletePropagationBlockedError) throw error
      throw new S3SyncError('Three-way sync failed', error instanceof Error ? error : undefined)
    }
  }

  async uploadOnly(onProgress?: SyncProgressCallback): Promise<IncrementalSyncResult> {
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
      const localManifest = await this.buildLocalManifest()
      const remoteManifest = await this.getRemoteManifest()
      const entries = Object.entries(localManifest.files)
      const total = entries.length
      let completedCount = 0

      const uploadItem = async (entry: (typeof entries)[number]) => {
        const [relPath, localEntry] = entry
        const remoteEntry = remoteManifest.files[relPath]
        try {
          if (!remoteEntry || remoteEntry.hash !== localEntry.hash) {
            await this.uploadFile(relPath)
            result.uploaded.push(relPath)
          } else {
            result.skipped.push(relPath)
          }
        } finally {
          completedCount++
          const action = !remoteEntry || remoteEntry.hash !== localEntry.hash ? 'upload' : 'skip'
          onProgress?.({
            phase: 'syncing',
            current: completedCount,
            total,
            fileName: relPath,
            action: action as 'upload' | 'skip'
          })
        }
      }

      const fileConcurrency = this.config.fileConcurrency || 5
      await limitExecute(entries, fileConcurrency, uploadItem)

      await this.saveLocalManifest(localManifest)
      await this.uploadManifest()
      await this.saveRemoteSnapshot(localManifest)

      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      throw new S3SyncError('Upload failed', error instanceof Error ? error : undefined)
    }
  }

  async downloadOnly(
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
      const localManifest = await this.buildLocalManifest()
      const remoteManifest = await this.getRemoteManifest()
      const storageHistory = await this.getSyncStorageHistoryState()
      assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, this.config, {
        storageHistory,
        highDivergenceConfirmed: runOptions?.highDivergenceConfirmed
      })
      const ancestorSnapshot = await this.getRemoteSnapshot()

      const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)
      const total = decisions.length
      let completedCount = 0

      const downloadItem = async (d: (typeof decisions)[number]) => {
        try {
          if (
            d.type === 'download' ||
            (d.type === 'conflict-resolved' && d.direction === 'download')
          ) {
            await this.downloadFile(d.filePath)
            result.downloaded.push(d.filePath)
          } else if (d.type === 'skip') {
            result.skipped.push(d.filePath)
          }
        } finally {
          completedCount++
          const isDownload =
            d.type === 'download' || (d.type === 'conflict-resolved' && d.direction === 'download')
          onProgress?.({
            phase: 'syncing',
            current: completedCount,
            total,
            fileName: d.filePath,
            action: isDownload ? 'download' : 'skip'
          })
        }
      }

      const fileConcurrency = this.config.fileConcurrency || 5
      await limitExecute(decisions, fileConcurrency, downloadItem)

      const finalManifest = await this.buildLocalManifest()
      await this.saveLocalManifest(finalManifest)
      await this.uploadManifest()
      await this.saveRemoteSnapshot(finalManifest)

      result.duration = Date.now() - startTime
      return result
    } catch (error) {
      if (error instanceof SyncDivergenceExceededError) throw error
      if (error instanceof SyncDivergenceConfirmationRequiredError) throw error
      throw new S3SyncError('Download failed', error instanceof Error ? error : undefined)
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

    const localManifest = await this.buildLocalManifest()
    const remoteManifest = await this.getRemoteManifest()
    const storageHistory = await this.getSyncStorageHistoryState()

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

    const ancestorSnapshot = await this.getRemoteSnapshot()
    const previousLocalManifest = await this.getLocalManifest()
    const decisions = threeWayMerge(localManifest, remoteManifest, ancestorSnapshot)

    let deletePropagationBlocked = false
    let deletePropagationReason: 'mass_delete' | 'local_data_loss' | undefined

    try {
      assertBidirectionalDeletePropagationAllowed(
        decisions,
        localManifest,
        remoteManifest,
        ancestorSnapshot,
        previousLocalManifest
      )
    } catch (error) {
      if (error instanceof SyncDeletePropagationBlockedError) {
        deletePropagationBlocked = true
        deletePropagationReason = error.reason
      } else {
        throw error
      }
    }

    return buildIncrementalSyncPlanPreview({
      decisions,
      registeredVaults: context.registeredVaults,
      diskVaultNames: context.diskVaultNames,
      activeVaultName: context.activeVaultName,
      requiresHighDivergenceConfirm,
      divergencePercent,
      maxDivergencePercent,
      deletePropagationBlocked,
      deletePropagationReason
    })
  }
}
