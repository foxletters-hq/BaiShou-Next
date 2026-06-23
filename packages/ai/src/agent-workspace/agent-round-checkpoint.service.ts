import { randomUUID } from 'node:crypto'
import type { AgentRoundCheckpoint, AgentRoundCheckpointFileEntry } from '@baishou/shared'
import {
  normalizeWorkspaceRelativePath,
  resolveWorkspacePath,
  toWorkspaceRelativePath
} from './workspace-path.sandbox'
import { createNodeWorkspaceFs, hashWorkspaceContent, type WorkspaceFsAdapter } from './workspace-fs'

export interface CaptureCheckpointInput {
  sessionId: string
  userMessageId: string
  folderRoot: string
  paths: string[]
}

export interface RollbackResult {
  restored: string[]
  deleted: string[]
  skipped: string[]
}

export class AgentRoundCheckpointService {
  private readonly checkpoints = new Map<string, AgentRoundCheckpoint>()

  constructor(private readonly fs: WorkspaceFsAdapter = createNodeWorkspaceFs()) {}

  createSnapshot(input: CaptureCheckpointInput): Promise<AgentRoundCheckpoint> {
    return this.capturePaths(input)
  }

  async capturePaths(input: CaptureCheckpointInput): Promise<AgentRoundCheckpoint> {
    const uniquePaths = [...new Set(input.paths.map((path) => normalizeWorkspaceRelativePath(path)))]
    const files: AgentRoundCheckpointFileEntry[] = []

    for (const relPath of uniquePaths) {
      const absolutePath = resolveWorkspacePath(input.folderRoot, relPath)
      const existed = await this.fs.exists(absolutePath)
      const beforeContent = existed ? await this.fs.readFile(absolutePath) : null

      files.push({
        path: relPath,
        existed,
        beforeContent: beforeContent ?? undefined,
        beforeHash: beforeContent != null ? hashWorkspaceContent(beforeContent) : undefined
      })
    }

    const checkpoint: AgentRoundCheckpoint = {
      id: randomUUID(),
      sessionId: input.sessionId,
      userMessageId: input.userMessageId,
      createdAt: new Date().toISOString(),
      files
    }

    this.checkpoints.set(checkpoint.id, checkpoint)
    return checkpoint
  }

  async rollback(checkpointId: string, folderRoot: string): Promise<RollbackResult> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) {
      throw new Error(`Checkpoint not found: ${checkpointId}`)
    }

    const restored: string[] = []
    const deleted: string[] = []
    const skipped: string[] = []

    for (const entry of checkpoint.files) {
      const absolutePath = resolveWorkspacePath(folderRoot, entry.path)
      const existsNow = await this.fs.exists(absolutePath)

      if (entry.existed) {
        if (entry.beforeContent == null) {
          skipped.push(entry.path)
          continue
        }
        await this.fs.writeFile(absolutePath, entry.beforeContent)
        restored.push(entry.path)
        continue
      }

      if (existsNow) {
        await this.fs.deleteFile(absolutePath)
        deleted.push(entry.path)
      } else {
        skipped.push(entry.path)
      }
    }

    return { restored, deleted, skipped }
  }

  getCheckpoint(id: string): AgentRoundCheckpoint | undefined {
    return this.checkpoints.get(id)
  }

  getCheckpointsForSession(sessionId: string): AgentRoundCheckpoint[] {
    return [...this.checkpoints.values()].filter((checkpoint) => checkpoint.sessionId === sessionId)
  }

  /** Record a path touched during a round so rollback can restore pre-round state. */
  async ensurePathCaptured(
    checkpointId: string,
    folderRoot: string,
    relativePath: string
  ): Promise<void> {
    const checkpoint = this.checkpoints.get(checkpointId)
    if (!checkpoint) return

    const relPath = normalizeWorkspaceRelativePath(relativePath)
    if (checkpoint.files.some((entry) => entry.path === relPath)) {
      return
    }

    const absolutePath = resolveWorkspacePath(folderRoot, relPath)
    const existed = await this.fs.exists(absolutePath)
    const beforeContent = existed ? await this.fs.readFile(absolutePath) : null

    checkpoint.files.push({
      path: relPath,
      existed,
      beforeContent: beforeContent ?? undefined,
      beforeHash: beforeContent != null ? hashWorkspaceContent(beforeContent) : undefined
    })
  }

  toWorkspaceRelative(folderRoot: string, absolutePath: string): string {
    return toWorkspaceRelativePath(folderRoot, absolutePath)
  }

  /** 从持久化存储恢复检查点（桌面工作区会话） */
  restoreCheckpoint(checkpoint: AgentRoundCheckpoint): void {
    this.checkpoints.set(checkpoint.id, checkpoint)
  }
}
