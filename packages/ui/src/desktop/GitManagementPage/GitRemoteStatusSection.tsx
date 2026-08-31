import React, { useState } from 'react'
import { Cloud, CloudOff } from 'lucide-react'
import { Modal } from '../Modal/Modal'
import stack from '../shared/SettingsStack.module.css'
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
    statusLabel = t('version_control.remote_unreachable', '无法连接远程')
  } else if (configured && unpublished) {
    statusLabel = t('version_control.remote_unpublished', '尚未推送到远程')
  } else if (configured && connected) {
    statusLabel = t('version_control.remote_connected', '已连接')
  } else if (configured) {
    statusLabel = t('version_control.remote_configured', '已配置远程')
  }

  return (
    <div className={stack.stackGroup}>
      <div className={stack.sectionLabelRow}>
        <h3 className={stack.sectionLabel}>{t('version_control.remote_status', '远程仓库')}</h3>
      </div>
      <section className={stack.cardSection}>
        <div className="gmp-section-body">
          {!vm.isInitialized ? (
            <div className="gmp-btn-row" style={{ marginBottom: 12 }}>
              <button className="gmp-btn gmp-btn-primary" onClick={() => void vm.handleInit()}>
                {t('version_control.init_git', '初始化 Git 仓库')}
              </button>
            </div>
          ) : null}

          <div className="gmp-remote-status-row">
            {connected && !unpublished ? (
              <Cloud size={16} aria-hidden />
            ) : (
              <CloudOff size={16} aria-hidden />
            )}
            <div className="gmp-remote-status-text">
              <div className="gmp-remote-status-title">{statusLabel}</div>
              <div className="gmp-remote-status-meta">
                {t('version_control.remote_branch_label', '分支')} {branch}
                {configured && !unpublished ? (
                  <>
                    {' · '}
                    {t('version_control.ahead_count', '领先 {{count}}', { count: ahead })}
                    {' · '}
                    {t('version_control.behind_count', '落后 {{count}}', { count: behind })}
                  </>
                ) : null}
              </div>
              {status?.fetchError ? (
                <div className="gmp-remote-status-error">{status.fetchError}</div>
              ) : null}
            </div>
          </div>

          <div className="gmp-btn-row" style={{ marginTop: 16 }}>
            <button
              className="gmp-btn gmp-btn-primary"
              onClick={() => void vm.handleSyncRemote()}
              disabled={!canClickSync}
            >
              {vm.isSyncingRemote
                ? t('version_control.syncing_remote', '正在同步…')
                : t('version_control.sync_remote', '同步远程')}
            </button>
            <button
              className="gmp-btn"
              onClick={() => void vm.handlePull()}
              disabled={!canClickRemoteAction}
            >
              {t('version_control.pull', '拉取')}
            </button>
            <button
              className="gmp-btn"
              onClick={() => void vm.handlePush()}
              disabled={!canClickRemoteAction}
            >
              {t('version_control.push', '推送')}
            </button>
            <button className="gmp-btn" onClick={() => setConfigOpen(true)}>
              {t('version_control.show_config', '配置')}
            </button>
          </div>
        </div>
      </section>
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
      <GitConflictSection vm={vm} />
    </div>
  )
}
