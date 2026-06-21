import { useCallback, useState } from 'react'
import type { TFunction } from 'i18next'
import { isTextDiffablePath } from '@baishou/shared'
import type { GitManagementPageProps } from './git-management.types'
import type { FileChange, FileDiff } from '@baishou/shared'
import type { GitDestructiveConfirmRequest } from './GitDestructiveConfirmDialog'

export interface UseGitManagementWorkspaceParams {
  t: TFunction
  onToast: GitManagementPageProps['onToast']
  onGetCommitChanges: GitManagementPageProps['onGetCommitChanges']
  onGetFileDiff: GitManagementPageProps['onGetFileDiff']
  onGetWorkingDiff: GitManagementPageProps['onGetWorkingDiff']
  onStageFile: GitManagementPageProps['onStageFile']
  onStageAll: GitManagementPageProps['onStageAll']
  onUnstageFile: GitManagementPageProps['onUnstageFile']
  onUnstageAll: GitManagementPageProps['onUnstageAll']
  onDiscardFile: GitManagementPageProps['onDiscardFile']
  onDiscardAllChanges: GitManagementPageProps['onDiscardAllChanges']
  onRollbackFile: GitManagementPageProps['onRollbackFile']
  onRollbackAll: GitManagementPageProps['onRollbackAll']
  onGetRollbackAllContext: GitManagementPageProps['onGetRollbackAllContext']
  expandedCommit: string | null
  setExpandedCommit: (value: string | null) => void
  setSelectedCommit: (value: string | null) => void
  setCommitChanges: (value: FileChange[]) => void
  setSelectedFileDiff: (value: FileDiff | null) => void
  selectedCommit: string | null
  expandedFile: string | null
  setExpandedFile: (value: string | null) => void
  expandedWorkingFile: { path: string; staged: boolean } | null
  setExpandedWorkingFile: (value: { path: string; staged: boolean } | null) => void
  setWorkingFileDiff: (value: FileDiff | null) => void
  handleRefreshStatus: () => Promise<void>
  handleLoadHistory: () => Promise<void>
}

export function useGitManagementWorkspace(params: UseGitManagementWorkspaceParams) {
  const {
    t,
    onToast,
    onGetCommitChanges,
    onGetFileDiff,
    onGetWorkingDiff,
    onStageFile,
    onStageAll,
    onUnstageFile,
    onUnstageAll,
    onDiscardFile,
    onDiscardAllChanges,
    onRollbackFile,
    onRollbackAll,
    onGetRollbackAllContext,
    expandedCommit,
    setExpandedCommit,
    setSelectedCommit,
    setCommitChanges,
    setSelectedFileDiff,
    selectedCommit,
    expandedFile,
    setExpandedFile,
    expandedWorkingFile,
    setExpandedWorkingFile,
    setWorkingFileDiff,
    handleRefreshStatus,
    handleLoadHistory
  } = params

  const [destructiveConfirm, setDestructiveConfirm] =
    useState<GitDestructiveConfirmRequest>(null)
  const [isConfirmingDestructive, setIsConfirmingDestructive] = useState(false)

  const handleSelectCommit = useCallback(
    async (hash: string) => {
      if (expandedCommit === hash) {
        setExpandedCommit(null)
        setCommitChanges([])
        setSelectedFileDiff(null)
        return
      }
      setExpandedCommit(hash)
      setSelectedCommit(hash)
      const changes = await onGetCommitChanges(hash)
      setCommitChanges(changes)
      setSelectedFileDiff(null)
    },
    [expandedCommit, onGetCommitChanges, setExpandedCommit, setSelectedCommit, setCommitChanges, setSelectedFileDiff]
  )

  const handleViewDiff = useCallback(
    async (filePath: string) => {
      if (!isTextDiffablePath(filePath)) return
      if (expandedFile === filePath) {
        setExpandedFile(null)
        setSelectedFileDiff(null)
        return
      }
      setExpandedFile(filePath)
      const diff = await onGetFileDiff(filePath, selectedCommit || undefined)
      setSelectedFileDiff(diff)
    },
    [onGetFileDiff, selectedCommit, expandedFile, setExpandedFile, setSelectedFileDiff]
  )

  const handleViewWorkingDiff = useCallback(
    async (filePath: string, staged: boolean) => {
      if (!isTextDiffablePath(filePath)) return
      if (expandedWorkingFile?.path === filePath && expandedWorkingFile.staged === staged) {
        setExpandedWorkingFile(null)
        setWorkingFileDiff(null)
        return
      }
      setExpandedWorkingFile({ path: filePath, staged })
      const diff = await onGetWorkingDiff(filePath, staged)
      setWorkingFileDiff(diff)
    },
    [onGetWorkingDiff, expandedWorkingFile, setExpandedWorkingFile, setWorkingFileDiff]
  )

  const handleStageFile = useCallback(
    async (filePath: string) => {
      try {
        await onStageFile(filePath)
        await handleRefreshStatus()
      } catch (e: any) {
        onToast(e?.message || t('common.error', '操作失败'), 'error')
      }
    },
    [onStageFile, handleRefreshStatus, onToast, t]
  )

  const handleStageAll = useCallback(async () => {
    try {
      await onStageAll()
      await handleRefreshStatus()
    } catch (e: any) {
      onToast(e?.message || t('common.error', '操作失败'), 'error')
    }
  }, [onStageAll, handleRefreshStatus, onToast, t])

  const handleUnstageFile = useCallback(
    async (filePath: string) => {
      await onUnstageFile(filePath)
      await handleRefreshStatus()
    },
    [onUnstageFile, handleRefreshStatus]
  )

  const handleUnstageAll = useCallback(async () => {
    try {
      await onUnstageAll()
      await handleRefreshStatus()
    } catch (e: any) {
      onToast(e?.message || t('common.error', '操作失败'), 'error')
    }
  }, [onUnstageAll, handleRefreshStatus, onToast, t])

  const handleDiscardFile = useCallback((filePath: string, options?: { untracked?: boolean }) => {
    setDestructiveConfirm({ type: 'discard-file', path: filePath, untracked: options?.untracked })
  }, [])

  const handleDiscardAll = useCallback(() => {
    setDestructiveConfirm({ type: 'discard-all' })
  }, [])

  const confirmDestructiveAction = useCallback(async () => {
    if (!destructiveConfirm || isConfirmingDestructive) return
    setIsConfirmingDestructive(true)
    try {
      if (destructiveConfirm.type === 'discard-file') {
        await onDiscardFile(destructiveConfirm.path)
        await handleRefreshStatus()
      } else if (destructiveConfirm.type === 'discard-all') {
        await onDiscardAllChanges()
        await handleRefreshStatus()
      } else if (destructiveConfirm.type === 'rollback') {
        const result = await onRollbackAll(destructiveConfirm.hash)
        onToast(
          result.success
            ? t('version_control.rollback_success', '回滚成功')
            : t('version_control.git_rollback_failed', '回滚失败'),
          result.success ? 'success' : 'error'
        )
        if (result.success) {
          await handleRefreshStatus()
          await handleLoadHistory()
        }
      } else if (destructiveConfirm.type === 'rollback-file') {
        const result = await onRollbackFile(destructiveConfirm.path, destructiveConfirm.hash)
        onToast(
          result.success
            ? t('version_control.rollback_success', '回滚成功')
            : t('version_control.git_rollback_failed', '回滚失败'),
          result.success ? 'success' : 'error'
        )
        if (result.success) {
          await handleRefreshStatus()
          await handleLoadHistory()
        }
      }
    } catch (e: any) {
      onToast(e?.message || t('common.error', '操作失败'), 'error')
    } finally {
      setIsConfirmingDestructive(false)
      setDestructiveConfirm(null)
    }
  }, [
    destructiveConfirm,
    isConfirmingDestructive,
    onDiscardFile,
    onDiscardAllChanges,
    onRollbackAll,
    onRollbackFile,
    handleRefreshStatus,
    handleLoadHistory,
    onToast,
    t
  ])

  const cancelDestructiveAction = useCallback(() => {
    if (isConfirmingDestructive) return
    setDestructiveConfirm(null)
  }, [isConfirmingDestructive])

  const handleRollback = useCallback(
    (filePath: string) => {
      if (!selectedCommit) return
      setDestructiveConfirm({
        type: 'rollback-file',
        path: filePath,
        hash: selectedCommit
      })
    },
    [selectedCommit]
  )

  const handleRollbackAll = useCallback(
    async (commitHash: string, message?: string) => {
      try {
        const context = await onGetRollbackAllContext(commitHash)
        setDestructiveConfirm({ type: 'rollback', hash: commitHash, message, context })
      } catch {
        setDestructiveConfirm({ type: 'rollback', hash: commitHash, message })
      }
    },
    [onGetRollbackAllContext]
  )

  return {
    handleSelectCommit,
    handleViewDiff,
    handleViewWorkingDiff,
    handleStageFile,
    handleStageAll,
    handleUnstageFile,
    handleUnstageAll,
    handleDiscardFile,
    handleDiscardAll,
    destructiveConfirm,
    isConfirmingDestructive,
    confirmDestructiveAction,
    cancelDestructiveAction,
    handleRollback,
    handleRollbackAll
  }
}
