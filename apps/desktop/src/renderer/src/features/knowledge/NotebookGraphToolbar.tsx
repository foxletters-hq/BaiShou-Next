import React from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import {
  asGraphTranslateFn,
  resolveGraphSearchMode,
  translateGraphNodeType,
  type GraphSearchMode
} from '@baishou/shared'
import { Button, HelpTooltip, Input } from '@baishou/ui'
import { SegmentedControl } from '@baishou/ui/desktop/shared/SegmentedControl'
import graphStyles from '../graph/GraphPage.module.css'
import styles from './KnowledgePage.module.css'

export function NotebookGraphToolbar({
  query,
  extracting,
  sourceCount,
  searchMode,
  onSearchModeChange,
  searching,
  searchAttempted,
  searchHits,
  searchGroupRef,
  onQueryChange,
  onSearchAttemptedClear,
  onSearch,
  onSelectHit,
  dismissSearchPanel,
  onRebuildGraph,
  onStartExtract
}: {
  query: string
  extracting: boolean
  sourceCount: number
  searchMode: GraphSearchMode
  onSearchModeChange: (mode: GraphSearchMode) => void
  searching: boolean
  searchAttempted: boolean
  searchHits: Array<{ id: string; name: string; nodeType: string; summary?: string }>
  searchGroupRef: React.RefObject<HTMLDivElement | null>
  onQueryChange: (value: string) => void
  onSearchAttemptedClear: () => void
  onSearch: (mode?: GraphSearchMode) => void
  onSelectHit: (id: string) => void
  dismissSearchPanel: () => void
  onRebuildGraph?: () => void
  onStartExtract: () => void
}) {
  const { t } = useTranslation()
  const tr = asGraphTranslateFn(t)
  return (
    <div className={graphStyles.chrome}>
      <div className={`${graphStyles.toolbar} ${styles.notebookGraphToolbar}`}>
        <div className={graphStyles.toolbarLeft}>
          <div className={graphStyles.titleRow}>
            <div className={graphStyles.title}>{t('knowledge.graph_panel', '笔记本内关系')}</div>
            <HelpTooltip
              size={15}
              content={t(
                'knowledge.graph_title_help',
                '这是从这本笔记本资料里整理出的人物、地点和事件关系。人生关系图是另一套库，不会混在这里。'
              )}
            />
          </div>
          <div className={graphStyles.searchGroup} ref={searchGroupRef}>
            <div className={graphStyles.searchField}>
              <Input
                fieldSize="small"
                placeholder={
                  searchMode === 'semantic'
                    ? t('graph.search_placeholder_semantic', '按意思搜索节点…')
                    : t('graph.search_placeholder_text', '按名称 / 别名搜索')
                }
                value={query}
                onChange={(event) => {
                  onQueryChange(event.target.value)
                  onSearchAttemptedClear()
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void onSearch()
                  if (event.key === 'Escape') dismissSearchPanel()
                }}
                trailing={
                  <button
                    type="button"
                    className={graphStyles.searchBtn}
                    aria-label={t('graph.search', '搜索')}
                    title={t('graph.search', '搜索')}
                    onClick={() => void onSearch()}
                  >
                    <Search size={15} strokeWidth={2.25} />
                  </button>
                }
              />
            </div>
            <SegmentedControl
              inline
              value={searchMode}
              aria-label={t('graph.search_mode', '搜索模式')}
              onChange={(mode) => {
                const next = resolveGraphSearchMode(mode)
                onSearchModeChange(next)
                if (query.trim()) void onSearch(next)
              }}
              options={[
                { value: 'semantic', label: t('graph.search_semantic', '语义搜索') },
                { value: 'text', label: t('graph.search_text', '文本搜索') }
              ]}
            />
            {searching || searchAttempted ? (
              <div
                className={graphStyles.searchHits}
                role="listbox"
                aria-label={t('graph.search_results', '搜索结果')}
              >
                <div className={graphStyles.searchHitsHeader}>
                  {searching
                    ? t('graph.searching', '正在搜索…')
                    : searchHits.length > 0
                      ? t('graph.search_results_count', '{{count}} 个节点', {
                          count: searchHits.length
                        })
                      : searchMode === 'semantic'
                        ? t(
                            'graph.search_semantic_empty',
                            '没有语义相近的节点。没做向量的节点不会出现在语义搜索里。'
                          )
                        : t('graph.search_no_hits', '没有找到匹配的节点')}
                </div>
                {searchHits.map((hit) => (
                  <button
                    key={hit.id}
                    type="button"
                    className={graphStyles.searchHit}
                    onClick={() => {
                      dismissSearchPanel()
                      onSelectHit(hit.id)
                    }}
                  >
                    <span className={graphStyles.searchHitName}>{hit.name}</span>
                    <span className={graphStyles.searchHitMeta}>
                      {translateGraphNodeType(tr, hit.nodeType)}
                      {hit.summary ? ` · ${hit.summary}` : ''}
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className={graphStyles.toolbarRight}>
          <Button
            type="button"
            disabled={extracting || sourceCount === 0}
            onClick={onRebuildGraph ?? onStartExtract}
          >
            {t('knowledge.rebuild_graph_short', '重新抽取')}
          </Button>
        </div>
      </div>
    </div>
  )
}

export function NotebookGraphEmptyGuide({
  sourceCount,
  extracting,
  onStartExtract,
  onDismiss
}: {
  sourceCount: number
  extracting: boolean
  onStartExtract: () => void
  onDismiss: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={graphStyles.emptyGuide}>
      <div className={graphStyles.emptyGuideTitle}>
        {t('knowledge.graph_empty_title', '还没有开始整理这本笔记本的关系')}
      </div>
      <div className={graphStyles.emptyGuideBody}>
        {sourceCount > 0
          ? t(
              'knowledge.graph_empty_body',
              '发现 {{count}} 个来源可以分析。整理后会显示人物、地点和事件关系；人生关系图不会被改动。',
              { count: sourceCount }
            )
          : t(
              'knowledge.graph_empty_no_sources',
              '先导入资料，再开始整理这本笔记本里的关系。人生关系图是另一份数据，不会混进来。'
            )}
      </div>
      <div className={graphStyles.emptyGuideHint}>
        {t('graph.legend_pending', '虚线的关系伙伴还看不到，需要你确认。')}
      </div>
      <div className={graphStyles.rowActions}>
        <Button type="button" disabled={sourceCount === 0 || extracting} onClick={onStartExtract}>
          {t('graph.start_organize', '开始整理')}
        </Button>
        <Button type="button" onClick={onDismiss}>
          {t('graph.later', '以后再说')}
        </Button>
      </div>
    </div>
  )
}
