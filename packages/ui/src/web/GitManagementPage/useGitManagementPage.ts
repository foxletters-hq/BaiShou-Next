import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { GitStatus, VersionHistoryEntry, FileChange, FileDiff } from '@baishou/shared'
import type { GitManagementPageProps } from './git-management.types'
import { useGitManagementCommit } from './useGitManagementCommit'
import { useGitManagementWorkspace } from './useGitManagementWorkspace'

export function useGitManagementPage(props: GitManagementPageProps) {
  const {
    config,
    onSaveConfig,
    onInit,
    isInitialized,
    onTestRemote,
    onCommit,
    onCommitAll,
    onToast,
    onGetStatus,
    onGetHistory,
    onGetRecentPulls,
    onGetCommitChanges,
    onGetFileDiff,
    onGetWorkingDiff,
    onStageFile,
    onStageAll,
    onUnstageFile,
    onUnstageAll,
    onDiscardFile,
    onDiscardAllChanges,
    onPush,
    onPull,
    onResolveConflict,
    onRollbackFile,
    onRollbackAll
  } = props
  const { t } = useTranslation()

  const [tab, setTab] = useState<'config' | 'version'>('config')
  const [remoteUrl, setRemoteUrl] = useState(config.remote?.url || '')
  const [remoteBranch, setRemoteBranch] = useState(config.remote?.branch || 'main')
  const [remoteUsername, setRemoteUsername] = useState(config.remote?.username || '')
  const [remoteToken, setRemoteToken] = useState(config.remote?.token || '')
  const [userName, setUserName] = useState(config.userName || '')
  const [userEmail, setUserEmail] = useState(config.userEmail || '')
  const [showPassword, setShowPassword] = useState(false)

  // 工作区状态
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null)

  // 可折叠区域
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    staged: true,
    changes: true,
    commits: true,
    pulls: true
  })

  // 历史记录
  const [history, setHistory] = useState<VersionHistoryEntry[]>([])
  const [recentPulls, setRecentPulls] = useState<VersionHistoryEntry[]>([])
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null)
  const [commitChanges, setCommitChanges] = useState<FileChange[]>([])
  const [selectedFileDiff, setSelectedFileDiff] = useState<FileDiff | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [expandedCommit, setExpandedCommit] = useState<string | null>(null)
  const [expandedFile, setExpandedFile] = useState<string | null>(null)
  const [expandedWorkingFile, setExpandedWorkingFile] = useState<{
    path: string
    staged: boolean
  } | null>(null)
  const [workingFileDiff, setWorkingFileDiff] = useState<FileDiff | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [totalCount, setTotalCount] = useState(0)
  const [commitMessage, setCommitMessage] = useState('')

  useEffect(() => {
    setRemoteUrl(config.remote?.url || '')
    setRemoteBranch(config.remote?.branch || 'main')
    setRemoteUsername(config.remote?.username || '')
    setRemoteToken(config.remote?.token || '')
    setUserName(config.userName || '')
    setUserEmail(config.userEmail || '')
  }, [config])

  const toggleSection = useCallback((section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }, [])

  const handleRefreshStatus = useCallback(async () => {
    try {
      const status = await onGetStatus()
      setGitStatus(status)
    } catch {
      // 静默失败
    }
  }, [onGetStatus])

  const handleLoadHistory = useCallback(async () => {
    try {
      const offset = (page - 1) * pageSize
      const entries = await onGetHistory(undefined, pageSize, offset)
      setTotalCount(
        entries.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + entries.length
      )
      setHistory(entries)
    } catch {
      onToast(t('version_control.load_history_failed', '加载历史失败'), 'error')
    }
  }, [onGetHistory, page, pageSize, onToast, t])

  const handleLoadRecentPulls = useCallback(async () => {
    try {
      const pulls = await onGetRecentPulls(10)
      setRecentPulls(pulls)
    } catch {
      // 静默失败
    }
  }, [onGetRecentPulls])

  const handleInit = useCallback(async () => {
    const result = await onInit()
    if (result.success) {
      onToast(t('version_control.git_init_success', 'Git 仓库初始化成功'), 'success')
      handleRefreshStatus()
    } else {
      onToast(result.message || t('version_control.git_init_failed', '初始化失败'), 'error')
    }
  }, [onInit, onToast, t, handleRefreshStatus])

  const handleSaveConfig = useCallback(async () => {
    try {
      onSaveConfig({
        userName: userName || undefined,
        userEmail: userEmail || undefined,
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
    } catch (e: any) {
      onToast(e?.message || t('common.error', '保存失败'), 'error')
    }
  }, [
    remoteUrl,
    remoteBranch,
    remoteUsername,
    remoteToken,
    userName,
    userEmail,
    onSaveConfig,
    onToast,
    t
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

  const handlePush = useCallback(async () => {
    const result = await onPush()
    onToast(
      result.success
        ? t('version_control.push_success', '推送成功')
        : result.message || t('version_control.git_push_failed', '推送失败'),
      result.success ? 'success' : 'error'
    )
  }, [onPush, onToast, t])

  const stagedCount = gitStatus?.staged.length ?? 0
  const unstagedCount = (gitStatus?.unstaged.length ?? 0) + (gitStatus?.untracked.length ?? 0)
  const canCommit = stagedCount > 0 || unstagedCount > 0

  const { handleManualCommit, handleCommitAndPush } = useGitManagementCommit({
    t,
    commitMessage,
    setCommitMessage,
    stagedCount,
    onCommit,
    onCommitAll,
    onPush,
    onToast,
    handleRefreshStatus,
    handleLoadHistory,
    setSelectedCommit,
    setCommitChanges,
    setSelectedFileDiff
  })

  const handlePull = useCallback(async () => {
    const result = await onPull()
    if (result.success) {
      onToast(t('version_control.pull_success', '拉取成功'), 'success')
      handleRefreshStatus()
      handleLoadHistory()
    } else {
      onToast(result.message || t('version_control.git_pull_failed', '拉取失败'), 'error')
      if (result.conflicts) {
        setConflicts(result.conflicts)
      }
    }
  }, [onPull, onToast, t, handleRefreshStatus, handleLoadHistory])

  const {
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
  } = useGitManagementWorkspace({
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
  })

  return {
    t,
    isInitialized,
    onResolveConflict,
    tab,
    setTab,
    remoteUrl,
    setRemoteUrl,
    remoteBranch,
    setRemoteBranch,
    remoteUsername,
    setRemoteUsername,
    remoteToken,
    setRemoteToken,
    userName,
    setUserName,
    userEmail,
    setUserEmail,
    showPassword,
    setShowPassword,
    gitStatus,
    expandedSections,
    history,
    recentPulls,
    selectedCommit,
    commitChanges,
    selectedFileDiff,
    conflicts,
    expandedCommit,
    expandedFile,
    expandedWorkingFile,
    workingFileDiff,
    page,
    setPage,
    pageSize,
    setPageSize,
    totalCount,
    commitMessage,
    setCommitMessage,
    stagedCount,
    unstagedCount,
    canCommit,
    toggleSection,
    handleRefreshStatus,
    handleLoadHistory,
    handleLoadRecentPulls,
    handleInit,
    handleSaveConfig,
    handleTestRemote,
    handlePush,
    handlePull,
    handleManualCommit,
    handleCommitAndPush,
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

export type GitManagementViewModel = ReturnType<typeof useGitManagementPage>
