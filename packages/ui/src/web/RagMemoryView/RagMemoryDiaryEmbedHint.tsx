import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MdInfoOutline, MdExpandMore, MdExpandLess } from 'react-icons/md'
import styles from './RagMemoryView.module.css'

interface RagMemoryDiaryEmbedHintProps {
  failedAt?: number
  onBatchEmbed?: () => Promise<void>
}

export const RagMemoryDiaryEmbedHint: React.FC<RagMemoryDiaryEmbedHintProps> = ({
  failedAt,
  onBatchEmbed
}) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  if (!failedAt) return null

  return (
    <div className={styles.embedHint}>
      <button
        type="button"
        className={styles.embedHintChip}
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <MdInfoOutline size={16} />
        <span>{t('settings.rag_diary_embed_pending_chip', '有未完成的日记记忆嵌入')}</span>
        {expanded ? <MdExpandLess size={18} /> : <MdExpandMore size={18} />}
      </button>
      {expanded ? (
        <div className={styles.embedHintBody}>
          <p className={styles.embedHintDesc}>
            {t(
              'settings.rag_diary_embed_pending_detail',
              '最近保存或修改的日记未能写入记忆向量（可能是网络中断）。日记正文已安全保存，可点击下方按钮补全嵌入。'
            )}
          </p>
          {onBatchEmbed ? (
            <button
              type="button"
              className={styles.embedHintAction}
              onClick={() => void onBatchEmbed()}
            >
              {t('settings.rag_batch_embed', '全量扫描未索引日记')}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
