export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/$/, '')
}

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
