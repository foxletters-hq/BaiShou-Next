import React from 'react'
import { AnimatePresence } from 'framer-motion'
import './GitManagementPage.css'
import seg from '../shared/SegmentedControl.module.css'
import type { GitManagementPageProps } from './git-management.types'
import { useGitManagementPage } from './useGitManagementPage'
import { GitConfigTab } from './GitConfigTab'
import { GitVersionTab } from './GitVersionTab'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'

export const GitManagementPage: React.FC<GitManagementPageProps> = (props) => {
  const vm = useGitManagementPage(props)

  return (
    <SettingsPageChrome title={vm.t('version_control.title', '版本控制')} layout="stack">
      <div className="git-management-page">
        <div className="gmp-header">
          <div className={seg.group}>
            <button
              type="button"
              className={`${seg.btn} ${vm.tab === 'config' ? seg.btnActive : ''}`}
              onClick={() => vm.setTab('config')}
            >
              {vm.t('version_control.git_settings', 'Git 设置')}
            </button>
            <button
              type="button"
              className={`${seg.btn} ${vm.tab === 'version' ? seg.btnActive : ''}`}
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
    </SettingsPageChrome>
  )
}
