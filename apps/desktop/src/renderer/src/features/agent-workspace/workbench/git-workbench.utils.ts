export function getRepositoryDisplayName(folderRoot: string): string {
  const normalized = folderRoot.replace(/\\/g, '/').replace(/\/+$/, '')
  const segments = normalized.split('/')
  return segments[segments.length - 1] || folderRoot
}

export function getFileStatusIcon(status: string): string {
  switch (status) {
    case 'added':
      return 'A'
    case 'deleted':
      return 'D'
    case 'renamed':
      return 'R'
    case 'untracked':
      return 'U'
    default:
      return 'M'
  }
}

/** 变更列表：文件名在前，目录用次要色跟在后面。 */
export function splitGitDisplayPath(filePath: string): { name: string; dir: string } {
  const normalized = filePath.replace(/\\/g, '/').replace(/\/+$/, '')
  const idx = normalized.lastIndexOf('/')
  if (idx <= 0) return { name: normalized || filePath, dir: '' }
  return {
    name: normalized.slice(idx + 1),
    dir: normalized.slice(0, idx)
  }
}
