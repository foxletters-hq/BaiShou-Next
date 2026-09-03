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
  labelFallback: string
  requiresStaged: boolean
  dividerBefore?: boolean
}[] = [
  {
    id: 'commit',
    labelKey: 'version_control.commit',
    labelFallback: '提交',
    requiresStaged: false
  },
  {
    id: 'commitStaged',
    labelKey: 'workbench.git_commit_staged',
    labelFallback: '提交（仅暂存）',
    requiresStaged: true
  },
  {
    id: 'commitAll',
    labelKey: 'workbench.git_commit_all',
    labelFallback: '全部提交',
    requiresStaged: false
  },
  {
    id: 'commitAndPush',
    labelKey: 'version_control.commit_push',
    labelFallback: '提交并推送',
    requiresStaged: false,
    dividerBefore: true
  },
  {
    id: 'commitAllAndPush',
    labelKey: 'workbench.git_commit_all_push',
    labelFallback: '全部提交并推送',
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
