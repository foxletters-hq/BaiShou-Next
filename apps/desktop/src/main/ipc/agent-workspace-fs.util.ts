import * as fs from 'fs/promises'
import * as path from 'path'
import type { AgentWorkspaceDirEntry } from '@baishou/shared'
import { shouldListWorkbenchTreeEntry } from '../services/workbench-tree-list.util'

export const MAX_READ_BYTES = 512 * 1024
export const MAX_LIST_ENTRIES = 500

export function stripUtf8Bom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

/** 把工作区内相对路径规范成 posix，并挡住逃出根目录的写法。 */
export function resolveWithinRoot(rootPath: string, relativePath = ''): string {
  const root = path.resolve(rootPath)
  const target = path.resolve(root, relativePath || '.')
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('Path escapes workspace root')
  }
  return target
}

export function normalizeWorkspaceRelativePath(
  relativePath: string,
  options?: { trimTrailingSlash?: boolean }
): string {
  let normalized = relativePath.replace(/\\/g, '/').replace(/^\/+/, '')
  if (options?.trimTrailingSlash) {
    normalized = normalized.replace(/\/$/, '')
  }
  return normalized
}

export function buildRenamedWorkspaceRelativePath(
  relativePath: string,
  nextName: string
): { normalized: string; nextRelative: string; trimmedName: string } {
  const normalized = normalizeWorkspaceRelativePath(relativePath)
  const trimmedName = nextName.trim().replace(/\\/g, '/').split('/').pop() ?? ''
  const parent = path.posix.dirname(normalized.replace(/\\/g, '/'))
  const nextRelative = parent === '.' ? trimmedName : `${parent}/${trimmedName}`
  return { normalized, nextRelative, trimmedName }
}

export async function listDirectoryEntries(
  rootPath: string,
  relativePath = ''
): Promise<AgentWorkspaceDirEntry[]> {
  const dirPath = resolveWithinRoot(rootPath, relativePath)
  const stat = await fs.stat(dirPath)
  if (!stat.isDirectory()) {
    throw new Error('Not a directory')
  }

  const dirents = await fs.readdir(dirPath, { withFileTypes: true })
  const entries: AgentWorkspaceDirEntry[] = []

  for (const dirent of dirents) {
    if (entries.length >= MAX_LIST_ENTRIES) break
    const name = dirent.name
    if (!shouldListWorkbenchTreeEntry(name)) continue
    let isDirectory = dirent.isDirectory()
    if (!isDirectory && dirent.isSymbolicLink()) {
      try {
        isDirectory = (await fs.stat(path.join(dirPath, name))).isDirectory()
      } catch {
        continue
      }
    }
    const entryRelative = relativePath
      ? path.posix.join(relativePath.replace(/\\/g, '/'), name)
      : name
    entries.push({
      name,
      relativePath: entryRelative,
      isDirectory
    })
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return entries
}
