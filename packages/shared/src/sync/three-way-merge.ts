import type { ManifestEntry, SyncManifest } from '../types/version-control.types'
import {
  isIncrementalSyncChatBackgroundPath,
  isSqliteRuntimeSyncPath
} from '../utils/incremental-sync-scan.util'
import { isRemoteRemovalRecorded } from './sync-manifest-removed.util'

/** 合并决策 */
export interface MergeDecision {
  /** 文件路径 */
  filePath: string
  /** 操作类型 */
  type: 'upload' | 'download' | 'delete-local' | 'delete-remote' | 'skip' | 'conflict-resolved'
  /** 冲突时的数据流向 */
  direction?: 'upload' | 'download'
  /** 文件 hash */
  hash: string
  /** 文件大小 */
  size: number
  /** 本地条目 */
  localEntry: ManifestEntry | null
  /** 远程条目 */
  remoteEntry: ManifestEntry | null
  /** 祖先条目 */
  ancestorEntry: ManifestEntry | null
}

/**
 * 三向合并算法
 *
 * 对比本地 manifest、远程 manifest、共同祖先（上次远程快照），
 * 生成每个文件的合并决策。
 */
export function threeWayMerge(
  local: SyncManifest,
  remote: SyncManifest,
  ancestor: SyncManifest
): MergeDecision[] {
  // removed 仅在「本地有、远端无、祖先无」时按需查表，无需并入路径并集
  const allPaths = new Set([
    ...Object.keys(local.files),
    ...Object.keys(remote.files),
    ...Object.keys(ancestor.files)
  ])

  const decisions: MergeDecision[] = []

  for (const filePath of allPaths) {
    if (isIncrementalSyncChatBackgroundPath(filePath)) {
      const remoteEntry = remote.files[filePath] ?? null
      if (remoteEntry) {
        const ancestorEntry = ancestor.files[filePath] ?? null
        decisions.push(
          mkDecision('delete-remote', filePath, remoteEntry, null, remoteEntry, ancestorEntry)
        )
      }
      continue
    }

    if (isSqliteRuntimeSyncPath(filePath)) {
      const remoteEntry = remote.files[filePath] ?? null
      if (remoteEntry) {
        const ancestorEntry = ancestor.files[filePath] ?? null
        decisions.push(
          mkDecision('delete-remote', filePath, remoteEntry, null, remoteEntry, ancestorEntry)
        )
      }
      continue
    }

    const localEntry = local.files[filePath] ?? null
    const remoteEntry = remote.files[filePath] ?? null
    const ancestorEntry = ancestor.files[filePath] ?? null

    const decision = decide(filePath, localEntry, remoteEntry, ancestorEntry, remote)
    if (decision) {
      decisions.push(decision)
    }
  }

  return decisions
}

type DecideContext = SyncManifest

function decide(
  filePath: string,
  local: ManifestEntry | null,
  remote: ManifestEntry | null,
  ancestor: ManifestEntry | null,
  remoteManifest: DecideContext
): MergeDecision | null {
  if (!local && remote && ancestor) {
    return mkDecision('delete-remote', filePath, remote, local, remote, ancestor)
  }

  if (local && !remote && ancestor) {
    return mkDecision('delete-local', filePath, local, local, remote, ancestor)
  }

  if (!local && !remote && ancestor) {
    return mkDecision('skip', filePath, ancestor, local, remote, ancestor)
  }

  if (local && remote && !ancestor) {
    if (local.hash === remote.hash) {
      return mkDecision('skip', filePath, local, local, remote, ancestor)
    }
    return {
      filePath,
      type: 'conflict-resolved',
      direction: 'download',
      hash: remote.hash,
      size: remote.size,
      localEntry: local,
      remoteEntry: remote,
      ancestorEntry: ancestor
    }
  }

  if (local && remote && ancestor) {
    return decideThreeWay(filePath, local, remote, ancestor)
  }

  if (!local && remote && !ancestor) {
    return mkDecision('download', filePath, remote, local, remote, ancestor)
  }

  if (local && !remote && !ancestor) {
    if (isRemoteRemovalRecorded(remoteManifest, filePath, local)) {
      return mkDecision('delete-local', filePath, local, local, remote, ancestor)
    }
    return mkDecision('upload', filePath, local, local, remote, ancestor)
  }

  return null
}

function decideThreeWay(
  filePath: string,
  local: ManifestEntry,
  remote: ManifestEntry,
  ancestor: ManifestEntry
): MergeDecision {
  if (local.hash === remote.hash && local.hash === ancestor.hash) {
    return mkDecision('skip', filePath, local, local, remote, ancestor)
  }

  if (local.hash === ancestor.hash && remote.hash !== ancestor.hash) {
    return mkDecision('download', filePath, remote, local, remote, ancestor)
  }

  if (remote.hash === ancestor.hash && local.hash !== ancestor.hash) {
    return mkDecision('upload', filePath, local, local, remote, ancestor)
  }

  const direction = local.lastModified >= remote.lastModified ? 'upload' : 'download'
  const entry = direction === 'upload' ? local : remote
  return {
    filePath,
    type: 'conflict-resolved',
    direction,
    hash: entry.hash,
    size: entry.size,
    localEntry: local,
    remoteEntry: remote,
    ancestorEntry: ancestor
  }
}

function mkDecision(
  type: MergeDecision['type'],
  filePath: string,
  entry: ManifestEntry,
  local: ManifestEntry | null,
  remote: ManifestEntry | null,
  ancestor: ManifestEntry | null
): MergeDecision {
  return {
    filePath,
    type,
    hash: entry.hash,
    size: entry.size,
    localEntry: local,
    remoteEntry: remote,
    ancestorEntry: ancestor
  }
}
