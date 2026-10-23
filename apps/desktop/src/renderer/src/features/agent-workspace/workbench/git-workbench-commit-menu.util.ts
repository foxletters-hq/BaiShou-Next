export type GitWorkbenchCommitMenuActionId =
  | 'commit'
  | 'commitStaged'
  | 'commitAll'
  | 'commitAndPush'
  | 'commitAllAndPush'

export interface GitWorkbenchCommitMenuHandlers {
  handleManualCommit: () => void
  handleCommitStaged: () => void
  handleCommitAll: () => void
  handleCommitAndPush: () => void
  handleCommitAllAndPush: () => void
}

export const GIT_WORKBENCH_COMMIT_MENU_ITEMS: readonly {
  id: GitWorkbenchCommitMenuActionId
  labelKey: string
  requiresStaged: boolean
  dividerBefore?: boolean
}[] = [
  {
    id: 'commit',
    labelKey: 'version_control.commit',
    requiresStaged: false
  },
  {
    id: 'commitStaged',
    labelKey: 'workbench.git_commit_staged',
    requiresStaged: true
  },
  {
    id: 'commitAll',
    labelKey: 'workbench.git_commit_all',
    requiresStaged: false
  },
  {
    id: 'commitAndPush',
    labelKey: 'version_control.commit_push',
    requiresStaged: false,
    dividerBefore: true
  },
  {
    id: 'commitAllAndPush',
    labelKey: 'workbench.git_commit_all_push',
    requiresStaged: false
  }
]

export function isGitWorkbenchCommitMenuActionEnabled(
  id: GitWorkbenchCommitMenuActionId,
  canCommit: boolean,
  canCommitStaged: boolean,
  inFlight: boolean
): boolean {
  if (inFlight) return false
  if (id === 'commitStaged') return canCommitStaged
  return canCommit
}

export function runGitWorkbenchCommitMenuAction(
  id: GitWorkbenchCommitMenuActionId,
  handlers: GitWorkbenchCommitMenuHandlers
): void {
  switch (id) {
    case 'commit':
      handlers.handleManualCommit()
      return
    case 'commitStaged':
      handlers.handleCommitStaged()
      return
    case 'commitAll':
      handlers.handleCommitAll()
      return
    case 'commitAndPush':
      handlers.handleCommitAndPush()
      return
    case 'commitAllAndPush':
      handlers.handleCommitAllAndPush()
  }
}
