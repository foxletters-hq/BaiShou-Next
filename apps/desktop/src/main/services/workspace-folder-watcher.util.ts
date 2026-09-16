import * as path from 'path'
import { normalizeWorkspaceFolderKey } from './agent-workspace-registry.util'
import { shouldListWorkbenchTreeEntry } from './workbench-tree-list.util'

export type WorkspaceFsChangeKind = 'create' | 'modify' | 'delete' | 'rename'

export type WorkspaceFsChangedPayload = {
  folderRoot: string
  path: string
  kind: WorkspaceFsChangeKind
  previousPath?: string
  sessionId?: string
}

export type WorkspaceWatchTargetStatus =
  | 'ok'
  | 'missing'
  | 'not-directory'
  | 'filesystem-root'
  | 'not-registered'

/** 把绝对路径收成工作区相对路径；逃出根目录则返回 null。 */
export function toWorkspaceRelativePath(folderRoot: string, absolutePath: string): string | null {
  const root = path.resolve(folderRoot)
  const target = path.resolve(absolutePath)
  const relative = path.relative(root, target)
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null
  return relative.replace(/\\/g, '/')
}

export function isFilesystemRootPath(folderRoot: string): boolean {
  const resolved = path.resolve(folderRoot)
  const root = path.parse(resolved).root
  if (!root) return false
  return path.resolve(root) === resolved
}

export function evaluateWorkspaceWatchTarget(
  folderRoot: string,
  stat: { exists: boolean; isDirectory: boolean }
): Exclude<WorkspaceWatchTargetStatus, 'not-registered'> {
  if (isFilesystemRootPath(folderRoot)) return 'filesystem-root'
  if (!stat.exists) return 'missing'
  if (!stat.isDirectory) return 'not-directory'
  return 'ok'
}

export function isRegisteredWorkspaceFolder(
  folderRoot: string,
  workspaces: Array<{ folderRoot: string }>
): boolean {
  const key = normalizeWorkspaceFolderKey(path.resolve(folderRoot))
  return workspaces.some(
    (entry) => normalizeWorkspaceFolderKey(path.resolve(entry.folderRoot)) === key
  )
}

export function canStartWorkspaceFolderWatch(params: {
  folderRoot: string
  stat: { exists: boolean; isDirectory: boolean }
  workspaces: Array<{ folderRoot: string }>
}): boolean {
  if (evaluateWorkspaceWatchTarget(params.folderRoot, params.stat) !== 'ok') return false
  return isRegisteredWorkspaceFolder(params.folderRoot, params.workspaces)
}

/**
 * 只检查工作区内部相对路径。祖先目录叫 node_modules 不影响；
 * 工作区里的 .git / node_modules 仍跳过。
 */
export function shouldIgnoreWorkspaceWatchPath(folderRoot: string, absolutePath: string): boolean {
  const relative = toWorkspaceRelativePath(folderRoot, absolutePath)
  if (relative == null) return true
  if (relative === '') return false
  return relative.split('/').some((part) => {
    if (part.toLowerCase() === 'node_modules') return true
    return !shouldListWorkbenchTreeEntry(part)
  })
}

export function mapWatchEventToKind(eventName: string): WorkspaceFsChangeKind | null {
  if (eventName === 'add' || eventName === 'addDir') return 'create'
  if (eventName === 'change') return 'modify'
  if (eventName === 'unlink' || eventName === 'unlinkDir') return 'delete'
  return null
}

export function workspaceFolderWatchKey(folderRoot: string): string {
  return path.resolve(folderRoot).replace(/\\/g, '/').toLowerCase()
}
