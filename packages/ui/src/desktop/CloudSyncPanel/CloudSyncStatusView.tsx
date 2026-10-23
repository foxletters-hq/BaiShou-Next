import React from 'react'
import { motion } from 'framer-motion'
import styles from './CloudSyncPanel.module.css'
import stack from '../shared/SettingsStack.module.css'
import type { CloudSyncPanelViewModel } from './useCloudSyncPanel'
import { CloudSyncStatCards } from './CloudSyncStatCards'
import { CloudSyncHeaderActions } from './CloudSyncHeaderActions'
import { CloudSyncRecordList } from './CloudSyncRecordList'
import { CloudSyncCountModal } from './CloudSyncCountModal'
import { BackupScopeList } from '../BackupScopeList'
import { LocalArchiveBackupPanel } from './LocalArchiveBackupPanel'

export interface CloudSyncStatusViewProps {
  vm: CloudSyncPanelViewModel
}

export const CloudSyncStatusView: React.FC<CloudSyncStatusViewProps> = ({ vm }) => {
  const {
    showCountModal,
    activeTab,
    onExportZip,
    onImportZip,
    onPickArchiveFile,
    onImportProgress
  } = vm
  const showLocalArchive = Boolean(onExportZip && onImportZip && onPickArchiveFile)

  return (
    <motion.div
      key="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={`${styles.container} ${stack.stack}`}
    >
      <CloudSyncStatCards vm={vm} />
      <div className={stack.stackGroup}>
        <section className={stack.cardSection}>
          <CloudSyncHeaderActions vm={vm} />
          {activeTab === 'local' && showLocalArchive ? (
            <LocalArchiveBackupPanel
              onExportZip={onExportZip!}
              onImportZip={onImportZip!}
              onPickFile={onPickArchiveFile!}
              onImportProgress={onImportProgress}
            />
          ) : (
            <CloudSyncRecordList vm={vm} />
          )}
        </section>
      </div>
      {(activeTab === 'cloud' || activeTab === 'local') && <BackupScopeList />}

      {showCountModal && <CloudSyncCountModal vm={vm} />}
    </motion.div>
  )
}
