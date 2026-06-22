import type { SyncProgressEvent, ManifestEntry, MergeDecision } from '@baishou/shared'

type SyncProgressSlice = Partial<
  Pick<
    SyncProgressEvent,
    'phase' | 'fileName' | 'action' | 'statusText' | 'fileBytesDone' | 'fileBytesTotal' | 'current' | 'total'
  >
>

/** 合并同步进度：阶段文案更新时不丢失字节进度，且字节进度单调递增 */
export function mergeIncrementalSyncProgress(
  prev: SyncProgressSlice | null,
  next: SyncProgressSlice
): SyncProgressSlice {
  if (!prev) return next

  const merged: SyncProgressSlice = { ...prev, ...next }
  const sameFile = Boolean(
    next.fileName && prev.fileName && prev.fileName === next.fileName
  )
  const nextHasBytes =
    next.fileBytesDone != null && next.fileBytesDone >= 0 && (next.fileBytesTotal ?? 0) > 0
  const nextExplicitFileReset =
    sameFile && next.fileBytesDone === 0 && (next.fileBytesTotal ?? 0) > 0

  if (!sameFile && !nextHasBytes) {
    merged.fileBytesDone = undefined
    merged.fileBytesTotal = undefined
  }

  if (!nextHasBytes && sameFile && prev.fileBytesDone != null && (prev.fileBytesTotal ?? 0) > 0) {
    merged.fileBytesDone = prev.fileBytesDone
    merged.fileBytesTotal = prev.fileBytesTotal
  }

  if (
    sameFile &&
    !nextExplicitFileReset &&
    merged.fileBytesDone != null &&
    prev.fileBytesDone != null &&
    merged.fileBytesDone < prev.fileBytesDone
  ) {
    merged.fileBytesDone = prev.fileBytesDone
  }

  if (sameFile && merged.fileBytesTotal == null && prev.fileBytesTotal != null) {
    merged.fileBytesTotal = prev.fileBytesTotal
  }

  return merged
}

/** 下载落盘后是否可信任远程 hash（需 size 完全一致） */
export function shouldTrustRemoteHashAfterDownload(
  actualSize: number,
  remoteEntry: ManifestEntry | null
): remoteEntry is ManifestEntry {
  return remoteEntry != null && actualSize >= 0 && actualSize === remoteEntry.size
}

/** 是否为需要网络传输的同步决策 */
export function isIncrementalSyncTransferDecision(decision: Pick<MergeDecision, 'type'>): boolean {
  return (
    decision.type === 'upload' ||
    decision.type === 'download' ||
    decision.type === 'conflict-resolved'
  )
}

/** 分片传输进度聚合：并发 part 完成时单调上报总字节 */
export function createPartProgressReporter(
  totalParts: number,
  fileSize: number,
  onReport: (bytesDone: number, bytesTotal: number) => void
): (partIndex: number, partBytes: number) => void {
  const partDone = new Array<number>(totalParts).fill(0)
  return (partIndex: number, partBytes: number) => {
    if (partIndex < 0 || partIndex >= totalParts) return
    partDone[partIndex] = partBytes
    let sum = 0
    for (let i = 0; i < totalParts; i++) sum += partDone[i]!
    onReport(Math.min(sum, fileSize), fileSize)
  }
}

/** 原生/网络上传进度节流，避免事件风暴 */
export function createThrottledByteReporter(
  onReport: (written: number, total: number) => void,
  intervalMs = 250
): (written: number, total: number) => void {
  let lastAt = 0
  let lastWritten = -1
  return (written: number, total: number) => {
    const now = Date.now()
    const done = total > 0 && written >= total
    if (done || written > lastWritten) {
      if (done || now - lastAt >= intervalMs) {
        lastAt = now
        lastWritten = written
        onReport(written, total)
      }
    }
  }
}

/** 存在大文件传输时降低并发，避免 UI 在多个文件间跳变 */
export function resolveSyncFileConcurrency(
  items: Array<{ size: number }>,
  configured?: number
): number {
  const base = configured || 5
  if (items.length === 0) return base
  const largeThreshold = 2 * 1024 * 1024
  const hasLarge = items.some((item) => item.size > largeThreshold)
  return hasLarge ? 1 : base
}

/** 所有变更类型均批量推送远端 manifest，同步结束前强制 flush */
export function shouldDeferRemoteManifestCheckpoint(
  _decision: Pick<MergeDecision, 'type' | 'direction'>
): boolean {
  return true
}

export const REMOTE_MANIFEST_CHECKPOINT_BATCH_SIZE = 5

/** 从三向合并决策中筛出需要传输的项并计算并发度 */
export function resolveSyncFileConcurrencyFromDecisions(
  decisions: Array<Pick<MergeDecision, 'type' | 'size'>>,
  configured?: number
): number {
  return resolveSyncFileConcurrency(
    decisions.filter(isIncrementalSyncTransferDecision).map((d) => ({ size: d.size })),
    configured
  )
}
