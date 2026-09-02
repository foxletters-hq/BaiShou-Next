import { buildKnowledgeMountPromptLines, parseMountedNotebookIds } from '@baishou/shared'

export interface WorkspaceEnvInfo {
  folderRoot: string
  platform: string
  isGitRepo?: boolean
  gitBranch?: string | null
  gitChangesCount?: number | null
  notebookIds?: string[] | null
  notebookNames?: Record<string, string>
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
  lines.push(
    ...buildKnowledgeMountPromptLines({
      notebookIds: parseMountedNotebookIds(env.notebookIds),
      notebookNames: env.notebookNames
    })
  )
  lines.push('Only use workspace_* tools to read/write files inside this folder.')
  lines.push(
    'When the user must choose or confirm (create files, pick a folder name, proceed or stop), call companion_ask. Do not ask that question in plain chat text.'
  )
  return lines
}
