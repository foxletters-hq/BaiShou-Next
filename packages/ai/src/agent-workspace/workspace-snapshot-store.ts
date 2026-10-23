import type { AgentRoundCheckpointFileEntry } from '@baishou/shared'

export type WorkspaceSnapshotKind = 'git' | 'inline'

/** 纯文本快照：直接把写前正文留在句柄里 */
export interface InlineSnapshotHandle {
  kind: 'inline'
  files: AgentRoundCheckpointFileEntry[]
}

/** 影子 Git 快照：只留一个 tree oid，正文在影子仓库的对象库里 */
export interface GitSnapshotHandle {
  kind: 'git'
  treeOid: string
  /**
   * 拍快照时因体积超限被挡在 tree 之外的路径。
   * 必须随快照一起记下来：回滚时文件大小可能已经变了，事后无法反推当时是否被排除，
   * 而把这类路径误判成「本轮新建」会直接删掉用户原有的文件。
   */
  excludedPaths?: string[]
}

export type WorkspaceSnapshotHandle = InlineSnapshotHandle | GitSnapshotHandle

export interface WorkspaceSnapshotRestoreResult {
  restored: string[]
  deleted: string[]
  skipped: string[]
}

export interface WorkspaceSnapshotStore {
  readonly kind: WorkspaceSnapshotKind

  /**
   * 拍一张快照。
   * inline 只记录 `paths` 指定的文件；git 忽略 `paths`，整棵工作树写成一个 tree。
   */
  capture(input: { folderRoot: string; paths?: string[] }): Promise<WorkspaceSnapshotHandle>

  /**
   * 轮次进行中补录一个即将被写的路径。
   * inline 必须在此刻读走正文，否则写盘后就拿不到写前状态；git 无需处理（tree 已含全量）。
   */
  extend(input: {
    folderRoot: string
    handle: WorkspaceSnapshotHandle
    relativePath: string
  }): Promise<WorkspaceSnapshotHandle>

  /**
   * 快照自身知道的路径集合。
   * git 返回 null——它的 tree 覆盖整棵工作树，列举等于列举整个工作区，
   * 回滚范围必须由调用方显式给出，否则会误伤用户文件。
   */
  listPaths(handle: WorkspaceSnapshotHandle): string[] | null

  /** 把 `paths` 恢复到快照当时的状态；快照里不存在的路径视为「当时没有」，即删除 */
  restore(input: {
    folderRoot: string
    handle: WorkspaceSnapshotHandle
    paths: string[]
  }): Promise<WorkspaceSnapshotRestoreResult>

  /** 两张快照之间发生变化的路径；inline 无从计算，返回 null */
  diffPaths(input: {
    folderRoot: string
    from: WorkspaceSnapshotHandle
    to: WorkspaceSnapshotHandle
  }): Promise<string[] | null>
}

export function isGitSnapshotHandle(
  handle: WorkspaceSnapshotHandle | null | undefined
): handle is GitSnapshotHandle {
  return handle?.kind === 'git'
}

export function isInlineSnapshotHandle(
  handle: WorkspaceSnapshotHandle | null | undefined
): handle is InlineSnapshotHandle {
  return handle?.kind === 'inline'
}

export function emptyRestoreResult(): WorkspaceSnapshotRestoreResult {
  return { restored: [], deleted: [], skipped: [] }
}
