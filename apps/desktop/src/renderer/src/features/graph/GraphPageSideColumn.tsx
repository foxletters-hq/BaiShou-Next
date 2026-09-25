import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdArticle, MdChevronLeft, MdChevronRight, MdSettings, MdTune } from 'react-icons/md'
import type { GraphSideMode } from './graph-page.types'
import { formatGraphRailCount } from './graph-page-view.util'
import { GraphPageCanvasPane } from './GraphPageCanvasPane'
import { GraphPageContentPane } from './GraphPageContentPane'
import { GraphPageOrganizePane } from './GraphPageOrganizePane'
import styles from './GraphPage.module.css'

export function GraphPageSideColumn(props: {
  sideWidth: number
  sideCollapsed: boolean
  sideMode: GraphSideMode
  pendingReextractCount: number
  pendingReviewCount: number
  extractRunning: boolean
  filterActive: boolean
  onOpenSide: (mode: GraphSideMode) => void
  onToggleCollapsed: () => void
  onSideResizeDown: (event: React.MouseEvent) => void
  organize: React.ComponentProps<typeof GraphPageOrganizePane>
  canvas: React.ComponentProps<typeof GraphPageCanvasPane>
  content: React.ComponentProps<typeof GraphPageContentPane>
}): React.ReactElement {
  const { t } = useTranslation()
  const { sideMode } = props
  return (
    <div
      className={`${styles.sideColumn}${props.sideCollapsed ? ` ${styles.sideColumnCollapsed}` : ''}`}
      style={
        props.sideCollapsed
          ? undefined
          : { ['--graph-side-width' as string]: `${props.sideWidth}px` }
      }
    >
      {!props.sideCollapsed ? (
        <div
          className={styles.sideResizeSash}
          role="separator"
          aria-orientation="vertical"
          aria-label={t('graph.resize_sidebar', '调整侧栏宽度')}
          onMouseDown={props.onSideResizeDown}
        />
      ) : null}
      <div className={styles.sideRail} role="tablist" aria-label={t('graph.side_rail', '侧栏')}>
        <button
          type="button"
          role="tab"
          aria-selected={!props.sideCollapsed && sideMode === 'organize'}
          className={`${styles.railBtn} ${
            !props.sideCollapsed && sideMode === 'organize' ? styles.railBtnActive : ''
          }`}
          title={t('graph.side_organize', '整理')}
          onClick={() => props.onOpenSide('organize')}
        >
          <MdTune size={18} />
          {props.pendingReextractCount > 0 || props.extractRunning ? (
            <span className={styles.railDot} aria-hidden />
          ) : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!props.sideCollapsed && sideMode === 'canvas'}
          className={`${styles.railBtn} ${
            !props.sideCollapsed && sideMode === 'canvas' ? styles.railBtnActive : ''
          }`}
          title={t('graph.side_canvas', '画布')}
          onClick={() => props.onOpenSide('canvas')}
        >
          <MdSettings size={18} />
          {props.filterActive ? <span className={styles.railDot} aria-hidden /> : null}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!props.sideCollapsed && sideMode === 'content'}
          className={`${styles.railBtn} ${
            !props.sideCollapsed && sideMode === 'content' ? styles.railBtnActive : ''
          }`}
          title={
            props.pendingReviewCount > 0
              ? t('graph.side_content_pending', '内容 · 待确认 {{count}}', {
                  count: props.pendingReviewCount
                })
              : t('graph.side_content', '内容')
          }
          onClick={() => props.onOpenSide('content')}
        >
          <MdArticle size={18} />
          {props.pendingReviewCount > 0 ? (
            <span className={styles.railCount} aria-hidden>
              {formatGraphRailCount(props.pendingReviewCount)}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          className={`${styles.railBtn} ${styles.railCollapseBtn}`}
          title={
            props.sideCollapsed
              ? t('graph.expand_sidebar', '展开侧栏')
              : t('graph.collapse_sidebar', '收起侧栏')
          }
          aria-expanded={!props.sideCollapsed}
          onClick={props.onToggleCollapsed}
        >
          {props.sideCollapsed ? <MdChevronLeft size={18} /> : <MdChevronRight size={18} />}
        </button>
      </div>
      {!props.sideCollapsed ? (
        <aside className={styles.side}>
          {sideMode === 'organize' ? (
            <GraphPageOrganizePane {...props.organize} />
          ) : sideMode === 'canvas' ? (
            <GraphPageCanvasPane {...props.canvas} />
          ) : (
            <GraphPageContentPane {...props.content} />
          )}
        </aside>
      ) : null}
    </div>
  )
}
