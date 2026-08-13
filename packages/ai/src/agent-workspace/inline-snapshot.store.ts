import type { AgentRoundCheckpointFileEntry } from '@baishou/shared'
import { normalizeWorkspaceRelativePath, resolveWorkspacePath } from './workspace-path.sandbox'
import { createNodeWorkspaceFs, hashWorkspaceContent, type WorkspaceFsAdapter } from './workspace-fs'
import {
  emptyRestoreResult,
  isInlineSnapshotHandle,
  type InlineSnapshotHandle,
  type WorkspaceSnapshotHandle,
  type WorkspaceSnapshotRestoreResult,
  type WorkspaceSnapshotStore
} from './workspace-snapshot-store'

/**
 * 把写前正文直接留在检查点里的快照实现。
 *
 * 局限是设计使然，不是缺陷：以 utf-8 读取，因此只对文本安全；正文全量入库，
 * 因此体积随轮次线性增长。它的存在价值是在影子 Git 不可用时仍能回滚。
 */
export function createInlineSnapshotStore(
  fs: WorkspaceFsAdapter = createNodeWorkspaceFs()
): WorkspaceSnapshotStore {
  async function readEntry(
    folderRoot: string,
    relativePath: string
  ): Promise<AgentRoundCheckpointFileEntry> {
    const absolutePath = resolveWorkspacePath(folderRoot, relativePath)
    const existed = await fs.exists(absolutePath)
    const beforeContent = existed ? await fs.readFile(absolutePath) : null

    return {
      path: relativePath,
      existed,
      beforeContent: beforeContent ?? undefined,
      beforeHash: beforeContent != null ? hashWorkspaceContent(beforeContent) : undefined
    }
  }

  function asInline(handle: WorkspaceSnapshotHandle): InlineSnapshotHandle | null {
    return isInlineSnapshotHandle(handle) ? handle : null
  }

  return {
    kind: 'inline',

    async capture({ folderRoot, paths = [] }) {
      const uniquePaths = [...new Set(paths.map(normalizeWorkspaceRelativePath))]
      const files: AgentRoundCheckpointFileEntry[] = []
      for (const relativePath of uniquePaths) {
        files.push(await readEntry(folderRoot, relativePath))
      }
      return { kind: 'inline', files }
    },

    async extend({ folderRoot, handle, relativePath }) {
      const inline = asInline(handle)
      if (!inline) return handle

      const relPath = normalizeWorkspaceRelativePath(relativePath)
      if (inline.files.some((entry) => entry.path === relPath)) return inline

      inline.files.push(await readEntry(folderRoot, relPath))
      return inline
    },

    listPaths(handle) {
      const inline = asInline(handle)
      return inline ? inline.files.map((entry) => entry.path) : null
    },

    async restore({ folderRoot, handle, paths }) {
      const inline = asInline(handle)
      const result: WorkspaceSnapshotRestoreResult = emptyRestoreResult()
      if (!inline) return result

      const wanted = new Set(paths.map(normalizeWorkspaceRelativePath))
      for (const entry of inline.files) {
        if (!wanted.has(entry.path)) continue

        const absolutePath = resolveWorkspacePath(folderRoot, entry.path)
        if (entry.existed) {
          // 正文缺失时宁可不动，也好过把文件写成空的
          if (entry.beforeContent == null) {
            result.skipped.push(entry.path)
            continue
          }
          await fs.writeFile(absolutePath, entry.beforeContent)
          result.restored.push(entry.path)
          continue
        }

        if (await fs.exists(absolutePath)) {
          await fs.deleteFile(absolutePath)
          result.deleted.push(entry.path)
        } else {
          result.skipped.push(entry.path)
        }
      }

      const known = new Set(inline.files.map((entry) => entry.path))
      for (const relPath of wanted) {
        if (!known.has(relPath)) result.skipped.push(relPath)
      }

      return result
    },

    async diffPaths() {
      return null
    }
  }
}
