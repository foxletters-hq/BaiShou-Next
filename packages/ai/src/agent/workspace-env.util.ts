export interface WorkspaceEnvInfo {
  folderRoot: string
  platform: string
  isGitRepo?: boolean
  gitBranch?: string | null
  gitChangesCount?: number | null
  notebookId?: string | null
}

/** Build lines for <workspace_env> system prompt section. */
export function buildWorkspaceEnvLines(env: WorkspaceEnvInfo): string[] {
  const lines: string[] = [
    `Working directory: ${env.folderRoot}`,
    `Workspace root folder: ${env.folderRoot}`,
    `Platform: ${env.platform}`,
    `Is git repo: ${env.isGitRepo ? 'yes' : 'no'}`
  ]
  if (env.isGitRepo) {
    if (env.gitBranch) lines.push(`Git branch: ${env.gitBranch}`)
    if (typeof env.gitChangesCount === 'number') {
      lines.push(`Git changes count: ${env.gitChangesCount}`)
    }
  }
  if (env.notebookId?.trim()) {
    lines.push(
      `Mounted knowledge notebookId: ${env.notebookId.trim()} (use knowledge_search for retrieval).`
    )
  } else {
    lines.push(
      'No knowledge notebook mounted; knowledge_search requires mounting first (do not invent notebookId).'
    )
  }
  lines.push('Only use workspace_* tools to read/write files inside this folder.')
  return lines
}
