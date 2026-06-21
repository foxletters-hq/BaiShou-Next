import React from 'react'
import { AnimatePresence } from 'framer-motion'
import type { CloudSyncPanelProps } from './cloud-sync.types'
import { useCloudSyncPanel } from './useCloudSyncPanel'
import { CloudSyncConfigForm } from './CloudSyncConfigForm'
import { CloudSyncStatusView } from './CloudSyncStatusView'
import { RestoreBlockingOverlay } from '../RestoreBlockingOverlay'

export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = (props) => {
  const vm = useCloudSyncPanel(props)

  return (
    <>
      <AnimatePresence mode="wait">
        {vm.showConfig ? <CloudSyncConfigForm vm={vm} /> : <CloudSyncStatusView vm={vm} />}
      </AnimatePresence>
      <RestoreBlockingOverlay visible={vm.isRestoring} />
    </>
  )
}
