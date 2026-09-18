import React from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { Button, HelpTooltip, Input } from '@baishou/ui'
import type { NotebookGraphProgressView } from './notebook-graph-progress.util'
import graphStyles from '../graph/GraphPage.module.css'
import styles from './KnowledgePage.module.css'

export function NotebookGraphToolbar({
  query,
  extracting,
  sourceCount,
  progress,
  onQueryChange,
  onSearch,
  onRebuildGraph,
  onStartExtract
}: {
  query: string
  extracting: boolean
  sourceCount: number
  progress: NotebookGraphProgressView
  onQueryChange: (value: string) => void
  onSearch: () => void
  onRebuildGraph?: () => void
  onStartExtract: () => void
}) {
  const { t } = useTranslation()
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
          <div className={graphStyles.searchGroup}>
            <div className={graphStyles.searchField}>
              <Input
                fieldSize="small"
                placeholder={t('graph.search_placeholder', '搜索实体 / 别名')}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void onSearch()
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
      {progress.visible ? (
        <div className={styles.graphProgress}>
          <div className={styles.graphProgressText}>
            <strong>{progress.headline}</strong>
            <span>{progress.detail}</span>
          </div>
          <div
            className={styles.graphProgressBar}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress.percent}
          >
            <div
              className={styles.graphProgressFill}
              style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
            />
          </div>
        </div>
      ) : null}
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
