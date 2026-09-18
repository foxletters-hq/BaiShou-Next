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
        {t('graph.similar_hint', '模型吃不准这两人是不是同一个。能并就合并，不能并就分开保留。')}
      </p>
      {props.pairs.map((pair) => (
        <div key={`${pair.nodeId}:${pair.peerId}`} className={styles.itemCompact}>
          <div className={styles.itemTitle}>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => props.onLocateNode(pair.nodeId)}
            >
              {pair.nodeName}
            </button>
            <span> · </span>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => props.onLocateNode(pair.peerId)}
            >
              {pair.peerName}
            </button>
          </div>
          <div className={styles.itemMetaCompact}>
            {t('graph.similar_similarity', '相似度 {{percent}}%', {
              percent: Math.round(pair.similarity * 100)
            })}
          </div>
          <div className={styles.pendingHint}>{pair.reason}</div>
          {pair.sourceExcerpt ? (
            <div className={styles.itemMetaCompact}>{pair.sourceExcerpt}</div>
          ) : null}
          <div className={styles.rowActionsInline}>
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
    </>
  )
}
