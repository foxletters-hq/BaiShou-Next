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
    default:
      return 'M'
  }
}
