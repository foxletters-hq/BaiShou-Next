import React from 'react'
import { AnimatePresence } from 'framer-motion'
import './GitManagementPage.css'
import type { GitManagementPageProps } from './git-management.types'
import { useGitManagementPage } from './useGitManagementPage'
import { GitConfigTab } from './GitConfigTab'
import { GitVersionTab } from './GitVersionTab'

export const GitManagementPage: React.FC<GitManagementPageProps> = (props) => {
  const vm = useGitManagementPage(props)

  return (
    <div className="git-management-page">
      <div className="gmp-header">
        <div className="gmp-tabs">
          <button
            className={`gmp-tab ${vm.tab === 'config' ? 'active' : ''}`}
            onClick={() => vm.setTab('config')}
          >
            {vm.t('version_control.git_settings', 'Git 设置')}
          </button>
          <button
            className={`gmp-tab ${vm.tab === 'version' ? 'active' : ''}`}
            onClick={() => {
              vm.setTab('version')
              vm.handleLoadHistory()
              vm.handleRefreshStatus()
              vm.handleLoadRecentPulls()
            }}
          >
            {vm.t('version_control.version_control', '版本控制')}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {vm.tab === 'config' ? <GitConfigTab vm={vm} /> : <GitVersionTab vm={vm} />}
      </AnimatePresence>
    </div>
  )
}
