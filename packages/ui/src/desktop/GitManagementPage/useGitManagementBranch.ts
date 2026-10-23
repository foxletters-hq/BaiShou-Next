import i18n from 'i18next'
import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import type { GitManagementPageProps } from './git-management.types'

export function useGitManagementBranch(params: {
  t: TFunction
  onToast: GitManagementPageProps['onToast']
  onCheckoutBranch: GitManagementPageProps['onCheckoutBranch']
  onCreateBranch: GitManagementPageProps['onCreateBranch']
  onMergeBranch: GitManagementPageProps['onMergeBranch']
  onDeleteBranch: GitManagementPageProps['onDeleteBranch']
  onPublishBranch: GitManagementPageProps['onPublishBranch']
  onStashPush: GitManagementPageProps['onStashPush']
  onStashApply: GitManagementPageProps['onStashApply']
  onStashPop: GitManagementPageProps['onStashPop']
  onStashDrop: GitManagementPageProps['onStashDrop']
  handleRefreshStatus: () => Promise<void>
  handleLoadHistory: () => Promise<void>
}) {
  const {
    t,
    onToast,
    onCheckoutBranch,
    onCreateBranch,
    onMergeBranch,
    onDeleteBranch,
    onPublishBranch,
    onStashPush,
    onStashApply,
    onStashPop,
    onStashDrop,
    handleRefreshStatus,
    handleLoadHistory
  } = params

  const notifyGitResult = useCallback(
    (
      result: { success: boolean; message?: string },
      successKey: string,
      successFallback: string
    ) => {
      onToast(
        result.success
          ? t(successKey, successFallback)
          : result.message || t('common.error', '操作失败'),
        result.success ? 'success' : 'error'
      )
      return result.success
    },
    [onToast, t]
  )

  const handleCheckoutBranch = useCallback(
    async (branch: string) => {
      if (!onCheckoutBranch) return
      const result = await onCheckoutBranch(branch)
      if (
        notifyGitResult(
          result,
          'workbench.git_checkout_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L367',
            '已切换分支'
          )
        )
      ) {
        await handleRefreshStatus()
        await handleLoadHistory()
      }
    },
    [onCheckoutBranch, notifyGitResult, handleRefreshStatus, handleLoadHistory]
  )

  const handleCreateBranch = useCallback(
    async (branch: string) => {
      if (!onCreateBranch) return
      const name = branch.trim()
      if (!name) return
      const result = await onCreateBranch(name)
      if (
        notifyGitResult(
          result,
          'workbench.git_create_branch_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L381',
            '已创建分支'
          )
        )
      ) {
        await handleRefreshStatus()
      }
    },
    [onCreateBranch, notifyGitResult, handleRefreshStatus]
  )

  const handleMergeBranch = useCallback(
    async (branch: string) => {
      if (!onMergeBranch) return
      const name = branch.trim()
      if (!name) return
      const result = await onMergeBranch(name)
      if (
        notifyGitResult(
          result,
          'workbench.git_merge_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L394',
            '合并完成'
          )
        )
      ) {
        await handleRefreshStatus()
        await handleLoadHistory()
      }
    },
    [onMergeBranch, notifyGitResult, handleRefreshStatus, handleLoadHistory]
  )

  const handleDeleteBranch = useCallback(
    async (branch: string) => {
      if (!onDeleteBranch) return
      const result = await onDeleteBranch(branch)
      if (
        notifyGitResult(
          result,
          'workbench.git_delete_branch_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L406',
            '已删除分支'
          )
        )
      ) {
        await handleRefreshStatus()
      }
    },
    [onDeleteBranch, notifyGitResult, handleRefreshStatus]
  )

  const handlePublishBranch = useCallback(
    async (branch?: string) => {
      if (!onPublishBranch) return
      const result = await onPublishBranch(branch)
      if (
        notifyGitResult(
          result,
          'workbench.git_publish_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L417',
            '已发布分支'
          )
        )
      ) {
        await handleRefreshStatus()
      }
    },
    [onPublishBranch, notifyGitResult, handleRefreshStatus]
  )

  const handleStashPush = useCallback(
    async (message?: string) => {
      if (!onStashPush) return
      const result = await onStashPush(message)
      if (
        notifyGitResult(
          result,
          'workbench.git_stash_push_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L428',
            '已贮藏变更'
          )
        )
      ) {
        await handleRefreshStatus()
      }
    },
    [onStashPush, notifyGitResult, handleRefreshStatus]
  )

  const handleStashApply = useCallback(
    async (index: number) => {
      if (!onStashApply) return
      const result = await onStashApply(index)
      if (
        notifyGitResult(
          result,
          'workbench.git_stash_apply_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L439',
            '已应用贮藏'
          )
        )
      ) {
        await handleRefreshStatus()
      }
    },
    [onStashApply, notifyGitResult, handleRefreshStatus]
  )

  const handleStashPop = useCallback(
    async (index: number) => {
      if (!onStashPop) return
      const result = await onStashPop(index)
      if (
        notifyGitResult(
          result,
          'workbench.git_stash_pop_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L450',
            '已弹出贮藏'
          )
        )
      ) {
        await handleRefreshStatus()
      }
    },
    [onStashPop, notifyGitResult, handleRefreshStatus]
  )

  const handleStashDrop = useCallback(
    async (index: number) => {
      if (!onStashDrop) return
      const result = await onStashDrop(index)
      if (
        notifyGitResult(
          result,
          'workbench.git_stash_drop_success',
          i18n.t(
            'auto.packages.ui.src.desktop.GitManagementPage.useGitManagementPage.L461',
            '已删除贮藏'
          )
        )
      ) {
        await handleRefreshStatus()
      }
    },
    [onStashDrop, notifyGitResult, handleRefreshStatus]
  )

  return {
    handleCheckoutBranch,
    handleCreateBranch,
    handleMergeBranch,
    handleDeleteBranch,
    handlePublishBranch,
    handleStashPush,
    handleStashApply,
    handleStashPop,
    handleStashDrop
  }
}
