import type { SyncManifest, ManifestEntry } from '@baishou/shared'

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
 *
 * @param local - 本地文件系统扫描结果
 * @param remote - 刚从 S3 下载的 manifest
 * @param ancestor - 上次同步时的远程 manifest 快照 (last-remote-manifest.json)
 * @returns 所有文件的合并决策列表
 */
export function threeWayMerge(
  local: SyncManifest,
  remote: SyncManifest,
  ancestor: SyncManifest
): MergeDecision[] {
  const allPaths = new Set([
    ...Object.keys(local.files),
    ...Object.keys(remote.files),
    ...Object.keys(ancestor.files)
  ])

  const decisions: MergeDecision[] = []

  for (const filePath of allPaths) {
    const localEntry = local.files[filePath] ?? null
    const remoteEntry = remote.files[filePath] ?? null
    const ancestorEntry = ancestor.files[filePath] ?? null

    const decision = decide(filePath, localEntry, remoteEntry, ancestorEntry)
    if (decision) {
      decisions.push(decision)
    }
  }

  return decisions
}

function decide(
  filePath: string,
  local: ManifestEntry | null,
  remote: ManifestEntry | null,
  ancestor: ManifestEntry | null
): MergeDecision | null {
  // 本地✗ 远程✓ 祖先✓ → 本地删了 → 传播删除到远程
  if (!local && remote && ancestor) {
    return mkDecision('delete-remote', filePath, remote, local, remote, ancestor)
  }

  // 本地✓ 远程✗ 祖先✓ → 远程删了 → 传播删除到本地
  if (local && !remote && ancestor) {
    return mkDecision('delete-local', filePath, local, local, remote, ancestor)
  }

  // 本地✗ 远程✗ 祖先✓ → 双端都删了 → 跳过
  if (!local && !remote && ancestor) {
    return mkDecision('skip', filePath, ancestor, local, remote, ancestor)
  }

  // 本地✓ 远程✓ 祖先✗ → 双端都是新增 → 优先保护本地数据
  // 当祖先为空时（首次同步或快照丢失），不应以 mtime 决定覆盖
  // 而是以本地数据为准，避免云端文件时间戳更新导致本地被覆盖
  if (local && remote && !ancestor) {
    if (local.hash === remote.hash) {
      return mkDecision('skip', filePath, local, local, remote, ancestor)
    }
    // 数据不同时，优先保留本地版本，标记为冲突而非自动覆盖
    return {
      filePath,
      type: 'conflict-resolved',
      direction: 'upload',
      hash: local.hash,
      size: local.size,
      localEntry: local,
      remoteEntry: remote,
      ancestorEntry: ancestor
    }
  }

  // 本地✓ 远程✓ 祖先✓ → 三方都有
  if (local && remote && ancestor) {
    return decideThreeWay(filePath, local, remote, ancestor)
  }

  // 本地✗ 远程✓ 祖先✗ → 远程新增
  if (!local && remote && !ancestor) {
    return mkDecision('download', filePath, remote, local, remote, ancestor)
  }

  // 本地✓ 远程✗ 祖先✗ → 本地新增
  if (local && !remote && !ancestor) {
    return mkDecision('upload', filePath, local, local, remote, ancestor)
  }

  // 本地✗ 远程✗ 祖先✓ → 双端都删了 → 跳过
  // 本地✗ 远程✗ 祖先✗ → 从不存在 → 跳过
  return null
}

function decideThreeWay(
  filePath: string,
  local: ManifestEntry,
  remote: ManifestEntry,
  ancestor: ManifestEntry
): MergeDecision {
  // 全部相同 → 跳过
  if (local.hash === remote.hash && local.hash === ancestor.hash) {
    return mkDecision('skip', filePath, local, local, remote, ancestor)
  }

  // 本地=祖先≠远程 → 远程更新了 → 下载
  if (local.hash === ancestor.hash && remote.hash !== ancestor.hash) {
    return mkDecision('download', filePath, remote, local, remote, ancestor)
  }

  // 远程=祖先≠本地 → 本地更新了 → 上传
  if (remote.hash === ancestor.hash && local.hash !== ancestor.hash) {
    return mkDecision('upload', filePath, local, local, remote, ancestor)
  }

  // 全部不同 → 冲突，mtime 新胜旧
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
