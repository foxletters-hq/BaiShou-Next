import React from 'react'
import { MdRefresh } from 'react-icons/md'
import type { GitManagementViewModel } from './useGitManagementPage'

export interface GitVersionCommitBarProps {
  vm: GitManagementViewModel
}

export const GitVersionCommitBar: React.FC<GitVersionCommitBarProps> = ({ vm }) => {
  const {
    t,
    isInitialized,
    commitMessage,
    setCommitMessage,
    handleManualCommit,
    handleCommitAndPush,
    canCommit
  } = vm

  if (!isInitialized) return null

  return (
    <div className="gmp-commit-area">
      <input
        className="gmp-input gmp-commit-input"
        type="text"
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        placeholder={t('version_control.commit_placeholder', '输入提交消息，留空将使用时间戳')}
      />
      <button
        className="gmp-btn gmp-btn-primary"
        onClick={handleManualCommit}
        disabled={!canCommit}
      >
        {t('version_control.commit_local', '提交')}
      </button>
      <button
        className="gmp-btn gmp-btn-primary"
        onClick={handleCommitAndPush}
        disabled={!canCommit}
      >
        {t('version_control.commit_push', '提交并推送')}
      </button>
      <button
        className="gmp-btn"
        onClick={() => {
          vm.handleLoadHistory()
          vm.handleRefreshStatus()
          vm.handleLoadRecentPulls()
        }}
        title={t('common.refresh', '刷新')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '8px'
        }}
      >
        <MdRefresh size={18} />
      </button>
    </div>
  )
}
