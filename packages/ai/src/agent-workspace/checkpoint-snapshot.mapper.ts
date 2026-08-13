import type { AgentRoundCheckpoint } from '@baishou/shared'
import type { WorkspaceSnapshotHandle } from './workspace-snapshot-store'

/**
 * 读出本轮写盘前的快照句柄。
 *
 * 没有 `snapshotKind` 的检查点来自影子 Git 之前的版本，一律按 inline 处理，
 * 这样历史会话在升级后依然能回滚。
 */
export function toRoundStartHandle(checkpoint: AgentRoundCheckpoint): WorkspaceSnapshotHandle {
  if (checkpoint.snapshotKind === 'git' && checkpoint.startTreeOid) {
    return checkpoint.excludedPaths?.length
      ? {
          kind: 'git',
          treeOid: checkpoint.startTreeOid,
          excludedPaths: checkpoint.excludedPaths
        }
      : { kind: 'git', treeOid: checkpoint.startTreeOid }
  }
  return { kind: 'inline', files: checkpoint.files }
}

/** 读出本轮结束时的快照句柄；只有 git 快照才有，用于算出本轮全部改动 */
export function toRoundEndHandle(checkpoint: AgentRoundCheckpoint): WorkspaceSnapshotHandle | null {
  if (checkpoint.snapshotKind === 'git' && checkpoint.endTreeOid) {
    return { kind: 'git', treeOid: checkpoint.endTreeOid }
  }
  return null
}

export function applyRoundStartHandle(
  checkpoint: AgentRoundCheckpoint,
  handle: WorkspaceSnapshotHandle
): AgentRoundCheckpoint {
  if (handle.kind === 'git') {
    checkpoint.snapshotKind = 'git'
    checkpoint.startTreeOid = handle.treeOid
    if (handle.excludedPaths?.length) checkpoint.excludedPaths = [...handle.excludedPaths]
    // git 快照的正文在影子仓库里，检查点不再承载文件内容
    checkpoint.files = []
    return checkpoint
  }

  checkpoint.snapshotKind = 'inline'
  checkpoint.files = handle.files
  return checkpoint
}

export function applyRoundEndHandle(
  checkpoint: AgentRoundCheckpoint,
  handle: WorkspaceSnapshotHandle
): AgentRoundCheckpoint {
  if (handle.kind === 'git') checkpoint.endTreeOid = handle.treeOid
  return checkpoint
}

/** 记录一条 AI 写工具触碰过的路径，用于把回滚范围收敛到确实由 AI 造成的改动 */
export function noteTouchedPath(
  checkpoint: AgentRoundCheckpoint,
  relativePath: string
): AgentRoundCheckpoint {
  if (!relativePath) return checkpoint
  const touched = checkpoint.touchedPaths ?? []
  if (!touched.includes(relativePath)) touched.push(relativePath)
  checkpoint.touchedPaths = touched
  return checkpoint
}

/**
 * 回滚该轮时应当处理的路径。
 *
 * git 快照的 tree 覆盖整棵工作树，无法靠它列举范围，只能用写工具的归因记录；
 * inline 快照则以它自己存下的路径为准。
 */
export function resolveRollbackPaths(
  checkpoint: AgentRoundCheckpoint,
  snapshotListedPaths: string[] | null
): string[] {
  const paths = new Set<string>(snapshotListedPaths ?? [])
  for (const path of checkpoint.touchedPaths ?? []) paths.add(path)
  return [...paths]
}
