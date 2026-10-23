import React from 'react'
import { Input } from '../Input/Input'
import { Button } from '../Button/Button'
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
        placeholder={t('version_control.commit_placeholder', '提交变更 (留空自动生成快照)')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            if (canCommit && !isCommitActionInFlight) {
              void handleManualCommit()
            }
          }
        }}
      />
      <div className="gmp-commit-actions">
        <Button
          variant="outlined"
          size="small"
          onClick={handleManualCommit}
          disabled={!canCommit || isCommitActionInFlight}
          style={{ flex: 1 }}
        >
          {t('version_control.commit_local', '提交')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={handleCommitAndPush}
          disabled={!canCommit || isCommitActionInFlight}
        >
          {t('version_control.commit_push', '提交并推送')}
        </Button>
        <button
          type="button"
          className="gmp-btn gmp-icon-btn"
          onClick={() => {
            void vm.handleLoadHistory()
            void vm.handleRefreshStatus({ fetch: true })
          }}
          title={t('common.refresh', '刷新状态')}
        >
          <RefreshCw size={13} />
        </button>
      </div>
    </div>
  )
}
