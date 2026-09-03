import { useCallback, useEffect, useState } from 'react'
import { useToast } from '@baishou/ui'
import { useTranslation } from 'react-i18next'
import { displayGitBranchName } from './workbench-git-branch.util'

export interface WorkbenchStatusGitMeta {
  branch?: string
  branches: string[]
  hasRemote: boolean
  ahead: number
  behind: number
}

const EMPTY_META: WorkbenchStatusGitMeta = {
  branches: [],
  hasRemote: false,
  ahead: 0,
  behind: 0
}

function countChanges(status: {
  staged: unknown[]
  unstaged: unknown[]
  untracked: unknown[]
  conflicted: unknown[]
}): number {
  return status.staged.length + status.unstaged.length + status.untracked.length + status.conflicted.length
}

export function useWorkbenchStatusGit(folderRoot: string | null) {
  const { t } = useTranslation()
  const toast = useToast()
  const [meta, setMeta] = useState<WorkbenchStatusGitMeta>(EMPTY_META)
  const [changesCount, setChangesCount] = useState(0)

  const refresh = useCallback(async () => {
    if (!folderRoot) {
      setMeta(EMPTY_META)
      setChangesCount(0)
      return
    }
    const git = window.api.agentWorkspace.git
    try {
      const initialized = await git.isInitialized(folderRoot)
      if (!initialized) {
        setMeta(EMPTY_META)
        setChangesCount(0)
        return
      }
      const [info, status] = await Promise.all([git.getBranchInfo(folderRoot), git.getStatus(folderRoot)])
      setMeta({
        branch: displayGitBranchName(info.current),
        branches: info.branches ?? [],
        hasRemote: Boolean(info.hasRemote),
        ahead: info.ahead ?? 0,
        behind: info.behind ?? 0
      })
      setChangesCount(countChanges(status))
    } catch {
      setMeta(EMPTY_META)
      setChangesCount(0)
    }
  }, [folderRoot])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const notify = useCallback(
    (result: { success: boolean; message?: string }, successKey: string, fallback: string) => {
      if (result.success) {
        toast.showSuccess(t(successKey, fallback))
        return true
      }
      toast.showError(result.message || t('common.error', '操作失败'))
      return false
    },
    [t, toast]
  )

  const checkout = useCallback(
    async (branch: string) => {
      if (!folderRoot) return
      const result = await window.api.agentWorkspace.git.checkoutBranch(folderRoot, branch)
      if (notify(result, 'workbench.git_checkout_success', '已切换分支')) {
        await refresh()
      }
    },
    [folderRoot, notify, refresh]
  )

  const createBranch = useCallback(
    async (branch: string) => {
      if (!folderRoot) return
      const name = branch.trim()
      if (!name) return
      const result = await window.api.agentWorkspace.git.createBranch(folderRoot, name)
      if (notify(result, 'workbench.git_create_branch_success', '已创建分支')) {
        await refresh()
      }
    },
    [folderRoot, notify, refresh]
  )

  const applyViewMeta = useCallback((next: { branch?: string; ahead: number; behind: number }) => {
    setMeta((prev) => ({
      ...prev,
      branch: next.branch,
      ahead: next.ahead,
      behind: next.behind
    }))
  }, [])

  const publish = useCallback(async () => {
    if (!folderRoot) return
    const result = await window.api.agentWorkspace.git.publishBranch(folderRoot)
    if (notify(result, 'workbench.git_publish_success', '已发布分支')) {
      await refresh()
    }
  }, [folderRoot, notify, refresh])

  return {
    meta,
    changesCount,
    applyViewMeta,
    setChangesCount,
    refresh,
    checkout,
    createBranch,
    publish
  }
}
