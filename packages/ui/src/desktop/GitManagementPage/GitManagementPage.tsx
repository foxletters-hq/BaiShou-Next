import React, { useMemo } from 'react'
import { AnimatePresence } from 'framer-motion'
import './GitManagementPage.css'
import type { GitManagementPageProps } from './git-management.types'
import { useGitManagementPage } from './useGitManagementPage'
import { GitConfigTab } from './GitConfigTab'
import { GitVersionTab } from './GitVersionTab'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import { SegmentedControl } from '../shared/SegmentedControl'

export const GitManagementPage: React.FC<GitManagementPageProps> = (props) => {
  const vm = useGitManagementPage(props)

  const tabOptions = useMemo(
    () =>
      [
        {
          value: 'config' as const,
          label: vm.t('version_control.git_settings', 'Git 设置')
        },
        {
          value: 'version' as const,
          label: vm.t('version_control.version_control', '版本控制')
        }
      ] as const,
    [vm.t]
  )

  return (
    <SettingsPageChrome title={vm.t('version_control.title', '版本控制')} layout="stack">
      <div className="git-management-page">
        <div className="gmp-header">
          <SegmentedControl
            value={vm.tab}
            options={tabOptions}
            aria-label={vm.t('version_control.title', '版本控制')}
            onChange={(next) => {
              vm.setTab(next)
              if (next === 'version') {
                vm.handleLoadHistory()
                vm.handleRefreshStatus()
                vm.handleLoadRecentPulls()
              }
            }}
          />
        </div>

        <AnimatePresence mode="wait">
          {vm.tab === 'config' ? <GitConfigTab vm={vm} /> : <GitVersionTab vm={vm} />}
        </AnimatePresence>
      </div>
    </SettingsPageChrome>
  )
}
