export function countWorkspaceGitChanges(
  status: {
    staged: unknown[]
    unstaged: unknown[]
    untracked: unknown[]
  } | null
): number | null {
  return status ? status.staged.length + status.unstaged.length + status.untracked.length : null
}

export function collectExtraRollbackPaths(
  attributed: Iterable<string>,
  changed: Iterable<string>,
  diffAvailable: boolean
): string[] {
  if (!diffAvailable) return []
  const attributedSet = attributed instanceof Set ? attributed : new Set(attributed)
  return [...changed].filter((path) => !attributedSet.has(path)).sort()
}
