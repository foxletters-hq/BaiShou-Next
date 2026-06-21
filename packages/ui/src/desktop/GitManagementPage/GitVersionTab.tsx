import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import type { GitManagementViewModel } from './useGitManagementPage'
import { GitVersionCommitBar } from './GitVersionCommitBar'
import { GitStagedSection } from './GitStagedSection'
import { GitChangesSection } from './GitChangesSection'
import { GitCommitsSection } from './GitCommitsSection'
import { GitRecentPullsSection } from './GitRecentPullsSection'
import { GitConflictSection } from './GitConflictSection'

export interface GitVersionTabProps {
  vm: GitManagementViewModel
}

export const GitVersionTab: React.FC<GitVersionTabProps> = ({ vm }) => {
  useEffect(() => {
    vm.handleLoadHistory()
    vm.handleRefreshStatus()
    vm.handleLoadRecentPulls()
  }, [vm.page, vm.pageSize])

  return (
    <motion.div
      key="version"
      className="gmp-content"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
    >
      <GitVersionCommitBar vm={vm} />
      <div className="gmp-sections-container">
        <GitStagedSection vm={vm} />
        <GitChangesSection vm={vm} />
        <GitCommitsSection vm={vm} />
        <GitRecentPullsSection vm={vm} />
      </div>
      <GitConflictSection vm={vm} style={{ marginTop: 16 }} />
    </motion.div>
  )
}
