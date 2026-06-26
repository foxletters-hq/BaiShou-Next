import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import { isDiskFullError } from '@baishou/shared'
import type { GitManagementPageProps } from './git-management.types'
import type { FileChange, FileDiff } from '@baishou/shared'

export interface UseGitManagementCommitParams {
  t: TFunction
  commitMessage: string
  setCommitMessage: (value: string) => void
  onCommitAll: GitManagementPageProps['onCommitAll']
  onPush: GitManagementPageProps['onPush']
  onToast: GitManagementPageProps['onToast']
  handleRefreshStatus: () => Promise<void>
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
    onCommitAll,
    onPush,
    onToast,
    handleRefreshStatus,
    handleLoadHistory,
    setSelectedCommit,
    setCommitChanges,
    setSelectedFileDiff
  } = params

  const performCommit = useCallback(async (msg: string) => onCommitAll(msg), [onCommitAll])

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
        '请先在「Git 提交签名」中填写用户名和邮箱后再提交'
      ),
      'error'
    )
  }, [onToast, t])

  const notifyCommitOutcome = useCallback(
    (fileCount: number, mode: 'local' | 'push') => {
      if (fileCount === 0) {
        onToast(
          t('version_control.commit_result_count', '已提交 {{count}} 个文件', { count: 0 }),
          'warning'
        )
        return
      }

      if (mode === 'push') {
        onToast(
          t(
            'version_control.commit_all_success_count_pushing',
            '已暂存并提交 {{count}} 个文件，正在推送...',
            { count: fileCount }
          ),
          'success'
        )
        return
      }

      onToast(
        t('version_control.commit_all_success_count', '已暂存并提交 {{count}} 个文件', {
          count: fileCount
        }),
        'success'
      )
    },
    [onToast, t]
  )

  const handleManualCommit = useCallback(async () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const msg = commitMessage.trim() || timestamp
    try {
      const result = await performCommit(msg)
      const fileCount = result?.files?.length ?? 0
      notifyCommitOutcome(fileCount, 'local')
      if (fileCount === 0) return

      setCommitMessage('')
      handleRefreshStatus()
      handleLoadHistory()
    } catch (e: any) {
      const errorMsg = e?.message || ''
      if (errorMsg.includes('No changes')) {
        notifyCommitOutcome(0, 'local')
      } else if (isAuthorNotConfiguredError(e)) {
        notifyAuthorNotConfigured()
      } else {
        onToast(formatGitErrorMessage(e) || t('version_control.git_commit_failed', '提交失败'), 'error')
      }
    }
  }, [
    commitMessage,
    performCommit,
    notifyCommitOutcome,
    isAuthorNotConfiguredError,
    notifyAuthorNotConfigured,
    formatGitErrorMessage,
    onToast,
    t,
    handleRefreshStatus,
    handleLoadHistory
  ])

  const handleCommitAndPush = useCallback(async () => {
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const timestamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const msg = commitMessage.trim() || timestamp
    try {
      const result = await performCommit(msg)
      const fileCount = result?.files?.length ?? 0
      if (fileCount === 0) {
        notifyCommitOutcome(0, 'push')
        return
      }

      notifyCommitOutcome(fileCount, 'push')
      setCommitMessage('')
      setSelectedCommit(null)
      setCommitChanges([])
      setSelectedFileDiff(null)
      handleRefreshStatus()
      handleLoadHistory()
      const pushResult = await onPush()
      onToast(
        pushResult.success
          ? t('version_control.push_success', '推送成功')
          : isDiskFullError(pushResult.message || '')
            ? t(
                'settings.error_disk_full',
                '磁盘空间不足，请清理空间后重试。Git 同步与数据导出都需要足够的可用磁盘空间。'
              )
            : pushResult.message || t('version_control.git_push_failed', '推送失败'),
        pushResult.success ? 'success' : 'error'
      )
    } catch (e: any) {
      const errorMsg = e?.message || ''
      if (errorMsg.includes('No changes')) {
        notifyCommitOutcome(0, 'push')
      } else if (isAuthorNotConfiguredError(e)) {
        notifyAuthorNotConfigured()
      } else {
        onToast(formatGitErrorMessage(e) || t('version_control.git_commit_failed', '提交失败'), 'error')
      }
    }
  }, [
    commitMessage,
    performCommit,
    notifyCommitOutcome,
    isAuthorNotConfiguredError,
    notifyAuthorNotConfigured,
    formatGitErrorMessage,
    onPush,
    onToast,
    t,
    handleRefreshStatus,
    handleLoadHistory
  ])

  return { handleManualCommit, handleCommitAndPush }
}
