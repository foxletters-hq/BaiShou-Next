import { useCallback, useEffect, useMemo, useState } from 'react'
import { useToast } from '@baishou/ui'
import type { GitManagementPageProps } from '@baishou/ui'
import type { GitSyncConfig } from '@baishou/shared'
import { useTranslation } from 'react-i18next'

const DEFAULT_CONFIG: GitSyncConfig = { enabled: true }

export function useWorkbenchGitPanel(folderRoot: string | null): GitManagementPageProps | null {
  const { t } = useTranslation()
  const toast = useToast()
  const [isInitialized, setIsInitialized] = useState(false)
  const [config, setConfig] = useState<GitSyncConfig>(DEFAULT_CONFIG)

  const refreshInitialized = useCallback(async () => {
    if (!folderRoot) {
      setIsInitialized(false)
      return
    }
    try {
      const initialized = await window.api.agentWorkspace.git.isInitialized(folderRoot)
      setIsInitialized(initialized)
    } catch {
      setIsInitialized(false)
    }
  }, [folderRoot])

  const refreshConfig = useCallback(async () => {
    if (!folderRoot) {
      setConfig(DEFAULT_CONFIG)
      return
    }
    try {
      const next = await window.api.agentWorkspace.git.getConfig(folderRoot)
      setConfig(next)
    } catch {
      setConfig(DEFAULT_CONFIG)
    }
  }, [folderRoot])

  useEffect(() => {
    void refreshInitialized()
  }, [refreshInitialized])

  useEffect(() => {
    if (!folderRoot || !isInitialized) return
    void refreshConfig()
  }, [folderRoot, isInitialized, refreshConfig])

  return useMemo(() => {
    if (!folderRoot) return null
    const root = folderRoot
    const git = window.api.agentWorkspace.git

    return {
      config,
      isInitialized,
      onSaveConfig: async (partial: Partial<GitSyncConfig>) => {
        const result = await git.saveConfig(root, partial)
        if (result.success) {
          await refreshConfig()
        } else if (result.message) {
          toast.showError(result.message)
          throw new Error(result.message)
        }
      },
      onInit: async () => {
        const result = await git.init(root)
        if (result.success) {
          setIsInitialized(true)
          await refreshConfig()
          toast.showSuccess(t('version_control.init_success', 'Git 仓库已初始化'))
        } else if (result.message) {
          toast.showError(result.message)
        }
        return result
      },
      onTestRemote: () => git.testRemote(root),
      onCommit: (message) => git.commitStaged(root, message),
      onCommitAll: (message) => git.commitAll(root, message),
      onToast: (message, type) => {
        if (type === 'error') toast.showError(message)
        else if (type === 'success') toast.showSuccess(message)
        else if (type === 'warning') toast.showWarning(message)
        else toast.show(message)
      },
      onGetStatus: () => git.getStatus(root),
      onGetHistory: (filePath, limit) => git.getHistory(root, filePath, limit),
      onGetHistoryCount: async (filePath?) => {
        // 工作区 Git 暂无独立 count IPC：用较大 limit 近似总数
        const entries = await git.getHistory(root, filePath, 10_000)
        return entries.length
      },
      onGetRecentPulls: (limit) => git.getRecentPulls(root, limit),
      onGetCommitChanges: (hash) => git.getCommitChanges(root, hash),
      onGetFileDiff: (filePath, hash) => git.getFileDiff(root, filePath, hash),
      onGetWorkingDiff: (filePath, staged) => git.getWorkingDiff(root, filePath, staged),
      onStageFile: async (filePath) => {
        const result = await git.stageFile(root, filePath)
        if (!result.success) {
          throw new Error(result.message || t('version_control.stage_failed', '暂存失败'))
        }
      },
      onStageAll: async () => {
        const result = await git.stageAll(root)
        if (!result.success) {
          throw new Error(result.message || t('version_control.stage_failed', '暂存失败'))
        }
      },
      onUnstageFile: (filePath) => git.unstageFile(root, filePath).then(() => undefined),
      onUnstageAll: () => git.unstageAll(root).then(() => undefined),
      onDiscardFile: (filePath) => git.discardFile(root, filePath).then(() => undefined),
      onDiscardAllChanges: () => git.discardAllChanges(root).then(() => undefined),
      onPush: () => git.push(root),
      onPull: () => git.pull(root),
      onGetBranchInfo: () => git.getBranchInfo(root),
      onCheckoutBranch: (branch) => git.checkoutBranch(root, branch),
      onCreateBranch: (branch) => git.createBranch(root, branch),
      onSetRemoteUrl: (url) => git.setRemoteUrl(root, url),
      onMergeBranch: (branch) => git.mergeBranch(root, branch),
      onDeleteBranch: (branch, force) => git.deleteBranch(root, branch, force),
      onPublishBranch: (branch) => git.publishBranch(root, branch),
      onListStash: () => git.listStash(root),
      onStashPush: (message) => git.stashPush(root, message),
      onStashApply: (index) => git.stashApply(root, index),
      onStashPop: (index) => git.stashPop(root, index),
      onStashDrop: (index) => git.stashDrop(root, index),
      onHasConflicts: () => git.hasConflicts(root),
      onGetConflicts: () => git.getConflicts(root),
      onResolveConflict: (filePath, resolution) => git.resolveConflict(root, filePath, resolution),
      onRollbackFile: (filePath, hash) => git.rollbackFile(root, filePath, hash),
      onRollbackAll: (hash) => git.rollbackAll(root, hash),
      onGetRollbackAllContext: (hash) => git.getRollbackAllContext(root, hash)
    }
  }, [folderRoot, isInitialized, config, t, toast, refreshConfig])
}
