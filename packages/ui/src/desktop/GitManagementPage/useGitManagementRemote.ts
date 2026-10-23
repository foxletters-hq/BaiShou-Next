import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import type { GitRemoteStatus } from '@baishou/shared'
import type { GitManagementPageProps } from './git-management.types'

export function useGitManagementRemote(params: {
  t: TFunction
  remoteUrl: string
  remoteBranch: string
  remoteUsername: string
  remoteToken: string
  userName: string
  userEmail: string
  remoteStatus: GitRemoteStatus | null
  onSaveConfig: GitManagementPageProps['onSaveConfig']
  onTestRemote: GitManagementPageProps['onTestRemote']
  onPush: GitManagementPageProps['onPush']
  onPull: GitManagementPageProps['onPull']
  onSyncRemote: GitManagementPageProps['onSyncRemote']
  onToast: GitManagementPageProps['onToast']
  setConflicts: (value: string[]) => void
  setIsSyncingRemote: (value: boolean) => void
  handleRefreshStatus: (options?: { fetch?: boolean }) => Promise<void>
  handleLoadHistory: () => Promise<void>
}) {
  const {
    t,
    remoteUrl,
    remoteBranch,
    remoteUsername,
    remoteToken,
    userName,
    userEmail,
    remoteStatus,
    onSaveConfig,
    onTestRemote,
    onPush,
    onPull,
    onSyncRemote,
    onToast,
    setConflicts,
    setIsSyncingRemote,
    handleRefreshStatus,
    handleLoadHistory
  } = params

  const handleSaveAuthorConfig = useCallback(async () => {
    try {
      onSaveConfig({
        userName: userName || undefined,
        userEmail: userEmail || undefined
      })
      onToast(t('common.save_success', '保存成功'), 'success')
    } catch (e: any) {
      onToast(e?.message || t('common.error', '保存失败'), 'error')
    }
  }, [userName, userEmail, onSaveConfig, onToast, t])

  const handleSaveRemoteConfig = useCallback(async () => {
    try {
      onSaveConfig({
        remote: remoteUrl
          ? {
              url: remoteUrl,
              branch: remoteBranch,
              username: remoteUsername || undefined,
              token: remoteToken || undefined
            }
          : undefined
      })
      onToast(t('common.save_success', '保存成功'), 'success')
      await handleRefreshStatus({ fetch: true })
    } catch (e: any) {
      onToast(e?.message || t('common.error', '保存失败'), 'error')
    }
  }, [
    remoteUrl,
    remoteBranch,
    remoteUsername,
    remoteToken,
    onSaveConfig,
    onToast,
    t,
    handleRefreshStatus
  ])

  const handleTestRemote = useCallback(async () => {
    const ok = await onTestRemote()
    onToast(
      ok
        ? t('version_control.connection_success', '连接成功')
        : t('version_control.connection_failed', '连接失败'),
      ok ? 'success' : 'error'
    )
  }, [onTestRemote, onToast, t])

  const isRemoteConfigured = useCallback(
    () => Boolean(remoteStatus?.configured || remoteUrl.trim()),
    [remoteStatus, remoteUrl]
  )

  const notifyRemoteRequired = useCallback(() => {
    onToast(t('version_control.sync_requires_remote', '尚未配置远程仓库'), 'warning')
  }, [onToast, t])

  const handlePush = useCallback(async () => {
    if (!isRemoteConfigured()) {
      notifyRemoteRequired()
      return
    }
    const result = await onPush()
    onToast(
      result.success
        ? t('version_control.push_success', '推送成功')
        : result.message || t('version_control.git_push_failed', '推送失败'),
      result.success ? 'success' : 'error'
    )
    if (result.success) {
      await handleRefreshStatus({ fetch: true })
      await handleLoadHistory()
    }
  }, [
    isRemoteConfigured,
    notifyRemoteRequired,
    onPush,
    onToast,
    t,
    handleRefreshStatus,
    handleLoadHistory
  ])

  const handlePull = useCallback(async () => {
    if (!isRemoteConfigured()) {
      notifyRemoteRequired()
      return
    }
    const result = await onPull()
    if (result.success) {
      onToast(t('version_control.pull_success', '拉取成功'), 'success')
      await handleRefreshStatus({ fetch: true })
      await handleLoadHistory()
    } else {
      onToast(result.message || t('version_control.git_pull_failed', '拉取失败'), 'error')
      if (result.conflicts) {
        setConflicts(result.conflicts)
      }
    }
  }, [
    isRemoteConfigured,
    notifyRemoteRequired,
    onPull,
    onToast,
    t,
    handleRefreshStatus,
    handleLoadHistory,
    setConflicts
  ])

  const handleSyncRemote = useCallback(async () => {
    if (!isRemoteConfigured()) {
      notifyRemoteRequired()
      return
    }
    if (!onSyncRemote) return
    setIsSyncingRemote(true)
    try {
      const result = await onSyncRemote()
      if (result.success) {
        onToast(t('version_control.sync_remote_success', '远程同步完成'), 'success')
        setConflicts([])
        await handleRefreshStatus({ fetch: true })
        await handleLoadHistory()
      } else {
        onToast(result.message || t('version_control.sync_remote_failed', '远程同步失败'), 'error')
        if (result.conflicts) {
          setConflicts(result.conflicts)
        }
        await handleRefreshStatus({ fetch: true })
      }
    } finally {
      setIsSyncingRemote(false)
    }
  }, [
    isRemoteConfigured,
    notifyRemoteRequired,
    onSyncRemote,
    onToast,
    t,
    handleRefreshStatus,
    handleLoadHistory,
    setConflicts,
    setIsSyncingRemote
  ])

  return {
    handleSaveAuthorConfig,
    handleSaveRemoteConfig,
    handleTestRemote,
    isRemoteConfigured,
    notifyRemoteRequired,
    handlePush,
    handlePull,
    handleSyncRemote
  }
}
