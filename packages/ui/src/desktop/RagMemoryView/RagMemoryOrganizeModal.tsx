import React from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button/Button'
import { Modal } from '../Modal/Modal'
import { RagMemoryAlerts } from './RagMemoryAlerts'
import type { RagState } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

export type RagMemoryOrganizeModalProps = {
  open: boolean
  onClose: () => void
  ragState: RagState
  onPauseBatchEmbed?: () => Promise<void>
  onResumeBatchEmbed?: () => Promise<void>
  onCancelBatchEmbed?: () => Promise<void>
  graphExtract?: { current: number; total: number; percent: number } | null
  graphExtractWaiting?: boolean
  pendingGraphCount?: number
}

function isOrganizeRunning(
  ragState: RagState,
  graphExtract: { current: number; total: number; percent: number } | null,
  graphExtractWaiting: boolean
): boolean {
  return (
    (ragState.isRunning && ragState.type === 'batchEmbed') ||
    Boolean(graphExtract && graphExtract.total > 0) ||
    graphExtractWaiting
  )
}

export const RagMemoryOrganizeModal: React.FC<RagMemoryOrganizeModalProps> = ({
  open,
  onClose,
  ragState,
  onPauseBatchEmbed,
  onResumeBatchEmbed,
  onCancelBatchEmbed,
  graphExtract = null,
  graphExtractWaiting = false,
  pendingGraphCount = 0
}) => {
  const { t } = useTranslation()
  const running = isOrganizeRunning(ragState, graphExtract, graphExtractWaiting)
  const title = running
    ? t('memory.readiness_organizing', '正在整理记忆…')
    : t('memory.organize_done', '整理完毕')
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick
      animation="fade"
      title={title}
      className={styles.organizeModal}
    >
      {running ? (
        <RagMemoryAlerts
          surface="organize"
          ragState={ragState}
          hasMismatchModel={false}
          onPauseBatchEmbed={onPauseBatchEmbed}
          onResumeBatchEmbed={onResumeBatchEmbed}
          onCancelBatchEmbed={onCancelBatchEmbed}
          graphExtract={graphExtract}
          graphExtractWaiting={graphExtractWaiting}
          pendingGraphCount={pendingGraphCount}
        />
      ) : (
        <div className={styles.organizeDone}>
          <div className={styles.organizeDoneActions}>
            <Button type="button" onClick={onClose}>
              {t('common.got_it', '知道了')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
