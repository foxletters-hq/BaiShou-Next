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
  incomplete?: boolean
  onContinue?: () => void
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
  pendingGraphCount = 0,
  incomplete = false,
  onContinue
}) => {
  const { t } = useTranslation()
  const running = isOrganizeRunning(ragState, graphExtract, graphExtractWaiting)
  const leftover = incomplete && !running
  const title = leftover
    ? t('memory.organize_incomplete', '整理未完成')
    : running
      ? t('memory.readiness_organizing', '正在整理记忆…')
      : t('memory.organize_done', '整理完毕')
  const leftoverState: RagState = leftover
    ? {
        ...ragState,
        isRunning: true,
        type: 'batchEmbed',
        paused: false,
        cancelling: false
      }
    : ragState
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      closeOnOverlayClick
      animation="fade"
      title={title}
      className={styles.organizeModal}
    >
      {running || leftover ? (
        <>
          <RagMemoryAlerts
            surface="organize"
            ragState={leftoverState}
            hasMismatchModel={false}
            onPauseBatchEmbed={leftover ? undefined : onPauseBatchEmbed}
            onResumeBatchEmbed={leftover ? undefined : onResumeBatchEmbed}
            onCancelBatchEmbed={leftover ? undefined : onCancelBatchEmbed}
            graphExtract={leftover ? null : graphExtract}
            graphExtractWaiting={leftover ? false : graphExtractWaiting}
            pendingGraphCount={pendingGraphCount}
          />
          {leftover && onContinue ? (
            <div className={styles.organizeDoneActions}>
              <Button
                type="button"
                onClick={() => {
                  onClose()
                  onContinue()
                }}
              >
                {t('memory.organize_continue', '继续整理')}
              </Button>
              <Button type="button" variant="outlined" onClick={onClose}>
                {t('common.got_it', '知道了')}
              </Button>
            </div>
          ) : null}
        </>
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
