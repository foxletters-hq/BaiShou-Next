import React from 'react'
import { useTranslation } from 'react-i18next'
import type { GraphSideTab } from './graph-page.types'
import { GraphPageNodesPane } from './GraphPageNodesPane'
import { GraphPagePendingPane } from './GraphPagePendingPane'
import { GraphPageReextractPane } from './GraphPageReextractPane'
import { GraphPageSimilarPane } from './GraphPageSimilarPane'
import styles from './GraphPage.module.css'

export function GraphPageContentPane(props: {
  tab: GraphSideTab
  onTabChange: (tab: GraphSideTab) => void
  pendingCount: number
  similarCount: number
  nodes: React.ComponentProps<typeof GraphPageNodesPane>
  reextract: React.ComponentProps<typeof GraphPageReextractPane>
  pending: React.ComponentProps<typeof GraphPagePendingPane>
  similar: React.ComponentProps<typeof GraphPageSimilarPane>
  scrollTopByTabRef?: React.MutableRefObject<Partial<Record<GraphSideTab, number>>>
  lastNodesPageKeyRef?: React.MutableRefObject<string | null>
}): React.ReactElement {
  const { t } = useTranslation()
  const { tab } = props
  const fallbackScrollRef = React.useRef<Partial<Record<GraphSideTab, number>>>({})
  const fallbackPageKeyRef = React.useRef<string | null>(null)
  const scrollMapRef = props.scrollTopByTabRef ?? fallbackScrollRef
  const pageKeyRef = props.lastNodesPageKeyRef ?? fallbackPageKeyRef
  const panelRef = React.useRef<HTMLDivElement>(null)
  const nodesPageKey = `${props.nodes.listed.page}:${props.nodes.pageSize}:${props.nodes.searchMode}:${props.nodes.query.trim()}`

  React.useLayoutEffect(() => {
    if (pageKeyRef.current !== null && pageKeyRef.current !== nodesPageKey) {
      scrollMapRef.current.nodes = 0
    }
    pageKeyRef.current = nodesPageKey
  }, [nodesPageKey, pageKeyRef, scrollMapRef])

  React.useLayoutEffect(() => {
    const el = panelRef.current
    if (!el) return
    el.scrollTop = scrollMapRef.current[tab] ?? 0
  }, [tab, nodesPageKey, scrollMapRef])

  return (
    <>
      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tab} ${tab === 'nodes' ? styles.tabActive : ''}`}
          onClick={() => props.onTabChange('nodes')}
        >
          {t('graph.tab_nodes', '节点')}
        </button>
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
      </div>
      <div
        ref={panelRef}
        className={styles.panel}
        data-graph-side-scroll
        onScroll={(event) => {
          scrollMapRef.current[tab] = event.currentTarget.scrollTop
        }}
      >
        {tab === 'nodes' && <GraphPageNodesPane {...props.nodes} />}

        {tab === 'reextract' && <GraphPageReextractPane {...props.reextract} />}

        {tab === 'pending' && <GraphPagePendingPane {...props.pending} />}

        {tab === 'similar' && <GraphPageSimilarPane {...props.similar} />}
      </div>
    </>
  )
}
