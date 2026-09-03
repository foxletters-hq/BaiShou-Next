import { useCallback, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { isDiskFullError } from '@baishou/shared'
import type { GitManagementPageProps } from './git-management.types'
import type { FileChange, FileDiff } from '@baishou/shared'
import {
  executeGitCommit,
  resolveCommitSuccessToast,
  shouldPushAfterCommit,
  type GitCommitScope
} from './git-management-commit.util'

export interface UseGitManagementCommitParams {
  t: TFunction
  commitMessage: string
  setCommitMessage: (value: string) => void
  onCommit: GitManagementPageProps['onCommit']
  onCommitAll: GitManagementPageProps['onCommitAll']
  stagedCount: number
  onPush: GitManagementPageProps['onPush']
  onToast: GitManagementPageProps['onToast']
  isRemoteConfigured: () => boolean
  notifyRemoteRequired: () => void
  handleRefreshStatus: (options?: { fetch?: boolean }) => Promise<void>
  handleLoadHistory: () => Promise<void>
  setSelectedCommit: (value: string | null) => void
  setCommitChanges: (value: FileChange[]) => void
  setSelectedFileDiff: (value: FileDiff | null) => void
}

export function useGitManagementCommit(params: UseGitManagementCommitParams) {
  const {
    t,
    commitMessage,
    setCommitMessage,
    onCommit,
    onCommitAll,
    stagedCount,
    onPush,
    onToast,
    isRemoteConfigured,
    notifyRemoteRequired,
    handleRefreshStatus,
    handleLoadHistory,
    setSelectedCommit,
    setCommitChanges,
    setSelectedFileDiff
  } = params

  const inFlightRef = useRef(false)
  const [isCommitActionInFlight, setIsCommitActionInFlight] = useState(false)

  const formatGitErrorMessage = useCallback(
    (error: unknown) => {
      const message = (error as { message?: string })?.message || ''
      if (isDiskFullError(message)) {
        return t(
          'settings.error_disk_full',
          '磁盘空间不足，请清理空间后重试。Git 同步与数据导出都需要足够的可用磁盘空间。'
        )
      }
      return message
    },
    [t]
  )

  const isAuthorNotConfiguredError = useCallback((error: unknown) => {
    const e = error as { name?: string; message?: string; cause?: { message?: string } }
    const message = `${e?.message ?? ''} ${e?.cause?.message ?? ''}`.toLowerCase()
    return (
      e?.name === 'GitConfigError' ||
      message.includes('author identity') ||
      message.includes('user.name') ||
      message.includes('user.email') ||
      message.includes('tell me who you are')
    )
  }, [])

  const notifyAuthorNotConfigured = useCallback(() => {
    onToast(
      t(
        'version_control.author_not_configured',
        '请先在配置中填写用户名和邮箱后再提交'
      ),
      'error'
    )
  }, [onToast, t])

  const notifyCommitFailure = useCallback(() => {
    onToast(
      t('version_control.commit_result_count', '已提交 {{count}} 个文件', { count: 0 }),
      'warning'
    )
  }, [onToast, t])

  const notifyCommitSuccess = useCallback(
    (fileCount: number, mode: 'local' | 'push', scope: GitCommitScope) => {
      const toast = resolveCommitSuccessToast({
        fileCount,
        mode,
        scope,
        stagedCount
      })
      onToast(t(toast.key, toast.fallback, toast.interpolation), 'success')
    },
    [onToast, t, stagedCount]
  )

  const notifyPushFailure = useCallback(
    (error: unknown) => {
      const message =
        typeof error === 'string'
          ? error
          : formatGitErrorMessage(error) || t('version_control.git_push_failed', '推送失败')
      onToast(
        isDiskFullError(message)
          ? t(
              'settings.error_disk_full',
              '磁盘空间不足，请清理空间后重试。Git 同步与数据导出都需要足够的可用磁盘空间。'
            )
          : message || t('version_control.git_push_failed', '推送失败'),
        'error'
      )
    },
    [formatGitErrorMessage, onToast, t]
  )

  const runCommit = useCallback(
    (scope: GitCommitScope) =>
      executeGitCommit({
        scope,
        stagedCount,
        message: commitMessage,
        onCommit,
        onCommitAll
      }),
    [stagedCount, commitMessage, onCommit, onCommitAll]
  )

  const refreshAfterCommit = useCallback(async () => {
    setCommitMessage('')
    await handleRefreshStatus()
    await handleLoadHistory()
  }, [setCommitMessage, handleRefreshStatus, handleLoadHistory])

  const handleCommitError = useCallback(
    (error: unknown) => {
      const errorMsg = (error as { message?: string })?.message || ''
      if (errorMsg.includes('No changes')) {
        notifyCommitFailure()
      } else if (isAuthorNotConfiguredError(error)) {
        notifyAuthorNotConfigured()
      } else {
        onToast(
          formatGitErrorMessage(error) || t('version_control.git_commit_failed', '提交失败'),
          'error'
        )
      }
    },
    [
      notifyCommitFailure,
      isAuthorNotConfiguredError,
      notifyAuthorNotConfigured,
      formatGitErrorMessage,
      onToast,
      t
    ]
  )

  const runLocalCommit = useCallback(
    async (scope: GitCommitScope) => {
      try {
        const outcome = await runCommit(scope)
        if (!outcome.ok) {
          notifyCommitFailure()
          return false
        }
        notifyCommitSuccess(outcome.fileCount, 'local', scope)
        await refreshAfterCommit()
        return true
      } catch (error) {
        handleCommitError(error)
        return false
      }
    },
    [runCommit, notifyCommitFailure, notifyCommitSuccess, refreshAfterCommit, handleCommitError]
  )

  const runCommitThenPush = useCallback(
    async (scope: GitCommitScope) => {
      let outcome: { ok: boolean; fileCount: number }
      try {
        outcome = await runCommit(scope)
      } catch (error) {
        handleCommitError(error)
        return
      }

      if (!shouldPushAfterCommit(outcome.ok)) {
        notifyCommitFailure()
        return
      }

      setSelectedCommit(null)
      setCommitChanges([])
      setSelectedFileDiff(null)
      try {
        await refreshAfterCommit()
      } catch {
        // 本地提交已成功，刷新失败不阻断后续推送
      }

      if (!isRemoteConfigured()) {
        notifyCommitSuccess(outcome.fileCount, 'local', scope)
        notifyRemoteRequired()
        return
      }

      notifyCommitSuccess(outcome.fileCount, 'push', scope)
      try {
        const pushResult = await onPush()
        if (pushResult.success) {
          onToast(t('version_control.push_success', '推送成功'), 'success')
          await handleRefreshStatus({ fetch: true })
          await handleLoadHistory()
          return
        }
        notifyPushFailure(pushResult.message || t('version_control.git_push_failed', '推送失败'))
      } catch (error) {
        notifyPushFailure(error)
      }
    },
    [
      runCommit,
      handleCommitError,
      notifyCommitFailure,
      notifyCommitSuccess,
      refreshAfterCommit,
      isRemoteConfigured,
      notifyRemoteRequired,
      onPush,
      onToast,
      t,
      handleRefreshStatus,
      handleLoadHistory,
      setSelectedCommit,
      setCommitChanges,
      setSelectedFileDiff,
      notifyPushFailure
    ]
  )

  const runExclusive = useCallback(async (task: () => Promise<void>) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    setIsCommitActionInFlight(true)
    try {
      await task()
    } finally {
      inFlightRef.current = false
      setIsCommitActionInFlight(false)
    }
  }, [])

  const handleManualCommit = useCallback(
    () => runExclusive(async () => { await runLocalCommit('smart') }),
    [runExclusive, runLocalCommit]
  )

  const handleCommitStaged = useCallback(
    () => runExclusive(async () => { await runLocalCommit('staged') }),
    [runExclusive, runLocalCommit]
  )

  const handleCommitAll = useCallback(
    () => runExclusive(async () => { await runLocalCommit('all') }),
    [runExclusive, runLocalCommit]
  )

  const handleCommitAndPush = useCallback(
    () => runExclusive(async () => runCommitThenPush('smart')),
    [runExclusive, runCommitThenPush]
  )

  const handleCommitAllAndPush = useCallback(
    () => runExclusive(async () => runCommitThenPush('all')),
    [runExclusive, runCommitThenPush]
  )

  return {
    isCommitActionInFlight,
    handleManualCommit,
    handleCommitStaged,
    handleCommitAll,
    handleCommitAndPush,
    handleCommitAllAndPush
  }
}
