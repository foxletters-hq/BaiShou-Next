import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdWarning } from 'react-icons/md'
import type { RagState } from './rag-memory.types'
import styles from './RagMemoryView.module.css'

interface RagMemoryAlertsProps {
  ragState: RagState
  hasMismatchModel: boolean
}

export const RagMemoryAlerts: React.FC<RagMemoryAlertsProps> = ({ ragState, hasMismatchModel }) => {
  const { t } = useTranslation()
  const isMigrating = ragState.isRunning && ragState.type === 'migration'

  return (
    <>
      {isMigrating && (
        <div className={styles.migrationAlert}>
          <div className={styles.migrationRow}>
            <div className={styles.spinner}></div>
            <span className={styles.migTitle}>
              {t('settings.rag_migrating', '知识库正在迁移中...')}
            </span>
          </div>
          <p className={styles.migDesc}>{ragState.statusText}</p>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{
                width: `${Math.min(100, Math.max(0, (ragState.progress / ragState.total) * 100))}%`
              }}
            ></div>
          </div>
        </div>
      )}

      {!ragState.isRunning && hasMismatchModel && (
        <div className={styles.dangerAlert}>
          <div className={styles.dangerRow}>
            <MdWarning size={18} color="#ef4444" />
            <span className={styles.dangerTitle}>
              {t('settings.rag_model_mismatch', '模型版本不匹配')}
            </span>
          </div>
          <p className={styles.dangerDesc}>
            {t(
              'settings.rag_model_mismatch_desc',
              '系统检测到当前的向量库由不同的嵌入模型(Embedding)生成。必须执行数据迁移，否则搜索功能将无法正确工作或引发错误。'
            )}
          </p>
        </div>
      )}
    </>
  )
}
