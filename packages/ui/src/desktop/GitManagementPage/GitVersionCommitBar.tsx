import React from 'react'
import { Input } from '../Input/Input'
import type { GitManagementViewModel } from './useGitManagementPage'
import { RefreshCw } from 'lucide-react'

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
    canCommit,
    isCommitActionInFlight
  } = vm

  if (!isInitialized) return null

  return (
    <div className="gmp-commit-area">
      <Input
        fieldSize="small"
        className="gmp-commit-input"
        type="text"
        value={commitMessage}
        onChange={(e) => setCommitMessage(e.target.value)}
        placeholder={t('version_control.commit_placeholder', '输入提交消息，留空将使用时间戳')}
      />
      <button
        className="gmp-btn gmp-btn-primary"
        onClick={handleManualCommit}
        disabled={!canCommit || isCommitActionInFlight}
      >
        {t('version_control.commit_local', '提交')}
      </button>
      <button
        className="gmp-btn gmp-btn-primary"
        onClick={handleCommitAndPush}
        disabled={!canCommit || isCommitActionInFlight}
      >
        {t('version_control.commit_push', '提交并推送')}
      </button>
      <button
        className="gmp-btn gmp-icon-btn"
        onClick={() => {
          void vm.handleLoadHistory()
          void vm.handleRefreshStatus({ fetch: true })
        }}
        title={t('common.refresh', '刷新')}
      >
        <RefreshCw size={16} />
      </button>
    </div>
  )
}
