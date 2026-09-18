import React from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import {
  asGraphTranslateFn,
  resolveGraphSearchMode,
  translateGraphNodeType,
  type GraphMonthRange,
  type GraphSearchMode
} from '@baishou/shared'
import { Button, HelpTooltip, Input } from '@baishou/ui'
import { SegmentedControl } from '@baishou/ui/desktop/shared/SegmentedControl'
import { GraphMonthRangePicker } from './GraphMonthRangePicker'
import styles from './GraphPage.module.css'

export function GraphPageToolbar(props: {
  embedded: boolean
  showEmptyGuide: boolean
  searchGroupRef: React.RefObject<HTMLDivElement | null>
  searchMode: GraphSearchMode
  onSearchModeChange: (mode: GraphSearchMode) => void
  query: string
  onQueryChange: (value: string) => void
  onSearchAttemptedClear: () => void
  onSearch: (mode?: GraphSearchMode) => void
  dismissSearchPanel: () => void
  searching: boolean
  searchAttempted: boolean
  searchHits: any[]
  onSelectNode: (id: string, opts?: { locate?: boolean; bypassMonth?: boolean }) => void
  monthRange: GraphMonthRange
  onMonthRangeChange: (next: GraphMonthRange | Partial<GraphMonthRange>) => void
  onClearToGlobal: () => void
  sideCollapsed: boolean
  highlightStartOrganize: boolean
  pendingReextractCount: number
  onRunExtract: () => void
  extractRunning: boolean
  onOpenQueue: () => void
}): React.ReactElement {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  return (
    <div className={`${styles.toolbar}${props.embedded ? ` ${styles.toolbarEmbedded}` : ''}`}>
      <div className={styles.toolbarLeft}>
        {props.embedded ? null : (
          <div className={styles.titleRow}>
            <div className={styles.title}>{t('graph.title', '人生关系图')}</div>
            <HelpTooltip
              content={t(
                'graph.title_help',
                '这是从日记里整理出的人物、地点和事件关系。笔记本里的关系图是另一套库，不会混在这里。'
              )}
            />
          </div>
        )}
        {!props.showEmptyGuide ? (
          <div className={styles.searchGroup} ref={props.searchGroupRef}>
            <div className={styles.searchField}>
              <Input
                fieldSize="small"
                placeholder={
                  props.searchMode === 'semantic'
                    ? t('graph.search_placeholder_semantic', '按意思搜索节点…')
                    : t('graph.search_placeholder_text', '按名称 / 别名搜索')
                }
                value={props.query}
                onChange={(e) => {
                  props.onQueryChange(e.target.value)
                  props.onSearchAttemptedClear()
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void props.onSearch()
                  if (e.key === 'Escape') props.dismissSearchPanel()
                }}
                trailing={
                  <button
                    type="button"
                    className={styles.searchBtn}
                    aria-label={t('graph.search', '搜索')}
                    title={t('graph.search', '搜索')}
                    onClick={() => void props.onSearch()}
                  >
                    <Search size={15} strokeWidth={2.25} />
                  </button>
                }
              />
            </div>
            <SegmentedControl
              inline
              value={props.searchMode}
              aria-label={t('graph.search_mode', '搜索模式')}
              onChange={(mode) => {
                const next = resolveGraphSearchMode(mode)
                props.onSearchModeChange(next)
                if (props.query.trim()) void props.onSearch(next)
              }}
              options={[
                { value: 'semantic', label: t('graph.search_semantic', '语义搜索') },
                { value: 'text', label: t('graph.search_text', '文本搜索') }
              ]}
            />
            {props.searching || props.searchAttempted ? (
              <div
                className={styles.searchHits}
                role="listbox"
                aria-label={t('graph.search_results', '搜索结果')}
              >
                <div className={styles.searchHitsHeader}>
                  {props.searching
                    ? t('graph.searching', '正在搜索…')
                    : props.searchHits.length > 0
                      ? t('graph.search_results_count', '{{count}} 个节点', {
                          count: props.searchHits.length
                        })
                      : props.searchMode === 'semantic'
                        ? t(
                            'graph.search_semantic_empty',
                            '没有语义相近的节点。没做向量的节点不会出现在语义搜索里。'
                          )
                        : t('graph.search_no_hits', '没有找到匹配的节点')}
                </div>
                {props.searchHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className={styles.searchHit}
                    onClick={() => {
                      props.dismissSearchPanel()
                      void props.onSelectNode(hit.id, { locate: true, bypassMonth: true })
                    }}
                  >
                    <span className={styles.searchHitName}>{hit.name}</span>
                    <span className={styles.searchHitMeta}>
                      {translateGraphNodeType(tr, hit.nodeType)}
                      {hit.summary ? ` · ${hit.summary}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      {!props.showEmptyGuide || props.extractRunning ? (
        <div className={styles.toolbarRight}>
          {!props.showEmptyGuide ? (
            <>
              <GraphMonthRangePicker
                value={props.monthRange}
                onChange={(next) => props.onMonthRangeChange(next)}
                trailing={
                  <button
                    type="button"
                    title={t(
                      'graph.global_view_hint',
                      '退出当前查看的局部关系，显示这个月份范围内的全部节点。不会改月份范围。'
                    )}
                    aria-label={t(
                      'graph.global_view_hint',
                      '退出当前查看的局部关系，显示这个月份范围内的全部节点。不会改月份范围。'
                    )}
                    onClick={props.onClearToGlobal}
                  >
                    {t('graph.global_view', '全局')}
                  </button>
                }
              />
            </>
          ) : null}
          {props.sideCollapsed && !props.showEmptyGuide ? (
            <Button
              type="button"
              className={`${styles.btnBatchExtract} ${
                props.highlightStartOrganize ? styles.highlightStartOrganize : ''
              }`}
              disabled={props.pendingReextractCount === 0}
              title={t('graph.process_pending_reextract_hint', '把当前待重抽日记加入整理队列')}
              onClick={() => void props.onRunExtract()}
            >
              {t('graph.process_pending_reextract', '梳理待重抽 ({{count}})', {
                count: props.pendingReextractCount
              })}
            </Button>
          ) : null}
          {props.extractRunning ? (
            <Button type="button" onClick={props.onOpenQueue}>
              {t('graph.queue_view_progress', '查看进度')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
