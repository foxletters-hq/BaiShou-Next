import { describe, expect, it, vi } from 'vitest'
import {
  GIT_WORKBENCH_COMMIT_MENU_ITEMS,
  isGitWorkbenchCommitMenuActionEnabled,
  runGitWorkbenchCommitMenuAction
} from '../git-workbench-commit-menu.util'

describe('git-workbench-commit-menu', () => {
  it('keeps the five commit actions in the agreed order', () => {
    expect(GIT_WORKBENCH_COMMIT_MENU_ITEMS.map((item) => item.id)).toEqual([
      'commit',
      'commitStaged',
      'commitAll',
      'commitAndPush',
      'commitAllAndPush'
    ])
  })

  it('routes each action to its dedicated handler', () => {
    const handlers = {
      handleManualCommit: vi.fn(),
      handleCommitStaged: vi.fn(),
      handleCommitAll: vi.fn(),
      handleCommitAndPush: vi.fn(),
      handleCommitAllAndPush: vi.fn()
    }

    runGitWorkbenchCommitMenuAction('commit', handlers)
    runGitWorkbenchCommitMenuAction('commitStaged', handlers)
    runGitWorkbenchCommitMenuAction('commitAll', handlers)
    runGitWorkbenchCommitMenuAction('commitAndPush', handlers)
    runGitWorkbenchCommitMenuAction('commitAllAndPush', handlers)

    expect(handlers.handleManualCommit).toHaveBeenCalledTimes(1)
    expect(handlers.handleCommitStaged).toHaveBeenCalledTimes(1)
    expect(handlers.handleCommitAll).toHaveBeenCalledTimes(1)
    expect(handlers.handleCommitAndPush).toHaveBeenCalledTimes(1)
    expect(handlers.handleCommitAllAndPush).toHaveBeenCalledTimes(1)
  })

  it('disables staged-only when nothing is staged, and disables all actions while in flight', () => {
    expect(isGitWorkbenchCommitMenuActionEnabled('commitStaged', true, false, false)).toBe(false)
    expect(isGitWorkbenchCommitMenuActionEnabled('commitStaged', true, true, false)).toBe(true)
    expect(isGitWorkbenchCommitMenuActionEnabled('commit', true, true, true)).toBe(false)
    expect(isGitWorkbenchCommitMenuActionEnabled('commitAllAndPush', true, true, true)).toBe(false)
  })
})
