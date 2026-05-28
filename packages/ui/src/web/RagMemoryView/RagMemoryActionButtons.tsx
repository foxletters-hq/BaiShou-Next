import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdAutoStories, MdAddComment } from 'react-icons/md'
import type { RagState } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryActionButtonsProps {
  ragState: RagState
  isBusy: boolean
  isBatchEmbedding: boolean
  onBatchEmbed?: () => Promise<void>
  onAddManualMemory?: () => Promise<void>
}

export const RagMemoryActionButtons: React.FC<RagMemoryActionButtonsProps> = ({
  ragState,
  isBusy,
  isBatchEmbedding,
  onBatchEmbed,
  onAddManualMemory
}) => {
  const { t } = useTranslation()

  return (
    <div className={styles.actionButtonsRow}>
      <button
        className={`${styles.actionBtn} ${styles.btnBlueFlat}`}
        onClick={() => void onBatchEmbed?.()}
        disabled={isBusy}
      >
        <MdAutoStories size={16} />{' '}
        {isBatchEmbedding
          ? `${t('common.processing', '处理中')} ${ragState.progress}/${ragState.total}`
          : t('settings.rag_batch_embed', '全量嵌入日记')}
      </button>
      <button
        className={`${styles.actionBtn} ${styles.btnGreenOutlined}`}
        onClick={() => void onAddManualMemory?.()}
        disabled={isBusy}
      >
        <MdAddComment size={16} /> {t('settings.rag_add_manual', '手动添加记忆')}
      </button>
    </div>
  )
}
