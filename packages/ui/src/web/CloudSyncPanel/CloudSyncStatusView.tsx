import React from 'react'
import { motion } from 'framer-motion'
import styles from './CloudSyncPanel.module.css'
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
  const { showCountModal, activeTab, onExportZip, onImportZip, onPickArchiveFile } = vm
  const showLocalArchive = Boolean(onExportZip && onImportZip && onPickArchiveFile)

  return (
    <motion.div
      key="status"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={styles.container}
    >
      {activeTab !== 'local' && <CloudSyncStatCards vm={vm} />}
      <section className={styles.cardSection}>
        <CloudSyncHeaderActions vm={vm} />
        {activeTab === 'local' && showLocalArchive ? (
          <LocalArchiveBackupPanel
            onExportZip={onExportZip!}
            onImportZip={onImportZip!}
            onPickFile={onPickArchiveFile!}
          />
        ) : (
          <CloudSyncRecordList vm={vm} />
        )}
      </section>
      {(activeTab === 'cloud' || activeTab === 'local') && <BackupScopeList />}

      {showCountModal && <CloudSyncCountModal vm={vm} />}
    </motion.div>
  )
}
