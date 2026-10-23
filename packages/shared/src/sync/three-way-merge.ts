import type { ManifestEntry, SyncManifest } from '../types/version-control.types'
import {
  isIncrementalSyncChatBackgroundPath,
  isIncrementalSyncProtectedRemotePath,
  isJsonlShardsManifestSyncPath,
  isLegacyVaultSettingsSyncPath,
  isSqliteRuntimeSyncPath
} from '../utils/incremental-sync-scan.util'
import {
  getSyncManifestRemovedEntry,
  isRemoteRemovalRecorded,
  SYNC_TOMBSTONE_CLOCK_SKEW_MS
} from './sync-manifest-removed.util'

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

    if (isJsonlShardsManifestSyncPath(filePath)) {
      continue
    }

    // 过渡期：旧端仍在使用 <Vault>/.baishou/settings/，新端迁移后本地扫描不到。
    // 远端仍有、祖先也有时不要删远端；只有明确 tombstone 才传播删除。
    if (isLegacyVaultSettingsSyncPath(filePath)) {
      const legacyLocal = local.files[filePath] ?? null
      const legacyRemote = remote.files[filePath] ?? null
      const legacyAncestor = ancestor.files[filePath] ?? null
      if (!legacyLocal && legacyRemote && legacyAncestor) {
        const removed = getSyncManifestRemovedEntry(remote, filePath)
        if (
          removed &&
          legacyRemote.lastModified <= removed.removedAt + SYNC_TOMBSTONE_CLOCK_SKEW_MS
        ) {
          decisions.push(
            mkDecision(
              'delete-remote',
              filePath,
              legacyRemote,
              legacyLocal,
              legacyRemote,
              legacyAncestor
            )
          )
        }
        continue
      }
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
    // 首次同步的保护路径（global settings / vault.json / registry / 用户技能 / 旧 settings）
    // 远端优先，避免本机刚生成的默认值覆盖云端已有数据。
    const preferRemote = isIncrementalSyncProtectedRemotePath(filePath)
    return {
      filePath,
      type: 'conflict-resolved',
      direction: preferRemote
        ? 'download'
        : local.lastModified >= remote.lastModified
          ? 'upload'
          : 'download',
      hash: preferRemote || remote.lastModified >= local.lastModified ? remote.hash : local.hash,
      size: preferRemote || remote.lastModified >= local.lastModified ? remote.size : local.size,
      localEntry: local,
      remoteEntry: remote,
      ancestorEntry: ancestor
    }
  }

  if (local && remote && ancestor) {
    return decideThreeWay(filePath, local, remote, ancestor)
  }

  if (!local && remote && !ancestor) {
    const removed = getSyncManifestRemovedEntry(remoteManifest, filePath)
    // 陈旧复活：云端文件未明显新于 tombstone（含时钟偏差），继续删远端而非 download
    if (removed && remote.lastModified <= removed.removedAt + SYNC_TOMBSTONE_CLOCK_SKEW_MS) {
      return mkDecision('delete-remote', filePath, remote, local, remote, ancestor)
    }
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
