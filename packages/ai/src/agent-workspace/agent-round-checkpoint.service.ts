import { randomUUID } from 'node:crypto'
import type { AgentRoundCheckpoint } from '@baishou/shared'
import { normalizeWorkspaceRelativePath, toWorkspaceRelativePath } from './workspace-path.sandbox'
import { createNodeWorkspaceFs, type WorkspaceFsAdapter } from './workspace-fs'
import { createInlineSnapshotStore } from './inline-snapshot.store'
import {
  applyRoundEndHandle,
  applyRoundStartHandle,
  noteTouchedPath,
  resolveRollbackPaths,
  toRoundEndHandle,
  toRoundStartHandle
} from './checkpoint-snapshot.mapper'
import {
  emptyRestoreResult,
  type WorkspaceSnapshotRestoreResult,
  type WorkspaceSnapshotStore
} from './workspace-snapshot-store'

export interface CaptureCheckpointInput {
  sessionId: string
  userMessageId: string
  folderRoot: string
  paths: string[]
}

export type RollbackResult = WorkspaceSnapshotRestoreResult

export class AgentRoundCheckpointService {
  private readonly checkpoints = new Map<string, AgentRoundCheckpoint>()
  private readonly store: WorkspaceSnapshotStore

  constructor(
    fs: WorkspaceFsAdapter = createNodeWorkspaceFs(),
    store?: WorkspaceSnapshotStore
  ) {
    this.store = store ?? createInlineSnapshotStore(fs)
  }

  createSnapshot(input: CaptureCheckpointInput): Promise<AgentRoundCheckpoint> {
    return this.capturePaths(input)
  }

  async capturePaths(input: CaptureCheckpointInput): Promise<AgentRoundCheckpoint> {
    const handle = await this.store.capture({
      folderRoot: input.folderRoot,
      paths: input.paths
    })

    const checkpoint: AgentRoundCheckpoint = {
      id: randomUUID(),
      sessionId: input.sessionId,
      userMessageId: input.userMessageId,
      createdAt: new Date().toISOString(),
      files: []
    }
    applyRoundStartHandle(checkpoint, handle)

    this.checkpoints.set(checkpoint.id, checkpoint)
    return checkpoint
  }

  /**
   * 轮次结束时再拍一张。
   * 与开始那张做 diff 就能得到本轮的全部改动，包括终端命令这类没有经过写工具的改动。
   */
  async captureRoundEnd(
    checkpointId: string,
    folderRoot: string
  ): Promise<AgentRoundCheckpoint | undefined> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) return undefined

    const handle = await this.store.capture({ folderRoot, paths: [] })
    return applyRoundEndHandle(checkpoint, handle)
  }

  /** 回滚该轮默认会处理的路径：AI 归因路径，加上快照自己能列举的部分 */
  listRollbackPaths(checkpoint: AgentRoundCheckpoint): string[] {
    const handle = toRoundStartHandle(checkpoint)
    return resolveRollbackPaths(checkpoint, this.store.listPaths(handle))
  }

  /** 本轮实际变化的全部路径；快照实现算不出来时返回 null */
  async listRoundChangedPaths(
    checkpoint: AgentRoundCheckpoint,
    folderRoot: string
  ): Promise<string[] | null> {
    const from = toRoundStartHandle(checkpoint)
    const to = toRoundEndHandle(checkpoint)
    if (!to) return null
    return this.store.diffPaths({ folderRoot, from, to })
  }

  async rollback(
    checkpointId: string,
    folderRoot: string,
    options: { paths?: string[] } = {}
  ): Promise<RollbackResult> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    const handle = toRoundStartHandle(checkpoint)
    const paths = options.paths ?? resolveRollbackPaths(checkpoint, this.store.listPaths(handle))
    if (paths.length === 0) return emptyRestoreResult()

    return this.store.restore({ folderRoot, handle, paths })
  }

  /**
   * 按时间正序传入多轮 checkpoint，从后往前依次 restore，
   * 使磁盘收敛到最早一轮写盘前（回滚中间轮时一并撤销后续轮改动）。
   */
  async cascadeRollback(
    checkpointsChronological: AgentRoundCheckpoint[],
    folderRoot: string,
    options: { pathsFor?: (checkpoint: AgentRoundCheckpoint) => string[] } = {}
  ): Promise<RollbackResult> {
    const merged: RollbackResult = emptyRestoreResult()
    const lastAction = new Map<string, 'restored' | 'deleted' | 'skipped'>()

    for (const checkpoint of [...checkpointsChronological].reverse()) {
      this.restoreCheckpoint(checkpoint)
      const result = await this.rollback(checkpoint.id, folderRoot, {
        paths: options.pathsFor?.(checkpoint)
      })
      for (const path of result.restored) lastAction.set(path, 'restored')
      for (const path of result.deleted) lastAction.set(path, 'deleted')
      for (const path of result.skipped) {
        if (!lastAction.has(path)) lastAction.set(path, 'skipped')
      }
    }

    for (const [path, action] of lastAction) {
      merged[action].push(path)
    }
    return merged
  }

  getCheckpoint(id: string): AgentRoundCheckpoint | undefined {
    return this.checkpoints.get(id)
  }

  getCheckpointsForSession(sessionId: string): AgentRoundCheckpoint[] {
    return [...this.checkpoints.values()].filter((checkpoint) => checkpoint.sessionId === sessionId)
  }

  /**
   * 记录一条本轮被写工具触碰的路径。
   *
   * 对影子 Git 快照这只是归因：正文早已在轮次开始的 tree 里，这里记的是「哪些改动确实是 AI 做的」，
   * 好让回滚不去动用户同期在别处的手改。对 inline 快照则必须趁写盘前把正文读走。
   */
  async ensurePathCaptured(
    checkpointId: string,
    folderRoot: string,
    relativePath: string
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) return

    const relPath = normalizeWorkspaceRelativePath(relativePath)
    if (!relPath) return

    noteTouchedPath(checkpoint, relPath)

    const next = await this.store.extend({
      folderRoot,
      handle: toRoundStartHandle(checkpoint),
      relativePath: relPath
    })
    if (next.kind === 'inline') checkpoint.files = next.files
  }

  toWorkspaceRelative(folderRoot: string, absolutePath: string): string {
    return toWorkspaceRelativePath(folderRoot, absolutePath)
  }

  /** 从持久化存储恢复检查点（桌面工作区会话） */
  restoreCheckpoint(checkpoint: AgentRoundCheckpoint): void {
    this.checkpoints.set(checkpoint.id, checkpoint)
  }

  removeCheckpoint(id: string): boolean {
    return this.checkpoints.delete(id)
  }

  removeCheckpointsForUserMessages(sessionId: string, userMessageIds: string[]): string[] {
    if (userMessageIds.length === 0) return []
    const targetUserMessageIds = new Set(userMessageIds)
    const removed: string[] = []
    for (const [id, checkpoint] of this.checkpoints) {
      if (checkpoint.sessionId === sessionId && targetUserMessageIds.has(checkpoint.userMessageId)) {
        this.checkpoints.delete(id)
        removed.push(id)
      }
    }
    return removed
  }
}
