import React from 'react'
import { motion } from 'framer-motion'
import styles from './CloudSyncPanel.module.css'
import type { CloudSyncPanelViewModel } from './useCloudSyncPanel'
import { CloudSyncStatCards } from './CloudSyncStatCards'
import { CloudSyncHeaderActions } from './CloudSyncHeaderActions'
import { CloudSyncRecordList } from './CloudSyncRecordList'
import { CloudSyncCountModal } from './CloudSyncCountModal'
import { BackupScopeList } from '../BackupScopeList'

export interface CloudSyncStatusViewProps {
  vm: CloudSyncPanelViewModel
}

export const CloudSyncStatusView: React.FC<CloudSyncStatusViewProps> = ({ vm }) => {
  const { showCountModal, activeTab } = vm

  return (
    <motion.div
      key="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={styles.container}
    >
      <CloudSyncStatCards vm={vm} />
      {activeTab === 'cloud' && <BackupScopeList />}
      <CloudSyncHeaderActions vm={vm} />
      <CloudSyncRecordList vm={vm} />
      {showCountModal && <CloudSyncCountModal vm={vm} />}
    </motion.div>
  )
}
