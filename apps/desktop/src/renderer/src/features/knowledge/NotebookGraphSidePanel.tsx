import React from 'react'
import { useTranslation } from 'react-i18next'
import { MdArticle, MdChevronLeft, MdChevronRight, MdSettings, MdTune } from 'react-icons/md'
import type { GraphAppearanceSettings, GraphFocusDepth, GraphForceSettings } from '@baishou/shared'
import { Button } from '@baishou/ui'
import { GraphCanvasSettingsPanel } from '../graph/GraphCanvasSettingsPanel'
import type { NotebookGraphProgressView } from './notebook-graph-progress.util'
import { NotebookGraphDetailTab } from './NotebookGraphDetailTab'
import { NotebookGraphPendingTab } from './NotebookGraphPendingTab'
import type { NotebookGraphViewEdge, NotebookGraphViewNode } from './notebook-graph-view.util'
import graphStyles from '../graph/GraphPage.module.css'

export type NotebookGraphSideTab = 'queue' | 'pending' | 'detail'
export type NotebookGraphSideMode = 'ops' | 'content' | 'settings'

export function NotebookGraphSidePanel({
  sideCollapsed,
  sideWidth,
  sideMode,
  tab,
  extracting,
  sourceCount,
  progress,
  pending,
  nodes,
  selectedNode,
  relatedEdges,
  pendingSelected,
  allPendingSelected,
  pendingSelectedCount,
  reviewBusy,
  focusDepth,
  appearanceSettings,
  forceSettings,
  tr,
  onSideResizeMouseDown,
  onOpenSide,
  onToggleCollapsed,
  onTabChange,
  onRebuildGraph,
  onStartExtract,
  onToggleSelectAll,
  onToggleItem,
  onApproveSelected,
  onRejectSelected,
  onApproveAll,
  onRejectAll,
  onReviewNode,
  onReviewEdge,
  onLocate,
  onFocusDepthChange,
  onAppearanceChange,
  onForceChange,
  onReplayLayout,
  onResetSettings,
  onPreviewFragments
}: {
  sideCollapsed: boolean
  sideWidth: number
  sideMode: NotebookGraphSideMode
  tab: NotebookGraphSideTab
  extracting: boolean
  sourceCount: number
  progress: NotebookGraphProgressView
  pending: { pendingNodes: NotebookGraphViewNode[]; pendingEdges: NotebookGraphViewEdge[] }
  nodes: NotebookGraphViewNode[]
  selectedNode: NotebookGraphViewNode | null
  relatedEdges: NotebookGraphViewEdge[]
  pendingSelected: Set<string>
  allPendingSelected: boolean
  pendingSelectedCount: number
  reviewBusy: boolean
  focusDepth: GraphFocusDepth
  appearanceSettings: GraphAppearanceSettings
  forceSettings: GraphForceSettings
  tr: (key: string, defaultValue?: string) => string
  onSideResizeMouseDown: (event: React.MouseEvent) => void
  onOpenSide: (mode: NotebookGraphSideMode) => void
  onToggleCollapsed: () => void
  onTabChange: (tab: NotebookGraphSideTab) => void
  onRebuildGraph?: () => void
  onStartExtract: () => void
  onToggleSelectAll: () => void
  onToggleItem: (key: string) => void
  onApproveSelected: () => void
  onRejectSelected: () => void
  onApproveAll: () => void
  onRejectAll: () => void
  onReviewNode: (nodeId: string, reviewStatus: 'approved' | 'rejected') => void
  onReviewEdge: (edgeId: string, reviewStatus: 'approved' | 'rejected') => void
  onLocate: (id: string) => void
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  onAppearanceChange: (patch: Partial<GraphAppearanceSettings>) => void
  onForceChange: (patch: Partial<GraphForceSettings>) => void
  onReplayLayout: () => void
  onResetSettings: () => void
  onPreviewFragments?: (edges: NotebookGraphViewEdge[]) => void
}) {
  const { t } = useTranslation()
  const pendingCount = pending.pendingNodes.length + pending.pendingEdges.length
  return (
    <div
      className={`${graphStyles.sideColumn} ${sideCollapsed ? graphStyles.sideColumnCollapsed : ''}`}
      style={sideCollapsed ? undefined : { ['--graph-side-width' as string]: `${sideWidth}px` }}
    >
      {!sideCollapsed ? (
        <div
          className={graphStyles.sideResizeSash}
          onMouseDown={onSideResizeMouseDown}
          aria-hidden
        />
      ) : null}
      <div className={graphStyles.sideRail}>
        <button
          type="button"
          className={`${graphStyles.railBtn} ${
            !sideCollapsed && sideMode === 'ops' ? graphStyles.railBtnActive : ''
          }`}
          title={t('graph.side_organize', '整理')}
          onClick={() => onOpenSide('ops')}
        >
          <MdTune size={18} />
        </button>
        <button
          type="button"
          className={`${graphStyles.railBtn} ${
            !sideCollapsed && sideMode === 'content' ? graphStyles.railBtnActive : ''
          }`}
          title={t('graph.side_content', '内容')}
          onClick={() => onOpenSide('content')}
        >
          <MdArticle size={18} />
        </button>
        <button
          type="button"
          className={`${graphStyles.railBtn} ${
            !sideCollapsed && sideMode === 'settings' ? graphStyles.railBtnActive : ''
          }`}
          title={t('graph.side_canvas', '画布')}
          onClick={() => onOpenSide('settings')}
        >
          <MdSettings size={18} />
        </button>
        <button
          type="button"
          className={`${graphStyles.railBtn} ${graphStyles.railCollapseBtn}`}
          title={
            sideCollapsed
              ? t('graph.expand_sidebar', '展开侧栏')
              : t('graph.collapse_sidebar', '收起侧栏')
          }
          onClick={onToggleCollapsed}
        >
          {sideCollapsed ? <MdChevronLeft size={18} /> : <MdChevronRight size={18} />}
        </button>
      </div>
      {!sideCollapsed ? (
        <aside className={graphStyles.side}>
          {sideMode === 'ops' ? (
            <>
              <div className={graphStyles.settingsHeader}>
                <div className={graphStyles.settingsTitle}>{t('graph.side_organize', '整理')}</div>
              </div>
              <div className={graphStyles.panel}>
                <div className={graphStyles.opsBlock}>
                  <Button
                    type="button"
                    disabled={extracting || sourceCount === 0}
                    onClick={onRebuildGraph ?? onStartExtract}
                  >
                    {t('knowledge.rebuild_graph', '重新抽取图谱')}
                  </Button>
                  {progress.visible ? (
                    <p className={graphStyles.empty}>{progress.detail}</p>
                  ) : (
                    <p className={graphStyles.empty}>
                      {t(
                        'knowledge.graph_ops_hint',
                        '重新抽取只会整理这本笔记本。人生关系图不会被改动。'
                      )}
                    </p>
                  )}
                </div>
              </div>
            </>
          ) : null}

          {sideMode === 'content' ? (
            <>
              <div className={graphStyles.tabs}>
                <button
                  type="button"
                  className={`${graphStyles.tab} ${tab === 'queue' ? graphStyles.tabActive : ''}`}
                  onClick={() => onTabChange('queue')}
                >
                  {t('knowledge.graph_tab_queue', '抽取')}
                </button>
                <button
                  type="button"
                  className={`${graphStyles.tab} ${tab === 'pending' ? graphStyles.tabActive : ''}`}
                  onClick={() => onTabChange('pending')}
                >
                  {t('graph.tab_pending_count', '待确认 ({{count}})', { count: pendingCount })}
                </button>
                <button
                  type="button"
                  className={`${graphStyles.tab} ${tab === 'detail' ? graphStyles.tabActive : ''}`}
                  onClick={() => onTabChange('detail')}
                >
                  {t('graph.tab_detail', '详情')}
                </button>
              </div>
              <div className={graphStyles.panel}>
                {tab === 'queue' ? (
                  progress.visible ? (
                    <div className={graphStyles.itemCompact}>
                      <div className={graphStyles.itemTitle}>{progress.headline}</div>
                      <div className={graphStyles.itemMetaCompact}>{progress.detail}</div>
                    </div>
                  ) : (
                    <div className={graphStyles.empty}>
                      {t('knowledge.graph_queue_idle', '当前没有正在抽取的资料')}
                    </div>
                  )
                ) : null}

                {tab === 'pending' ? (
                  <NotebookGraphPendingTab
                    pendingNodes={pending.pendingNodes}
                    pendingEdges={pending.pendingEdges}
                    nodes={nodes}
                    pendingSelected={pendingSelected}
                    allPendingSelected={allPendingSelected}
                    pendingSelectedCount={pendingSelectedCount}
                    reviewBusy={reviewBusy}
                    tr={tr}
                    onToggleSelectAll={onToggleSelectAll}
                    onToggleItem={onToggleItem}
                    onApproveSelected={onApproveSelected}
                    onRejectSelected={onRejectSelected}
                    onApproveAll={onApproveAll}
                    onRejectAll={onRejectAll}
                    onReviewNode={onReviewNode}
                    onReviewEdge={onReviewEdge}
                    onLocate={onLocate}
                  />
                ) : null}

                {tab === 'detail' ? (
                  <NotebookGraphDetailTab
                    selectedNode={selectedNode}
                    relatedEdges={relatedEdges}
                    nodes={nodes}
                    focusDepth={focusDepth}
                    reviewBusy={reviewBusy}
                    tr={tr}
                    onFocusDepthChange={onFocusDepthChange}
                    onReviewNode={onReviewNode}
                    onReviewEdge={onReviewEdge}
                    onLocate={onLocate}
                    onPreviewFragments={onPreviewFragments}
                  />
                ) : null}
              </div>
            </>
          ) : null}

          {sideMode === 'settings' ? (
            <>
              <div className={graphStyles.settingsHeader}>
                <div className={graphStyles.settingsTitle}>{t('graph.side_canvas', '画布')}</div>
                <button
                  type="button"
                  className={graphStyles.settingsReset}
                  title={t('graph.force_reset', '恢复默认')}
                  onClick={onResetSettings}
                >
                  {t('graph.force_reset', '恢复默认')}
                </button>
              </div>
              <div className={graphStyles.panel}>
                <GraphCanvasSettingsPanel
                  focusDepth={focusDepth}
                  appearanceSettings={appearanceSettings}
                  forceSettings={forceSettings}
                  onFocusDepthChange={onFocusDepthChange}
                  onAppearanceChange={onAppearanceChange}
                  onForceChange={onForceChange}
                  onReplayLayout={onReplayLayout}
                />
              </div>
            </>
          ) : null}
        </aside>
      ) : null}
    </div>
  )
}
