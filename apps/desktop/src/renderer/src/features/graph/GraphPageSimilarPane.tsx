import React from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import { Button } from '@baishou/ui'
import styles from './GraphPage.module.css'

export function GraphPageSimilarPane(props: {
  pairs: GraphSimilarPendingPair[]
  busy: boolean
  onMerge: (pair: GraphSimilarPendingPair) => void
  onKeepApart: (pair: GraphSimilarPendingPair) => void
  onLocateNode: (id: string) => void
}): React.ReactElement {
  const { t } = useTranslation()
  if (props.pairs.length === 0) {
    return (
      <div className={styles.empty}>
        {t('graph.similar_empty', '没有需要你决定是否合并的相似节点')}
      </div>
    )
  }
  return (
    <>
      <p className={styles.pendingHint}>
        {t(
          'graph.similar_hint',
          '以下节点名称或语义相近，请确认是否指向同一对象；若相同可合并，不同则分开保留。'
        )}
      </p>
      <div className={styles.similarPairsList}>
        {props.pairs.map((pair) => (
          <div key={`${pair.nodeId}:${pair.peerId}`} className={styles.similarCard}>
            <div className={styles.similarNodesList}>
              <div className={styles.similarNodeRow}>
                <span className={styles.similarNodeLabel}>
                  {t('graph.similar_node_1', '节点1：')}
                </span>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => props.onLocateNode(pair.nodeId)}
                >
                  {pair.nodeName}
                </button>
              </div>
              <div className={styles.similarNodeRow}>
                <span className={styles.similarNodeLabel}>
                  {t('graph.similar_node_2', '节点2：')}
                </span>
                <button
                  type="button"
                  className={styles.linkBtn}
                  onClick={() => props.onLocateNode(pair.peerId)}
                >
                  {pair.peerName}
                </button>
              </div>
            </div>
            <div className={styles.similarMeta}>
              {t('graph.similar_similarity', '相似度 {{percent}}%', {
                percent: Math.round(pair.similarity * 100)
              })}
            </div>
            <div className={styles.similarReason}>{pair.reason}</div>
            {pair.sourceExcerpt ? (
              <div className={styles.similarExcerpt}>{pair.sourceExcerpt}</div>
            ) : null}
            <div className={styles.similarActions}>
              <Button size="small" disabled={props.busy} onClick={() => props.onMerge(pair)}>
                {t('graph.similar_merge', '合并')}
              </Button>
              <Button
                size="small"
                variant="outlined"
                disabled={props.busy}
                onClick={() => props.onKeepApart(pair)}
              >
                {t('graph.similar_keep_apart', '不是同一人')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
