import * as path from 'path'
import type { VersionHistoryEntry } from '@baishou/shared'

export interface WorkspaceFolderGitRoot {
  folderRoot: string
  gitRoot: string
  scopePrefix: ''
}

/**
 * 工作区 Git 只使用该文件夹自己的仓库，不向上查找父目录。
 * 若挂到上级仓库，提交会写进错误的历史，GRAPH 也会读错记录。
 */
export function resolveWorkspaceFolderGitRoot(folderRoot: string): WorkspaceFolderGitRoot {
  const resolved = path.resolve(folderRoot)
  return {
    folderRoot: resolved,
    gitRoot: resolved,
    scopePrefix: ''
  }
}

export function parseGitNameOnlyOutput(raw: string): string[] {
  return raw
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

/** `git show <revision>:<path>` 用的规格；路径统一为正斜杠 */
export function toGitShowSpec(revision: string, filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/')
  return `${revision}:${normalized}`
}

export function parseGitNulSeparatedPaths(raw: string): string[] {
  return raw
    .split('\0')
    .map((line) => line.trim())
    .filter(Boolean)
}

export function toWorkspaceHistoryEntries(
  rows: Array<{ hash: string; message: string; date: string }>,
  headHash: string
): VersionHistoryEntry[] {
  const headShort = headHash.substring(0, 7)
  return rows.map((row) => {
    const hashShort = row.hash.substring(0, 7)
    return {
      commit: {
        hash: hashShort,
        message: row.message,
        date: new Date(row.date),
        files: []
      },
      changes: [],
      isCurrent: hashShort === headShort || row.hash === headHash
    }
  })
}
