import React from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphSideTab } from './graph-page.types'
import { GraphPageDetailPane } from './GraphPageDetailPane'
import { GraphPagePendingPane } from './GraphPagePendingPane'
import { GraphPageReextractPane } from './GraphPageReextractPane'
import { GraphPageSimilarPane } from './GraphPageSimilarPane'
import styles from './GraphPage.module.css'

export function GraphPageContentPane(props: {
  tab: GraphSideTab
  onTabChange: (tab: GraphSideTab) => void
  pendingCount: number
  similarCount: number
  reextract: React.ComponentProps<typeof GraphPageReextractPane>
  pending: React.ComponentProps<typeof GraphPagePendingPane>
  similar: React.ComponentProps<typeof GraphPageSimilarPane>
  detail: React.ComponentProps<typeof GraphPageDetailPane>
}): React.ReactElement {
  const { t } = useTranslation()
  const { tab } = props
  return (
    <>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'reextract' ? styles.tabActive : ''}`}
          onClick={() => props.onTabChange('reextract')}
        >
          {t('graph.tab_reextract', '待重抽')}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'pending' ? styles.tabActive : ''}`}
          onClick={() => props.onTabChange('pending')}
        >
          {t('graph.tab_pending_count', '待确认 ({{count}})', {
            count: props.pendingCount
          })}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'similar' ? styles.tabActive : ''}`}
          onClick={() => props.onTabChange('similar')}
        >
          {t('graph.tab_similar_count', '相似待合并 ({{count}})', {
            count: props.similarCount
          })}
        </button>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'detail' ? styles.tabActive : ''}`}
          onClick={() => props.onTabChange('detail')}
        >
          {t('graph.tab_detail', '详情')}
        </button>
      </div>
      <div className={styles.panel}>
        {tab === 'reextract' && <GraphPageReextractPane {...props.reextract} />}

        {tab === 'pending' && <GraphPagePendingPane {...props.pending} />}

        {tab === 'similar' && <GraphPageSimilarPane {...props.similar} />}

        {tab === 'detail' && <GraphPageDetailPane {...props.detail} />}
      </div>
    </>
  )
}
