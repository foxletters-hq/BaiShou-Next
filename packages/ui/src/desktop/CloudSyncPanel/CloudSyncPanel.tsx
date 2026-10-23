import React from 'react'
import { AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import type { CloudSyncPanelProps } from './cloud-sync.types'
import { useCloudSyncPanel } from './useCloudSyncPanel'
import { CloudSyncConfigForm } from './CloudSyncConfigForm'
import { CloudSyncStatusView } from './CloudSyncStatusView'
import { RestoreBlockingOverlay } from '../RestoreBlockingOverlay'
import { SettingsPageChrome } from '../shared/SettingsPageChrome'
import styles from './CloudSyncPanel.module.css'

export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = (props) => {
  const { t } = useTranslation()
  const vm = useCloudSyncPanel(props)

  return (
    <>
      <SettingsPageChrome title={t('data_sync.title', '数据备份')} layout="stack">
        <div className={styles.pageBodyScroll}>
          <AnimatePresence mode="wait">
            {vm.showConfig ? <CloudSyncConfigForm vm={vm} /> : <CloudSyncStatusView vm={vm} />}
          </AnimatePresence>
        </div>
      </SettingsPageChrome>
      <RestoreBlockingOverlay visible={vm.isRestoring} />
    </>
  )
}
