import type { SyncManifest } from '../types/version-control.types'
import type { SyncDeletePropagationChoice } from '../types/version-control.types'
import type { MergeDecision } from './three-way-merge'

export type SyncDeletePropagationDirection = 'remote' | 'local'

export type SyncDeletePropagationBlockReason =
  | 'mass_delete'
  | 'local_data_loss'
  | 'remote_data_loss'

/** 双向同步因大量删除传播被阻断 */
export class SyncDeletePropagationBlockedError extends Error {
  constructor(
    public readonly deleteCount: number,
    public readonly baselineFileCount: number,
    public readonly direction: SyncDeletePropagationDirection,
    public readonly reason: SyncDeletePropagationBlockReason
  ) {
    super(
      `SyncDeletePropagationBlockedError: ${deleteCount}/${baselineFileCount} ${direction} deletions blocked (${reason})`
    )
    this.name = 'SyncDeletePropagationBlockedError'
  }

  /** @deprecated 使用 deleteCount */
  get deleteRemoteCount(): number {
    return this.direction === 'remote' ? this.deleteCount : 0
  }

  /** @deprecated 使用 baselineFileCount */
  get remoteFileCount(): number {
    return this.direction === 'remote' ? this.baselineFileCount : 0
  }
}

/** 触发删除传播保护所需的最小基准文件数 */
export const SYNC_DELETE_GUARD_MIN_REMOTE_FILES = 5

/** 单次同步允许传播的最大删除占比（0–1），适用于远端与本地 */
export const SYNC_DELETE_GUARD_MAX_REMOTE_DELETE_RATIO = 0.2

export const SYNC_DELETE_GUARD_MAX_DELETE_RATIO = SYNC_DELETE_GUARD_MAX_REMOTE_DELETE_RATIO

/** 当前本地扫描结果相对上次本地 manifest 的疑似数据丢失阈值（0–1） */
export const SYNC_LOCAL_DATA_LOSS_RATIO = 0.5

/** 当前一侧文件数相对祖先快照过少时，视为疑似数据丢失（0–1） */
export const SYNC_LOCAL_VS_ANCESTOR_MIN_RATIO = 0.3

/** 本机主动删除并需传播到远端：远端未变、本地缺失、祖先曾有 */
function isLocalInitiatedDeleteRemotePropagation(
  decisions: MergeDecision[],
  local: SyncManifest
): boolean {
  const deletes = decisions.filter((d) => d.type === 'delete-remote')
  if (deletes.length === 0) return false

  const localFileCount = Object.keys(local.files).length
  if (localFileCount === 0) return false

  return deletes.every(
    (d) =>
      !d.localEntry &&
      d.remoteEntry &&
      d.ancestorEntry &&
      d.remoteEntry.hash === d.ancestorEntry.hash
  )
}

/**
 * 对端已在云端完成删除、本机需跟随删本地：本地未变、远端缺失、祖先曾有。
 * 要求远端 manifest 在祖先快照之后有更新，且远端非空（避免误信被清空的云端）。
 */
function isRemoteInitiatedDeleteLocalPropagation(
  decisions: MergeDecision[],
  remote: SyncManifest,
  ancestor: SyncManifest
): boolean {
  const deletes = decisions.filter((d) => d.type === 'delete-local')
  if (deletes.length === 0) return false

  const remoteFileCount = Object.keys(remote.files).length
  if (remoteFileCount === 0) return false

  const allUnchangedLocal = deletes.every(
    (d) =>
      d.localEntry &&
      d.ancestorEntry &&
      d.localEntry.hash === d.ancestorEntry.hash &&
      !d.remoteEntry
  )
  if (!allUnchangedLocal) return false

  const ancestorFileCount = Object.keys(ancestor.files).length
  if (ancestorFileCount === 0) return false

  return remote.updatedAt > ancestor.updatedAt
}

function assertDeleteRemotePropagationAllowed(
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

  const localInitiated = isLocalInitiatedDeleteRemotePropagation(deleteRemoteDecisions, local)

  if (
    !localInitiated &&
    remoteFileCount >= SYNC_DELETE_GUARD_MIN_REMOTE_FILES &&
    deleteRemoteCount / remoteFileCount > SYNC_DELETE_GUARD_MAX_DELETE_RATIO
  ) {
    throw new SyncDeletePropagationBlockedError(
      deleteRemoteCount,
      remoteFileCount,
      'remote',
      'mass_delete'
    )
  }

  const unchangedRemoteDeletes = deleteRemoteDecisions.filter(
    (d) => d.remoteEntry && d.ancestorEntry && d.remoteEntry.hash === d.ancestorEntry.hash
  )

  if (
    !localInitiated &&
    ancestorFileCount >= SYNC_DELETE_GUARD_MIN_REMOTE_FILES &&
    localFileCount < ancestorFileCount * SYNC_LOCAL_VS_ANCESTOR_MIN_RATIO &&
    unchangedRemoteDeletes.length === deleteRemoteCount
  ) {
    throw new SyncDeletePropagationBlockedError(
      deleteRemoteCount,
      remoteFileCount,
      'remote',
      'local_data_loss'
    )
  }

  if (previousLocal) {
    const previousLocalCount = Object.keys(previousLocal.files).length
    if (
      !localInitiated &&
      previousLocalCount >= SYNC_DELETE_GUARD_MIN_REMOTE_FILES &&
      localFileCount < previousLocalCount * SYNC_LOCAL_DATA_LOSS_RATIO
    ) {
      throw new SyncDeletePropagationBlockedError(
        deleteRemoteCount,
        remoteFileCount,
        'remote',
        'local_data_loss'
      )
    }
  }
}

/**
 * 阻止「远端缺失 + 本地未变」被误判为远端删除而批量清空本地。
 * 典型场景：云端 manifest 被清空或大量删除，但本地仍保留完整数据。
 */
function assertDeleteLocalPropagationAllowed(
  decisions: MergeDecision[],
  local: SyncManifest,
  remote: SyncManifest,
  ancestor: SyncManifest
): void {
  const deleteLocalDecisions = decisions.filter((d) => d.type === 'delete-local')
  const deleteLocalCount = deleteLocalDecisions.length
  if (deleteLocalCount === 0) return

  const remoteFileCount = Object.keys(remote.files).length
  const localFileCount = Object.keys(local.files).length
  const ancestorFileCount = Object.keys(ancestor.files).length

  const remoteInitiated = isRemoteInitiatedDeleteLocalPropagation(
    deleteLocalDecisions,
    remote,
    ancestor
  )

  if (
    !remoteInitiated &&
    localFileCount >= SYNC_DELETE_GUARD_MIN_REMOTE_FILES &&
    deleteLocalCount / localFileCount > SYNC_DELETE_GUARD_MAX_DELETE_RATIO
  ) {
    throw new SyncDeletePropagationBlockedError(
      deleteLocalCount,
      localFileCount,
      'local',
      'mass_delete'
    )
  }

  const unchangedLocalDeletes = deleteLocalDecisions.filter(
    (d) => d.localEntry && d.ancestorEntry && d.localEntry.hash === d.ancestorEntry.hash
  )

  if (
    !remoteInitiated &&
    ancestorFileCount >= SYNC_DELETE_GUARD_MIN_REMOTE_FILES &&
    remoteFileCount < ancestorFileCount * SYNC_LOCAL_VS_ANCESTOR_MIN_RATIO &&
    unchangedLocalDeletes.length === deleteLocalCount
  ) {
    throw new SyncDeletePropagationBlockedError(
      deleteLocalCount,
      localFileCount,
      'local',
      'remote_data_loss'
    )
  }
}

/**
 * 双向同步前校验：阻止「本地缺失 + 远端未变」被误判为本地删除而批量清空远端，
 * 以及「远端缺失 + 本地未变」被误判为远端删除而批量清空本地。
 */
export function assertBidirectionalDeletePropagationAllowed(
  decisions: MergeDecision[],
  local: SyncManifest,
  remote: SyncManifest,
  ancestor: SyncManifest,
  previousLocal?: SyncManifest
): void {
  assertDeleteRemotePropagationAllowed(decisions, local, remote, ancestor, previousLocal)
  assertDeleteLocalPropagationAllowed(decisions, local, remote, ancestor)
}

export function omitBlockedDeletePropagationDecisions(decisions: MergeDecision[]): MergeDecision[] {
  return decisions.filter((d) => d.type !== 'delete-local' && d.type !== 'delete-remote')
}

/** 删除传播冲突：须由用户选择处理方式后才能继续同步 */
export class SyncDeletePropagationChoiceRequiredError extends Error {
  constructor(public readonly block: SyncDeletePropagationBlockedError) {
    super(
      `SyncDeletePropagationChoiceRequiredError: ${block.deleteCount}/${block.baselineFileCount} ${block.direction} deletions need user choice (${block.reason})`
    )
    this.name = 'SyncDeletePropagationChoiceRequiredError'
  }
}

export function inspectDeletePropagationBlock(
  decisions: MergeDecision[],
  local: SyncManifest,
  remote: SyncManifest,
  ancestor: SyncManifest,
  previousLocal?: SyncManifest
): SyncDeletePropagationBlockedError | null {
  try {
    assertBidirectionalDeletePropagationAllowed(decisions, local, remote, ancestor, previousLocal)
    return null
  } catch (error) {
    if (error instanceof SyncDeletePropagationBlockedError) {
      return error
    }
    throw error
  }
}

function applyDeletePropagationChoice(
  decisions: MergeDecision[],
  blocked: SyncDeletePropagationBlockedError,
  choice: SyncDeletePropagationChoice
): MergeDecision[] {
  if (choice === 'skip-deletes') {
    return omitBlockedDeletePropagationDecisions(decisions)
  }

  if (choice === 'follow-remote') {
    if (blocked.direction === 'local') {
      return decisions.filter(
        (d) =>
          d.type !== 'upload' &&
          d.type !== 'delete-remote' &&
          !(d.type === 'conflict-resolved' && d.direction === 'upload')
      )
    }
    return decisions.filter((d) => d.type !== 'delete-remote')
  }

  if (choice === 'push-local') {
    if (blocked.direction === 'local') {
      return decisions.filter((d) => d.type !== 'delete-local')
    }
    return decisions.filter((d) => d.type !== 'delete-local')
  }

  return omitBlockedDeletePropagationDecisions(decisions)
}

/** 删除传播被拦截时须用户选择；未选择则抛出 SyncDeletePropagationChoiceRequiredError */
export function resolveSyncMergeDecisions(
  decisions: MergeDecision[],
  local: SyncManifest,
  remote: SyncManifest,
  ancestor: SyncManifest,
  previousLocal?: SyncManifest,
  options?: { deletePropagationChoice?: SyncDeletePropagationChoice }
): MergeDecision[] {
  const block = inspectDeletePropagationBlock(decisions, local, remote, ancestor, previousLocal)
  if (!block) {
    return decisions
  }

  const choice = options?.deletePropagationChoice
  if (!choice) {
    throw new SyncDeletePropagationChoiceRequiredError(block)
  }

  return applyDeletePropagationChoice(decisions, block, choice)
}
