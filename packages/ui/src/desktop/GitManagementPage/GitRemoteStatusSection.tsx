import React, { useState } from 'react'
import {
  GitBranch,
  RefreshCw,
  ArrowDown,
  ArrowUp,
  Settings,
  Check,
  AlertCircle,
  CloudOff
} from 'lucide-react'
import { Modal } from '../Modal/Modal'
import { Button } from '../Button/Button'
import type { GitManagementViewModel } from './useGitManagementPage'
import { GitConfigTab } from './GitConfigTab'
import { GitConflictSection } from './GitConflictSection'

export interface GitRemoteStatusSectionProps {
  vm: GitManagementViewModel
}

export const GitRemoteStatusSection: React.FC<GitRemoteStatusSectionProps> = ({ vm }) => {
  const { t } = vm
  const [configOpen, setConfigOpen] = useState(false)
  const status = vm.remoteStatus
  const configured = Boolean(status?.configured || vm.remoteUrl)
  const connected = Boolean(status?.connected)
  const unpublished = status?.unpublished ?? !configured
  const ahead = status?.ahead ?? vm.branchInfo?.ahead ?? 0
  const behind = status?.behind ?? vm.branchInfo?.behind ?? 0
  const branch = status?.branch || vm.remoteBranch || vm.branchInfo?.current || 'main'
  const hasConflicts = vm.conflicts.length > 0
  const canClickSync = vm.isInitialized && !vm.isSyncingRemote && !hasConflicts && vm.canSyncRemote
  const canClickRemoteAction = vm.isInitialized && !vm.isSyncingRemote && !hasConflicts

  let statusLabel = t('version_control.remote_not_configured', '未配置远程')
  if (!vm.isInitialized) {
    statusLabel = t('version_control.repo_not_initialized', '仓库未初始化')
  } else if (configured && status?.fetchError) {
    statusLabel = t('version_control.remote_unreachable', '无法连接')
  } else if (configured && unpublished) {
    statusLabel = t('version_control.remote_unpublished', '未推送')
  } else if (configured && connected) {
    statusLabel = t('version_control.remote_connected', '已连接')
  } else if (configured) {
    statusLabel = t('version_control.remote_configured', '已配置')
  }

  return (
    <div className="gmp-remote-strip">
      {!vm.isInitialized ? (
        <div className="gmp-remote-uninit-bar">
          <span className="gmp-remote-uninit-text">
            {t('version_control.repo_not_initialized', '当前工作区尚未初始化 Git 仓库')}
          </span>
          <Button variant="outlined" size="small" onClick={() => void vm.handleInit()}>
            {t('version_control.init_git', '初始化 Git')}
          </Button>
        </div>
      ) : (
        <div className="gmp-remote-toolbar">
          <div className="gmp-remote-branch-group">
            <GitBranch size={13} className="gmp-remote-branch-icon" />
            <span className="gmp-remote-branch-name" title={`当前分支: ${branch}`}>
              {branch}
            </span>
            {configured && !unpublished ? (
              ahead > 0 || behind > 0 ? (
                <span
                  className="gmp-remote-sync-chip gmp-remote-sync-chip-diff"
                  title={t('version_control.sync_ahead_behind_tip', '领先 {{ahead}}，落后 {{behind}}', {
                    ahead,
                    behind
                  })}
                >
                  {ahead > 0 ? `↑${ahead}` : ''}
                  {behind > 0 ? ` ↓${behind}` : ''}
                </span>
              ) : (
                <span
                  className="gmp-remote-sync-chip gmp-remote-sync-chip-synced"
                  title={t('version_control.synced_tip', '与远程分支已同步')}
                >
                  <Check size={11} />
                  <span>{t('version_control.synced', '已同步')}</span>
                </span>
              )
            ) : (
              <span
                className={`gmp-remote-sync-chip ${
                  status?.fetchError
                    ? 'gmp-remote-sync-chip-error'
                    : 'gmp-remote-sync-chip-unconfigured'
                }`}
                title={status?.fetchError || statusLabel}
              >
                {status?.fetchError ? <CloudOff size={11} /> : null}
                <span>{statusLabel}</span>
              </span>
            )}
          </div>

          <div className="gmp-remote-actions-toolbar">
            <button
              type="button"
              className="gmp-tool-btn"
              onClick={() => void vm.handleSyncRemote()}
              disabled={!canClickSync}
              title={t('version_control.sync_remote', '同步远程')}
              aria-label={t('version_control.sync_remote', '同步远程')}
            >
              <RefreshCw size={13} className={vm.isSyncingRemote ? 'gmp-spin' : ''} />
            </button>
            <button
              type="button"
              className="gmp-tool-btn"
              onClick={() => void vm.handlePull()}
              disabled={!canClickRemoteAction}
              title={t('version_control.pull', '从远程拉取')}
              aria-label={t('version_control.pull', '从远程拉取')}
            >
              <ArrowDown size={13} />
            </button>
            <button
              type="button"
              className="gmp-tool-btn"
              onClick={() => void vm.handlePush()}
              disabled={!canClickRemoteAction}
              title={t('version_control.push', '推送到远程')}
              aria-label={t('version_control.push', '推送到远程')}
            >
              <ArrowUp size={13} />
            </button>
            <button
              type="button"
              className="gmp-tool-btn"
              onClick={() => setConfigOpen(true)}
              title={t('version_control.show_config', '远程仓库配置')}
              aria-label={t('version_control.show_config', '远程仓库配置')}
            >
              <Settings size={13} />
            </button>
          </div>
        </div>
      )}

      {status?.fetchError ? (
        <div className="gmp-remote-error-strip" title={status.fetchError}>
          <AlertCircle size={12} className="gmp-remote-error-icon" />
          <span className="gmp-remote-error-msg">{status.fetchError}</span>
        </div>
      ) : null}

      <GitConflictSection vm={vm} />

      <Modal
        isOpen={configOpen}
        onClose={() => setConfigOpen(false)}
        title={t('version_control.remote_config', '远程仓库配置')}
        closeOnOverlayClick
        className="gmp-config-modal"
        overlayClassName="gmp-config-modal-overlay"
        zIndex={10040}
      >
        <GitConfigTab vm={vm} />
      </Modal>
    </div>
  )
}

