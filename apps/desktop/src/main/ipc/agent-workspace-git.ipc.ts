import { ipcMain } from 'electron'
import { getWorkspaceFolderGitService } from '../services/workspace-folder-git.registry'

function withGit<T>(
  folderRoot: string,
  fn: (svc: ReturnType<typeof getWorkspaceFolderGitService>) => Promise<T>
): Promise<T> {
  if (!folderRoot?.trim()) throw new Error('Workspace folder is required')
  return fn(getWorkspaceFolderGitService(folderRoot))
}

async function withGitResult(
  folderRoot: string,
  fn: (svc: ReturnType<typeof getWorkspaceFolderGitService>) => Promise<void>
): Promise<{ success: true } | { success: false; message: string }> {
  try {
    await withGit(folderRoot, fn)
    return { success: true }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : String(error) }
  }
}

export function registerAgentWorkspaceGitIPC(): void {
  ipcMain.handle('agent-workspace:git-is-initialized', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.isInitialized())
  )

  ipcMain.handle('agent-workspace:git-init', async (_, folderRoot: string) =>
    withGitResult(folderRoot, (svc) => svc.init())
  )

  ipcMain.handle('agent-workspace:git-get-status', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.getStatus())
  )

  ipcMain.handle(
    'agent-workspace:git-stage-file',
    async (_, folderRoot: string, filePath: string) =>
      withGitResult(folderRoot, (svc) => svc.stageFile(filePath))
  )

  ipcMain.handle('agent-workspace:git-stage-all', async (_, folderRoot: string) =>
    withGitResult(folderRoot, (svc) => svc.stageAll())
  )

  ipcMain.handle(
    'agent-workspace:git-unstage-file',
    async (_, folderRoot: string, filePath: string) => {
      await withGit(folderRoot, (svc) => svc.unstageFile(filePath))
      return { success: true }
    }
  )

  ipcMain.handle('agent-workspace:git-unstage-all', async (_, folderRoot: string) => {
    await withGit(folderRoot, (svc) => svc.unstageAll())
    return { success: true }
  })

  ipcMain.handle(
    'agent-workspace:git-discard-file',
    async (_, folderRoot: string, filePath: string) => {
      await withGit(folderRoot, (svc) => svc.discardFile(filePath))
      return { success: true }
    }
  )

  ipcMain.handle('agent-workspace:git-discard-all', async (_, folderRoot: string) => {
    await withGit(folderRoot, (svc) => svc.discardAllChanges())
    return { success: true }
  })

  ipcMain.handle(
    'agent-workspace:git-commit-staged',
    async (_, folderRoot: string, message: string) =>
      withGit(folderRoot, (svc) => svc.commitStaged(message))
  )

  ipcMain.handle('agent-workspace:git-commit-all', async (_, folderRoot: string, message: string) =>
    withGit(folderRoot, (svc) => svc.commitAll(message))
  )

  ipcMain.handle(
    'agent-workspace:git-get-history',
    async (_, folderRoot: string, filePath?: string | null, limit?: number, offset?: number) =>
      withGit(folderRoot, (svc) => svc.getHistory(filePath || undefined, limit, offset))
  )

  ipcMain.handle(
    'agent-workspace:git-get-history-count',
    async (_, folderRoot: string, filePath?: string | null) =>
      withGit(folderRoot, (svc) => svc.getHistoryCount(filePath || undefined))
  )

  ipcMain.handle(
    'agent-workspace:git-get-recent-pulls',
    async (_, folderRoot: string, limit?: number) =>
      withGit(folderRoot, (svc) => svc.getRecentPulls(limit))
  )

  ipcMain.handle(
    'agent-workspace:git-get-commit-changes',
    async (_, folderRoot: string, commitHash: string) =>
      withGit(folderRoot, (svc) => svc.getCommitChanges(commitHash))
  )

  ipcMain.handle(
    'agent-workspace:git-get-file-diff',
    async (_, folderRoot: string, filePath: string, commitHash?: string) =>
      withGit(folderRoot, (svc) => svc.getFileDiff(filePath, commitHash))
  )

  ipcMain.handle(
    'agent-workspace:git-get-working-diff',
    async (_, folderRoot: string, filePath: string, staged: boolean) =>
      withGit(folderRoot, (svc) => svc.getWorkingDiff(filePath, staged))
  )

  ipcMain.handle(
    'agent-workspace:git-get-head-file-content',
    async (_, folderRoot: string, filePath: string) =>
      withGit(folderRoot, (svc) => svc.getHeadFileContent(filePath))
  )

  ipcMain.handle(
    'agent-workspace:git-get-file-content-at-revision',
    async (_, folderRoot: string, filePath: string, revision: string) =>
      withGit(folderRoot, (svc) => svc.getFileContentAtRevision(filePath, revision))
  )

  ipcMain.handle('agent-workspace:git-has-conflicts', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.hasConflicts())
  )

  ipcMain.handle('agent-workspace:git-get-conflicts', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.getConflicts())
  )

  ipcMain.handle(
    'agent-workspace:git-resolve-conflict',
    async (_, folderRoot: string, filePath: string, resolution: 'ours' | 'theirs') =>
      withGit(folderRoot, (svc) => svc.resolveConflict(filePath, resolution))
  )

  ipcMain.handle(
    'agent-workspace:git-rollback-file',
    async (_, folderRoot: string, filePath: string, commitHash: string) =>
      withGit(folderRoot, (svc) => svc.rollbackFile(filePath, commitHash))
  )

  ipcMain.handle(
    'agent-workspace:git-rollback-all',
    async (_, folderRoot: string, commitHash: string) =>
      withGit(folderRoot, (svc) => svc.rollbackAll(commitHash))
  )

  ipcMain.handle(
    'agent-workspace:git-get-rollback-all-context',
    async (_, folderRoot: string, commitHash: string) =>
      withGit(folderRoot, (svc) => svc.getRollbackAllContext(commitHash))
  )

  ipcMain.handle('agent-workspace:git-push', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.push())
  )

  ipcMain.handle('agent-workspace:git-pull', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.pull())
  )

  ipcMain.handle('agent-workspace:git-get-branch-info', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.getBranchInfo())
  )

  ipcMain.handle(
    'agent-workspace:git-checkout-branch',
    async (_, folderRoot: string, branch: string) =>
      withGitResult(folderRoot, (svc) => svc.checkoutBranch(branch))
  )

  ipcMain.handle(
    'agent-workspace:git-create-branch',
    async (_, folderRoot: string, branch: string) =>
      withGitResult(folderRoot, (svc) => svc.createBranch(branch))
  )

  ipcMain.handle('agent-workspace:git-set-remote-url', async (_, folderRoot: string, url: string) =>
    withGitResult(folderRoot, (svc) => svc.setRemoteUrl(url))
  )

  ipcMain.handle('agent-workspace:git-get-config', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.getConfig())
  )

  ipcMain.handle(
    'agent-workspace:git-save-config',
    async (_, folderRoot: string, partial: unknown) =>
      withGitResult(folderRoot, (svc) =>
        svc.saveConfig(partial as Partial<import('@baishou/shared').GitSyncConfig>)
      )
  )

  ipcMain.handle('agent-workspace:git-test-remote', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.testRemote())
  )

  ipcMain.handle(
    'agent-workspace:git-merge-branch',
    async (_, folderRoot: string, branch: string) =>
      withGit(folderRoot, (svc) => svc.mergeBranch(branch))
  )

  ipcMain.handle(
    'agent-workspace:git-delete-branch',
    async (_, folderRoot: string, branch: string, force?: boolean) =>
      withGit(folderRoot, (svc) => svc.deleteBranch(branch, force))
  )

  ipcMain.handle(
    'agent-workspace:git-publish-branch',
    async (_, folderRoot: string, branch?: string) =>
      withGit(folderRoot, (svc) => svc.publishBranch(branch))
  )

  ipcMain.handle('agent-workspace:git-list-stash', async (_, folderRoot: string) =>
    withGit(folderRoot, (svc) => svc.listStash())
  )

  ipcMain.handle(
    'agent-workspace:git-stash-push',
    async (_, folderRoot: string, message?: string) =>
      withGit(folderRoot, (svc) => svc.stashPush(message))
  )

  ipcMain.handle('agent-workspace:git-stash-apply', async (_, folderRoot: string, index: number) =>
    withGit(folderRoot, (svc) => svc.stashApply(index))
  )

  ipcMain.handle('agent-workspace:git-stash-pop', async (_, folderRoot: string, index: number) =>
    withGit(folderRoot, (svc) => svc.stashPop(index))
  )

  ipcMain.handle('agent-workspace:git-stash-drop', async (_, folderRoot: string, index: number) =>
    withGit(folderRoot, (svc) => svc.stashDrop(index))
  )
}
