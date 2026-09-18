import React from 'react'
import { useTranslation } from 'react-i18next'
import { normalizeGraphFilePath } from '@baishou/shared'
import styles from './GraphPage.module.css'

export function GraphPageReextractPane(props: {
  pendingReextract: any[]
  queueByPath: Map<string, { status?: string }>
  onCancelQueueItem: (filePath: string) => void
  onRunExtract: (filePaths: string[]) => void
  onOpenSource: (date: string) => void
}): React.ReactElement {
  const { t } = useTranslation()
  if (props.pendingReextract.length === 0) {
    return <div className={styles.empty}>{t('graph.no_pending_reextract', '暂无待重抽日记')}</div>
  }
  return (
    <>
      {props.pendingReextract.map((item) => (
        <div key={item.filePath} className={styles.itemCompact} title={item.filePath}>
          <div className={styles.itemRow}>
            <div className={styles.itemTitle}>{item.date || item.filePath}</div>
            <div className={styles.rowActionsInline}>
              {(() => {
                const q = props.queueByPath.get(normalizeGraphFilePath(item.filePath))
                if (q?.status === 'running') {
                  return (
                    <span className={styles.queueBadge}>{t('graph.queue_running', '抽取中')}</span>
                  )
                }
                if (q?.status === 'aligning') {
                  return (
                    <span className={styles.queueBadge}>
                      {t('graph.extract_aligning', '对齐中')}
                    </span>
                  )
                }
                if (q?.status === 'pending') {
                  return (
                    <>
                      <span className={styles.queueBadge}>
                        {t('graph.queue_pending', '排队中')}
                      </span>
                      <button
                        type="button"
                        className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                        onClick={() => void props.onCancelQueueItem(item.filePath)}
                      >
                        {t('graph.queue_remove', '取消')}
                      </button>
                    </>
                  )
                }
                if (q?.status === 'completed') {
                  return (
                    <span className={styles.queueBadgeDone}>{t('graph.queue_done', '已完成')}</span>
                  )
                }
                return (
                  <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => void props.onRunExtract([item.filePath])}
                  >
                    {t('graph.extract_short', '抽取')}
                  </button>
                )
              })()}
              {item.date ? (
                <button
                  type="button"
                  className={`${styles.linkBtn} ${styles.linkBtnMuted}`}
                  onClick={() => void props.onOpenSource(item.date)}
                >
                  {t('graph.open_source_short', '原文')}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
