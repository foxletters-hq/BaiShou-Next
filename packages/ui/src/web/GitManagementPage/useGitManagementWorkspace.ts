import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import { isTextDiffablePath } from '@baishou/shared'
import type { GitManagementPageProps } from './git-management.types'
import type { FileChange, FileDiff } from '@baishou/shared'

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
    handleRefreshStatus
  } = params

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
    [expandedCommit, onGetCommitChanges]
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
    [onGetFileDiff, selectedCommit, expandedFile]
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
    [onGetWorkingDiff, expandedWorkingFile]
  )

  const handleStageFile = useCallback(
    async (filePath: string) => {
      await onStageFile(filePath)
      handleRefreshStatus()
    },
    [onStageFile, handleRefreshStatus]
  )

  const handleStageAll = useCallback(async () => {
    await onStageAll()
    handleRefreshStatus()
  }, [onStageAll, handleRefreshStatus])

  const handleUnstageFile = useCallback(
    async (filePath: string) => {
      await onUnstageFile(filePath)
      handleRefreshStatus()
    },
    [onUnstageFile, handleRefreshStatus]
  )

  const handleUnstageAll = useCallback(async () => {
    try {
      await onUnstageAll()
      handleRefreshStatus()
    } catch (e: any) {
      onToast(e?.message || t('common.error', '操作失败'), 'error')
    }
  }, [onUnstageAll, handleRefreshStatus, onToast, t])

  const handleDiscardFile = useCallback(
    async (filePath: string) => {
      await onDiscardFile(filePath)
      handleRefreshStatus()
    },
    [onDiscardFile, handleRefreshStatus]
  )

  const handleDiscardAll = useCallback(async () => {
    await onDiscardAllChanges()
    handleRefreshStatus()
  }, [onDiscardAllChanges, handleRefreshStatus])

  const handleRollback = useCallback(
    async (filePath: string) => {
      if (!selectedCommit) return
      const result = await onRollbackFile(filePath, selectedCommit)
      onToast(
        result.success
          ? t('version_control.rollback_success', '回滚成功')
          : t('version_control.git_rollback_failed', '回滚失败'),
        result.success ? 'success' : 'error'
      )
    },
    [selectedCommit, onRollbackFile, onToast, t]
  )

  const handleRollbackAll = useCallback(
    async (commitHash: string) => {
      const result = await onRollbackAll(commitHash)
      onToast(
        result.success
          ? t('version_control.rollback_success', '回滚成功')
          : t('version_control.git_rollback_failed', '回滚失败'),
        result.success ? 'success' : 'error'
      )
    },
    [onRollbackAll, onToast, t]
  )

  const getFileStatusIcon = (status: string) => {
    switch (status) {
      case 'added':
        return 'A'
      case 'deleted':
        return 'D'
      case 'renamed':
        return 'R'
      default:
        return 'M'
    }
  }
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
    handleRollback,
    handleRollbackAll
  }
}
