import type { SyncManifest } from '../types/version-control.types'
import type { MergeDecision } from './three-way-merge'

/** 双向同步因大量远端删除传播被阻断 */
export class SyncDeletePropagationBlockedError extends Error {
  constructor(
    public readonly deleteRemoteCount: number,
    public readonly remoteFileCount: number,
    public readonly reason: 'mass_delete' | 'local_data_loss'
  ) {
    super(
      `SyncDeletePropagationBlockedError: ${deleteRemoteCount}/${remoteFileCount} remote deletions blocked (${reason})`
    )
    this.name = 'SyncDeletePropagationBlockedError'
  }
}

/** 触发远端删除传播保护所需的最小远端文件数 */
export const SYNC_DELETE_GUARD_MIN_REMOTE_FILES = 5

/** 单次同步允许传播到远端的最大删除占比（0–1） */
export const SYNC_DELETE_GUARD_MAX_REMOTE_DELETE_RATIO = 0.2

/** 当前本地扫描结果相对上次本地 manifest 的疑似数据丢失阈值（0–1） */
export const SYNC_LOCAL_DATA_LOSS_RATIO = 0.5

/** 当前本地文件数相对祖先快照过少时，视为疑似本地数据丢失（0–1） */
export const SYNC_LOCAL_VS_ANCESTOR_MIN_RATIO = 0.3

/**
 * 双向同步前校验：阻止「本地缺失 + 远端未变」被误判为本地删除而批量清空远端。
 * 典型场景：移动端本地数据丢失但 `.baishou/last-remote-manifest.json` 仍保留完整快照。
 */
export function assertBidirectionalDeletePropagationAllowed(
  decisions: MergeDecision[],
  local: SyncManifest,
  remote: SyncManifest,
  ancestor: SyncManifest,
  previousLocal?: SyncManifest
): void {
  const deleteRemoteDecisions = decisions.filter((d) => d.type === 'delete-remote')
  const deleteRemoteCount = deleteRemoteDecisions.length
  if (deleteRemoteCount === 0) return

  const remoteFileCount = Object.keys(remote.files).length
  const localFileCount = Object.keys(local.files).length
  const ancestorFileCount = Object.keys(ancestor.files).length

  if (
    remoteFileCount >= SYNC_DELETE_GUARD_MIN_REMOTE_FILES &&
    deleteRemoteCount / remoteFileCount > SYNC_DELETE_GUARD_MAX_REMOTE_DELETE_RATIO
  ) {
    throw new SyncDeletePropagationBlockedError(deleteRemoteCount, remoteFileCount, 'mass_delete')
  }

  const unchangedRemoteDeletes = deleteRemoteDecisions.filter(
    (d) => d.remoteEntry && d.ancestorEntry && d.remoteEntry.hash === d.ancestorEntry.hash
  )

  if (
    ancestorFileCount >= SYNC_DELETE_GUARD_MIN_REMOTE_FILES &&
    localFileCount < ancestorFileCount * SYNC_LOCAL_VS_ANCESTOR_MIN_RATIO &&
    unchangedRemoteDeletes.length === deleteRemoteCount
  ) {
    throw new SyncDeletePropagationBlockedError(
      deleteRemoteCount,
      remoteFileCount,
      'local_data_loss'
    )
  }

  if (previousLocal) {
    const previousLocalCount = Object.keys(previousLocal.files).length
    if (
      previousLocalCount >= SYNC_DELETE_GUARD_MIN_REMOTE_FILES &&
      localFileCount < previousLocalCount * SYNC_LOCAL_DATA_LOSS_RATIO
    ) {
      throw new SyncDeletePropagationBlockedError(
        deleteRemoteCount,
        remoteFileCount,
        'local_data_loss'
      )
    }
  }
}
