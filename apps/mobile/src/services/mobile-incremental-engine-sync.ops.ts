import type { SyncManifest, S3SyncConfig, IncrementalSyncRunOptions } from '@baishou/shared'
import {
  assertBidirectionalSyncDivergenceAllowed,
  countUnverifiedAncestorEntries,
  finalizeIncrementalSyncManifest,
  getSyncManifestRemovedMap,
  limitExecute,
  normalizeSyncManifest,
  reconcileAncestorWithRemoteTruth,
  resolveSyncMergeDecisions,
  threeWayMerge
} from '@baishou/shared'
import {
  JsonlRecordMergeService,
  MonthlyJsonlStore,
  classifyMonthlyJsonlPath,
  isMonthlyJsonlRawPath
} from '@baishou/core-mobile'
import { getAppCacheDirectory } from './mobile-app-paths'
import { MobileIncrementalCloudClient } from './mobile-incremental-cloud.client'
import { throwIfIncrementalSyncAborted } from './mobile-incremental-sync-abort.util'
import { sortSyncDecisionsBySizeAsc } from './mobile-incremental-sync-order.util'
import { normalizeSyncFilePath } from './android-external-fs'
import { clearIncrementalSyncSession } from './mobile-incremental-sync-session.util'
import { resolveSyncFileConcurrencyFromDecisions } from './mobile-incremental-sync-progress.util'
import type {
  MobileIncrementalExecutionContext,
  MobileIncrementalProgress,
  MobileIncrementalSyncOutcome
} from './mobile-incremental-engine.types'
import { SYNC_ACTIVITY_STATUS } from './mobile-incremental-engine-transfer.helpers'
import type { MobileIncrementalEngineWorker } from './mobile-incremental-engine.worker'

type IncrementalProgressCallback = (progress: MobileIncrementalProgress) => void

async function markMobileMonthlyJsonlPending(
  worker: MobileIncrementalEngineWorker,
  relPath: string,
  absoluteShardPath: string
): Promise<void> {
  const classified = classifyMonthlyJsonlPath(relPath)
  if (!classified) return
  const dir = absoluteShardPath.replace(/[/\\][^/\\]+$/, '')
  const store = new MonthlyJsonlStore({
    fs: worker.host.fileSystem,
    rootDir: dir
  })
  await store.refreshShardHashAfterExternalWrite(classified.shardMonth)
  if (classified.kind === 'graph' && classified.collection === 'nodes') {
    try {
      await worker.host.getRawDataSourceManager?.()?.getGraphManager()?.rebuildIdmap()
    } catch (e) {
      console.warn(`[MobileIncremental] rebuildIdmap after external write failed:`, e)
    }
  }
}

async function mergeMobileMonthlyJsonlConflict(
  worker: MobileIncrementalEngineWorker,
  client: MobileIncrementalCloudClient,
  syncRoot: string,
  relPath: string,
  fullPath: string
): Promise<boolean> {
  try {
    const localText = (await worker.host.fileSystem.exists(fullPath))
      ? await worker.host.fileSystem.readFile(fullPath)
      : ''
    const tmp = `${getAppCacheDirectory()}baishou-jsonl-merge-${Date.now()}.jsonl`
    try {
      await client.downloadFile(relPath.replace(/\\/g, '/'), tmp)
    } catch {
      if (localText) {
        await client.uploadFile(fullPath, relPath)
        return true
      }
      return false
    }
    const remoteText = await worker.host.fileSystem.readFile(tmp)
    await worker.host.fileSystem.unlink(tmp).catch(() => undefined)

    const merger = new JsonlRecordMergeService()
    const merged = merger.mergeTexts(localText, remoteText)
    await worker.backupLocalFile(syncRoot, relPath)

    const classified = classifyMonthlyJsonlPath(relPath)
    if (!classified) return false
    const manager = worker.host.getRawDataSourceManager?.() ?? null
    let wrote = false
    if (manager) {
      wrote = await manager.replaceMonthlyJsonlShard(relPath, merged.text)
    }
    if (!wrote) {
      const store = new MonthlyJsonlStore({
        fs: worker.host.fileSystem,
        rootDir: fullPath.replace(/[/\\][^/\\]+$/, '')
      })
      await store.replaceShardContent(classified.shardMonth, merged.text)
      if (classified.kind === 'graph' && classified.collection === 'nodes') {
        await manager?.getGraphManager()?.rebuildIdmap()
      }
    }
    await client.uploadFile(fullPath, relPath)
    return true
  } catch (e) {
    console.warn(`[MobileIncremental] JSONL LWW merge failed for ${relPath}:`, e)
    return false
  }
}

function mapDecisionProgress(
  completed: number,
  total: number,
  d: ReturnType<typeof threeWayMerge>[number]
): MobileIncrementalProgress {
  const base: MobileIncrementalProgress = {
    phase: 'syncing',
    current: completed,
    total,
    fileName: d.filePath
  }
  switch (d.type) {
    case 'upload':
      return { ...base, action: 'upload' }
    case 'download':
      return { ...base, action: 'download' }
    case 'delete-remote':
    case 'delete-local':
      return { ...base, action: 'delete' }
    case 'skip':
      return { ...base, action: 'skip' }
    case 'conflict-resolved':
      return { ...base, action: d.direction === 'upload' ? 'upload' : 'download' }
    default:
      return base
  }
}

export async function runSyncThreeWay(
  worker: MobileIncrementalEngineWorker,
  config: S3SyncConfig,
  onProgress?: IncrementalProgressCallback,
  runOptions?: IncrementalSyncRunOptions,
  execution?: MobileIncrementalExecutionContext
): Promise<MobileIncrementalSyncOutcome> {
  const syncRoot = await worker.syncRoot()
  worker.host.invalidateExternalSyncMounts()
  const reusedLocalManifest = worker.host.takePendingSyncLocalManifest()
  const reusedRemoteManifest = worker.host.takePendingSyncRemoteManifest()
  const metaDir = await worker.syncMetaDir()
  const client = new MobileIncrementalCloudClient(config, worker.host.fileSystem)
  client.setVaultPath(syncRoot)
  client.setAbortSignal(execution?.signal)

  onProgress?.({ phase: 'scanning', current: 0, total: 0 })
  const localManifest =
    reusedLocalManifest ??
    (await worker.buildLocalManifest((current, total, fileName) => {
      onProgress?.({ phase: 'scanning', current, total, fileName })
    }))

  onProgress?.({ phase: 'comparing', current: 0, total: 1 })
  const remoteManifest =
    reusedRemoteManifest ??
    (await worker.getRemoteManifest(client, (current, total, fileName) => {
      onProgress?.({ phase: 'comparing', current, total, fileName })
    }))
  onProgress?.({ phase: 'comparing', current: 1, total: 1 })
  const storageHistory = await worker.getSyncStorageHistoryState(config)
  assertBidirectionalSyncDivergenceAllowed(localManifest, remoteManifest, config, {
    storageHistory,
    highDivergenceConfirmed: runOptions?.highDivergenceConfirmed
  })
  let ancestorSnapshot = await worker.loadRemoteSnapshot(config)
  const unverifiedAncestor = countUnverifiedAncestorEntries(ancestorSnapshot, remoteManifest)
  if (unverifiedAncestor > 0) {
    console.warn(
      `[IncrementalSync] stripping ${unverifiedAncestor} unverified ancestor entr(y/ies) not present on remote`
    )
    ancestorSnapshot = reconcileAncestorWithRemoteTruth(ancestorSnapshot, remoteManifest)
  }
  const previousLocalManifest = await worker
    .readLocalManifestFile()
    .catch(() => worker.emptyManifest())

  const decisions = resolveSyncMergeDecisions(
    threeWayMerge(localManifest, remoteManifest, ancestorSnapshot),
    localManifest,
    remoteManifest,
    ancestorSnapshot,
    previousLocalManifest,
    { deletePropagationChoice: runOptions?.deletePropagationChoice }
  )

  const sortedDecisions = sortSyncDecisionsBySizeAsc(decisions)
  const totalDecisions = sortedDecisions.length
  const sessionStartedAt = Date.now()
  await worker.touchSyncSession(metaDir, 'sync', totalDecisions, 0)

  let uploaded = 0
  let downloaded = 0
  let skipped = 0
  let deletedRemote = 0
  let deletedLocal = 0
  const conflicted: string[] = []
  const uploadedPaths: string[] = []
  const downloadedPaths: string[] = []
  const deletedLocalPaths: string[] = []
  const deletedRemotePaths: string[] = []
  // 仅从远端基线起步；upload 成功后再写入，避免未上云文件污染 checkpoint / 祖先快照
  let workingManifest: SyncManifest = normalizeSyncManifest({
    ...remoteManifest,
    files: { ...remoteManifest.files },
    removed: { ...getSyncManifestRemovedMap(remoteManifest) }
  })

  const fileConcurrency = resolveSyncFileConcurrencyFromDecisions(
    sortedDecisions,
    config.fileConcurrency
  )
  const progressState = { completed: 0 }
  const signal = execution?.signal
  const inFlight = new Map<
    string,
    { relPath: string; action: MobileIncrementalProgress['action'] }
  >()
  const getFileBytes = worker.bindTransferProgress(
    client,
    onProgress,
    () => progressState.completed,
    totalDecisions,
    inFlight
  )
  const checkpoint = worker.createCheckpointRuntime(metaDir, client, config)
  const manifestCommitQueue = worker.host.manifestCommitQueue

  await limitExecute(sortedDecisions, fileConcurrency, async (d) => {
    throwIfIncrementalSyncAborted(signal)

    const resolveAction = (): MobileIncrementalProgress['action'] => {
      if (d.type === 'upload' || (d.type === 'conflict-resolved' && d.direction === 'upload')) {
        return 'upload'
      }
      if (d.type === 'download' || (d.type === 'conflict-resolved' && d.direction === 'download')) {
        return 'download'
      }
      if (d.type === 'delete-remote' || d.type === 'delete-local') return 'delete'
      if (d.type === 'skip') return 'skip'
      return undefined
    }

    const fullPath = await worker.resolveSyncFullPath(syncRoot, d.filePath)
    const action = resolveAction()
    if (action === 'upload' || action === 'download') {
      worker.trackInFlightTransfer(inFlight, fullPath, d.filePath, action)
      worker.emitFileTransferStart(
        onProgress,
        progressState.completed,
        totalDecisions,
        d.filePath,
        action,
        d.size
      )
    }

    let mutated = false
    try {
      switch (d.type) {
        case 'upload':
          await client.uploadFile(fullPath, d.filePath)
          uploaded++
          uploadedPaths.push(d.filePath)
          mutated = true
          break
        case 'download':
          if (await worker.downloadSyncFile(client, d.filePath, fullPath, d.size)) {
            downloaded++
            downloadedPaths.push(d.filePath)
            mutated = true
          }
          break
        case 'delete-remote':
          await client.deleteFile(d.filePath)
          deletedRemote++
          deletedRemotePaths.push(d.filePath)
          mutated = true
          break
        case 'delete-local':
          await worker.host.fileSystem.unlink(fullPath)
          if (isMonthlyJsonlRawPath(d.filePath)) {
            await markMobileMonthlyJsonlPending(worker, d.filePath, fullPath)
          }
          deletedLocal++
          deletedLocalPaths.push(d.filePath)
          mutated = true
          break
        case 'conflict-resolved':
          conflicted.push(d.filePath)
          if (isMonthlyJsonlRawPath(d.filePath)) {
            const mergedOk = await mergeMobileMonthlyJsonlConflict(
              worker,
              client,
              syncRoot,
              d.filePath,
              fullPath
            )
            if (mergedOk) {
              uploaded++
              uploadedPaths.push(d.filePath)
              mutated = true
              break
            }
          }
          if (d.direction === 'upload') {
            await worker.backupLocalFile(syncRoot, d.filePath)
            await client.uploadFile(fullPath, d.filePath)
            uploaded++
            uploadedPaths.push(d.filePath)
          } else {
            await worker.backupLocalFile(syncRoot, d.filePath)
            if (await worker.downloadSyncFile(client, d.filePath, fullPath, d.size)) {
              downloaded++
              downloadedPaths.push(d.filePath)
            }
          }
          mutated = true
          break
        case 'skip':
          skipped++
          break
      }
    } finally {
      inFlight.delete(fullPath)
      inFlight.delete(normalizeSyncFilePath(fullPath))
    }

    if (mutated) {
      const bytes = getFileBytes(d.filePath)
      onProgress?.({
        phase: 'syncing',
        current: progressState.completed,
        total: totalDecisions,
        fileName: d.filePath,
        action,
        fileBytesDone: bytes?.done,
        fileBytesTotal: bytes?.total,
        statusText: SYNC_ACTIVITY_STATUS.checkpointing
      })
      await manifestCommitQueue.run(async () => {
        workingManifest = await worker.applyDecisionToManifest(workingManifest, d, syncRoot)
        await checkpoint.afterMutation(workingManifest)
      })
    }

    progressState.completed++
    await checkpoint.afterDecisionProgress({
      metaDir,
      mode: 'sync',
      total: totalDecisions,
      completed: progressState.completed,
      lastFile: d.filePath,
      startedAt: sessionStartedAt
    })
    if (
      d.type !== 'skip' ||
      progressState.completed === totalDecisions ||
      progressState.completed % 24 === 0
    ) {
      onProgress?.(mapDecisionProgress(progressState.completed, totalDecisions, d))
    }
  })

  client.setTransferProgressCallback(undefined)
  client.setTransferActivityCallback(undefined)
  const scanned = await worker.buildLocalManifest()
  const finalManifest = finalizeIncrementalSyncManifest({
    scanned,
    baselineRemote: remoteManifest,
    decisions: sortedDecisions,
    deviceId: worker.host.deviceId
  })
  await checkpoint.finalize(finalManifest, {
    metaDir,
    mode: 'sync',
    total: totalDecisions,
    completed: progressState.completed,
    lastFile: sortedDecisions[totalDecisions - 1]?.filePath,
    startedAt: sessionStartedAt
  })
  worker.host.setLastConflicts(conflicted)
  await clearIncrementalSyncSession(worker.host.fileSystem, metaDir)
  onProgress?.({ phase: 'finalizing', current: 1, total: 1 })

  return {
    uploaded,
    downloaded,
    conflicts: conflicted.length,
    skipped,
    deletedRemote,
    deletedLocal,
    failed: 0,
    failedPaths: [],
    uploadedPaths,
    downloadedPaths,
    deletedLocalPaths,
    deletedRemotePaths
  }
}
