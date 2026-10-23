export interface WorkspaceGitContext {
  folderRoot: string
  gitRoot: string
  scopePrefix: string
}

export interface WorkspaceGitBranchInfo {
  current: string
  branches: string[]
  hasRemote: boolean
  ahead: number
  behind: number
  remoteUrl?: string
}

export function normalizePosix(relativePath: string): string {
  return relativePath.replace(/\\/g, '/')
}

export function pathInScope(filePath: string, scopePrefix: string): boolean {
  const normalized = normalizePosix(filePath)
  if (!scopePrefix) return true
  return normalized === scopePrefix || normalized.startsWith(`${scopePrefix}/`)
}
