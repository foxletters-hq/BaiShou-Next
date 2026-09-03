import React from 'react'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { RagMemoryConfigBlock } from './RagMemoryConfigBlock'
import type { RagConfig } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryParamsModalProps {
  open: boolean
  config: RagConfig
  onChange: (config: RagConfig) => void
  onClose: () => void
}

export const RagMemoryParamsModal: React.FC<RagMemoryParamsModalProps> = ({
  open,
  config,
  onChange,
  onClose
}) => {
  const { t } = useTranslation()

  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick
      animation="fade"
      className={styles.paramsModal}
      title={t('settings.rag_config_params', '检索参数调节')}
    >
      <RagMemoryConfigBlock config={config} onChange={onChange} />
    </Modal>
  )
}
