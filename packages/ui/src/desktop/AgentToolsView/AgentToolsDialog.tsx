import React from 'react'
import { Modal } from '../Modal/Modal'
import { AgentToolsView } from './AgentToolsView'
import type { AgentToolsViewProps } from './agent-tools.types'
import styles from './AgentToolsView.module.css'

export interface AgentToolsDialogProps extends AgentToolsViewProps {
  isOpen: boolean
  onClose: () => void
}

export const AgentToolsDialog: React.FC<AgentToolsDialogProps> = ({
  isOpen,
  onClose,
  config,
  onChange
}) => (
  <Modal
    isOpen={isOpen}
    onClose={onClose}
    closeOnOverlayClick
    overlayClassName={styles.toolManagerOverlay}
    className={styles.toolManagerModal}
  >
    <div className={styles.toolManagerModalBody}>
      <AgentToolsView
        config={config}
        onChange={onChange}
        presentation="dialog"
        onClose={onClose}
      />
    </div>
  </Modal>
)
