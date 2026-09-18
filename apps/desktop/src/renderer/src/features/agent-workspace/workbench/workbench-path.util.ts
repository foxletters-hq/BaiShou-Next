import { isSafeWorkspaceRelativePath } from '@baishou/shared'

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/$/, '')
}

export { isSafeWorkspaceRelativePath }

export function joinRelativePath(parent: string, name: string): string {
  const base = normalizeRelativePath(parent)
  const leaf = name.trim().replace(/\\/g, '/').split('/').pop() ?? ''
  if (!leaf) return base
  return base ? `${base}/${leaf}` : leaf
}

export function parentRelativePath(relativePath: string): string {
  const posix = normalizeRelativePath(relativePath)
  const idx = posix.lastIndexOf('/')
  return idx >= 0 ? posix.slice(0, idx) : ''
}

export function toAbsoluteWorkspacePath(folderRoot: string, relativePath?: string): string {
  const base = folderRoot.replace(/[/\\]+$/, '')
  if (!relativePath) return base
  return `${base}/${relativePath.replace(/^[/\\]+/, '').replace(/\\/g, '/')}`
}

export function resolveExplorerParentDir(
  selected: { relativePath: string; isDirectory: boolean } | null
): string {
  if (!selected) return ''
  return selected.isDirectory ? selected.relativePath : parentRelativePath(selected.relativePath)
}

/** 被改动条目的祖先目录（含根 `''`，不含叶子本身），供写盘后按层刷新文件树。 */
export function ancestorDirPaths(relativePath: string): string[] {
  const posix = normalizeRelativePath(relativePath)
  const dirs = ['']
  if (!posix) return dirs
  const parts = posix.split('/')
  for (let index = 0; index < parts.length - 1; index += 1) {
    dirs.push(parts.slice(0, index + 1).join('/'))
  }
  return dirs
}

/** 合并若干触碰路径的祖先目录，去重后从根到叶。 */
export function workspaceFolderRootsMatch(left: string, right: string): boolean {
  return left.replace(/\\/g, '/').toLowerCase() === right.replace(/\\/g, '/').toLowerCase()
}

/** 没有 folderRoot 的旧事件仍按当前树处理；有则只接受当前工作区。 */
export function shouldApplyWorkspaceFsChange(
  currentFolderRoot: string,
  payloadFolderRoot?: string
): boolean {
  if (!payloadFolderRoot) return true
  return workspaceFolderRootsMatch(currentFolderRoot, payloadFolderRoot)
}

export function collectTouchedDirPaths(relativePaths: Iterable<string>): string[] {
  const dirs = new Set<string>()
  for (const relativePath of relativePaths) {
    for (const dir of ancestorDirPaths(relativePath)) dirs.add(dir)
  }
  return [...dirs].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b))
}

export function resolveCreateParentDir(
  selectedPath: string | null,
  nodesByPath: Record<string, { relativePath: string; isDirectory: boolean }[]>,
  selectedIsDirectory: boolean
): string {
  if (!selectedPath) return ''
  if (selectedIsDirectory) return normalizeRelativePath(selectedPath)
  return parentRelativePath(selectedPath)
}

export function findNodeIsDirectory(
  relativePath: string,
  childrenByPath: Record<string, { relativePath: string; isDirectory: boolean }[]>
): boolean {
  const parent = parentRelativePath(relativePath)
  const siblings = childrenByPath[parent] ?? childrenByPath[''] ?? []
  return siblings.find((node) => node.relativePath === relativePath)?.isDirectory ?? false
}
