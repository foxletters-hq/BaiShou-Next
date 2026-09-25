import { buildKnowledgeMountPromptLines, parseMountedNotebookIds } from '@baishou/shared'

export interface WorkspaceEnvInfo {
  folderRoot: string
  platform: string
  commandRuntimeBinary?: string
  commandRuntimeFamily?: string
  commandRuntimeLabel?: string
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
    ...(env.commandRuntimeLabel
      ? [
          `Command environment: ${env.commandRuntimeLabel}`,
          env.commandRuntimeFamily ? `Command environment family: ${env.commandRuntimeFamily}` : '',
          'workspace_run already starts this environment. Write the inner command only; do not prefix cmd /c, powershell -Command, or bash -c.'
        ].filter(Boolean)
      : []),
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
    'When the user must choose or confirm (create files, pick a folder name, proceed or stop), call companion_ask. Related choices that share one decision go in one question with options. Independent questions that can be decided together MUST go in the questions array of the same companion_ask call so the user answers them on one card. Do not ask those questions in plain chat text, and do not ask a follow-up that could have been on the first card. If companion_ask reports that the user cancelled this operation, ask in plain chat what they want to do next; do not call companion_ask again for the same choice.'
  )
  return lines
}
