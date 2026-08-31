import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { MdArticle, MdChevronLeft, MdChevronRight, MdSettings, MdTune } from 'react-icons/md'
import {
  GRAPH_FOCUS_DEPTH_OPTIONS,
  GRAPH_APPEARANCE_DEFAULTS,
  GRAPH_FORCE_DEFAULTS,
  asGraphTranslateFn,
  clampGraphAppearanceSettings,
  clampGraphFocusDepth,
  clampGraphForceSettings,
  collectGraphFocusIds,
  graphPendingItemKey,
  loadGraphAppearanceSettings,
  loadGraphFocusDepth,
  loadGraphForceSettings,
  saveGraphAppearanceSettings,
  saveGraphFocusDepth,
  saveGraphForceSettings,
  splitGraphReviewSelection,
  type GraphAppearanceSettings,
  translateGraphEdgeType,
  translateGraphNodeType,
  type GraphFocusDepth,
  type GraphForceSettings
} from '@baishou/shared'
import { Checkbox, HelpTooltip, Input, toast, useDialog } from '@baishou/ui'
import { GraphCanvasSettingsPanel } from '../graph/GraphCanvasSettingsPanel'
import { GraphForceCanvas } from '../graph/GraphForceCanvas'
import { usePanelResize } from '../agent-workspace/workbench/usePanelResize'
import { callKnowledgeApi } from './call-knowledge-api'
import {
  remapNotebookGraphReviewForDisplay,
  splitNotebookGraphPending,
  type NotebookGraphViewEdge,
  type NotebookGraphViewNode
} from './notebook-graph-view.util'
import type { NotebookGraphProgressView } from './notebook-graph-progress.util'
import graphStyles from '../graph/GraphPage.module.css'
import styles from './KnowledgePage.module.css'

const SIDE_WIDTH_KEY = 'baishou.notebook.graph.sideWidth.v1'
const SIDE_COLLAPSED_KEY = 'baishou.notebook.graph.sideCollapsed.v1'
const SIDE_WIDTH_MIN = 260
const SIDE_WIDTH_MAX = 520
const SIDE_WIDTH_DEFAULT = 300

type SideTab = 'queue' | 'pending' | 'detail'
type SideMode = 'ops' | 'content' | 'settings'

function loadSideWidth(): number {
  try {
    const n = Number(localStorage.getItem(SIDE_WIDTH_KEY))
    if (Number.isFinite(n)) return Math.min(SIDE_WIDTH_MAX, Math.max(SIDE_WIDTH_MIN, n))
  } catch {
    /* ignore */
  }
  return SIDE_WIDTH_DEFAULT
}

function loadSideCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDE_COLLAPSED_KEY) === '1'
  } catch {
    return false
  }
}

export const NotebookGraphPane: React.FC<{
  notebookId: string
  sourceCount: number
  progress: NotebookGraphProgressView
  extracting: boolean
  reloadKey: string
  onStartExtract: () => void
  onPreviewSource?: (sourceId: string) => void
}> = ({
  notebookId,
  sourceCount,
  progress,
  extracting,
  reloadKey,
  onStartExtract,
  onPreviewSource
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const tr = asGraphTranslateFn(t)
  const [reviewBusy, setReviewBusy] = useState(false)
  const [pendingSelected, setPendingSelected] = useState<Set<string>>(() => new Set())
  const [nodes, setNodes] = useState<NotebookGraphViewNode[]>([])
  const [edges, setEdges] = useState<NotebookGraphViewEdge[]>([])
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [highlightIds, setHighlightIds] = useState<Set<string>>(new Set())
  const [locateIds, setLocateIds] = useState<string[] | null>(null)
  const [locateSeq, setLocateSeq] = useState(0)
  const [focusDepth, setFocusDepth] = useState<GraphFocusDepth>(() => loadGraphFocusDepth())
  const [forceSettings, setForceSettings] = useState<GraphForceSettings>(() =>
    clampGraphForceSettings(loadGraphForceSettings())
  )
  const [appearanceSettings, setAppearanceSettings] = useState<GraphAppearanceSettings>(() =>
    clampGraphAppearanceSettings(loadGraphAppearanceSettings())
  )
  const [animationTick, setAnimationTick] = useState(0)
  const [dismissGuide, setDismissGuide] = useState(false)
  const [sideMode, setSideMode] = useState<SideMode>('content')
  const [tab, setTab] = useState<SideTab>('detail')
  const [sideWidth, setSideWidth] = useState(loadSideWidth)
  const [sideCollapsed, setSideCollapsed] = useState(loadSideCollapsed)

  const loadView = useCallback(async () => {
    if (!notebookId) return
    try {
      const view = await callKnowledgeApi<{
        nodes: NotebookGraphViewNode[]
        edges: NotebookGraphViewEdge[]
      }>('getGraphView', 'knowledge:get-graph-view', { notebookId, maxNodes: 400 })
      const remapped = remapNotebookGraphReviewForDisplay(view?.nodes || [], view?.edges || [])
      setNodes(remapped.nodes)
      setEdges(remapped.edges)
    } catch {
      setNodes([])
      setEdges([])
    }
  }, [notebookId])

  useEffect(() => {
    void loadView()
  }, [loadView, reloadKey])

  useEffect(() => {
    if (!progress.visible) return
    setTab('queue')
    setSideMode('content')
    setSideCollapsed(false)
    try {
      localStorage.setItem(SIDE_COLLAPSED_KEY, '0')
    } catch {
      /* ignore */
    }
  }, [progress.visible])

  const pending = useMemo(() => splitNotebookGraphPending(nodes, edges), [nodes, edges])
  const pendingCount = pending.pendingNodes.length + pending.pendingEdges.length
  const pendingItemKeys = useMemo(
    () => [
      ...pending.pendingNodes.map((node) => graphPendingItemKey('node', node.id)),
      ...pending.pendingEdges.map((edge) => graphPendingItemKey('edge', edge.id))
    ],
    [pending.pendingEdges, pending.pendingNodes]
  )
  const pendingSelectedCount = pendingItemKeys.filter((key) => pendingSelected.has(key)).length
  const allPendingSelected =
    pendingItemKeys.length > 0 && pendingSelectedCount === pendingItemKeys.length
  const selectedNode = nodes.find((node) => node.id === selectedId) || null
  const showEmptyGuide = nodes.length === 0 && !dismissGuide && !extracting
  const focusIds = useMemo(
    () =>
      selectedId
        ? collectGraphFocusIds(
            selectedId,
            edges.map((edge) => ({ fromId: edge.fromId, toId: edge.toId })),
            focusDepth
          )
        : new Set<string>(),
    [edges, focusDepth, selectedId]
  )

  const sideResize = usePanelResize({
    invertDelta: true,
    min: SIDE_WIDTH_MIN,
    max: SIDE_WIDTH_MAX,
    getWidth: () => sideWidth,
    onResize: setSideWidth,
    onCommit: (next) => {
      try {
        localStorage.setItem(SIDE_WIDTH_KEY, String(next))
      } catch {
        /* ignore */
      }
    }
  })

  const updateForce = (patch: Partial<GraphForceSettings>) => {
    setForceSettings((prev) => {
      const next = clampGraphForceSettings({ ...prev, ...patch })
      saveGraphForceSettings(next)
      return next
    })
  }

  const updateAppearance = (patch: Partial<GraphAppearanceSettings>) => {
    setAppearanceSettings((prev) => {
      const next = clampGraphAppearanceSettings({ ...prev, ...patch })
      saveGraphAppearanceSettings(next)
      return next
    })
  }

  const updateFocusDepth = (depth: GraphFocusDepth) => {
    const next = clampGraphFocusDepth(depth)
    setFocusDepth(next)
    saveGraphFocusDepth(next)
  }

  const resetGraphSettings = () => {
    setForceSettings({ ...GRAPH_FORCE_DEFAULTS })
    saveGraphForceSettings({ ...GRAPH_FORCE_DEFAULTS })
    setAppearanceSettings({ ...GRAPH_APPEARANCE_DEFAULTS })
    saveGraphAppearanceSettings({ ...GRAPH_APPEARANCE_DEFAULTS })
  }

  const persistCollapsed = (collapsed: boolean) => {
    setSideCollapsed(collapsed)
    try {
      localStorage.setItem(SIDE_COLLAPSED_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }

  const openSide = (mode: SideMode) => {
    setSideMode(mode)
    persistCollapsed(false)
  }

  const onSearch = async () => {
    const q = query.trim()
    if (!q) return
    try {
      const hits = await callKnowledgeApi<NotebookGraphViewNode[]>(
        'graphSearch',
        'knowledge:graph-search',
        { notebookId, query: q, limit: 20 }
      )
      const ids = (hits || []).map((hit) => hit.id)
      if (ids.length === 0) return
      setHighlightIds(new Set(ids))
      setLocateIds(ids)
      setLocateSeq((n) => n + 1)
      setSelectedId(ids[0] ?? null)
      setTab('detail')
      openSide('content')
    } catch {
      /* ignore */
    }
  }

  const locateNode = (id: string) => {
    setSelectedId(id)
    setHighlightIds(new Set([id]))
    setLocateIds([id])
    setLocateSeq((n) => n + 1)
    setTab('detail')
  }

  const togglePendingItem = (key: string) => {
    setPendingSelected((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleSelectAllPending = () => {
    setPendingSelected(allPendingSelected ? new Set() : new Set(pendingItemKeys))
  }

  const reviewNode = async (nodeId: string, reviewStatus: 'approved' | 'rejected') => {
    setReviewBusy(true)
    try {
      await callKnowledgeApi('setGraphNodeReview', 'knowledge:set-graph-node-review', {
        notebookId,
        nodeId,
        reviewStatus
      })
      await loadView()
      toast.showSuccess(
        reviewStatus === 'approved'
          ? t('graph.batch_approved', '已通过 {{count}} 项', { count: 1 })
          : t('graph.batch_rejected', '已拒绝 {{count}} 项', { count: 1 })
      )
    } catch (error) {
      toast.showError(String((error as Error)?.message || error))
    } finally {
      setReviewBusy(false)
    }
  }

  const reviewEdge = async (edgeId: string, reviewStatus: 'approved' | 'rejected') => {
    setReviewBusy(true)
    try {
      await callKnowledgeApi('setGraphEdgeReview', 'knowledge:set-graph-edge-review', {
        notebookId,
        edgeId,
        reviewStatus
      })
      await loadView()
      toast.showSuccess(
        reviewStatus === 'approved'
          ? t('graph.batch_approved', '已通过 {{count}} 项', { count: 1 })
          : t('graph.batch_rejected', '已拒绝 {{count}} 项', { count: 1 })
      )
    } catch (error) {
      toast.showError(String((error as Error)?.message || error))
    } finally {
      setReviewBusy(false)
    }
  }

  const applyPendingReviews = async (opts: {
    reviewStatus: 'approved' | 'rejected'
    allPending?: boolean
  }) => {
    const selected = opts.allPending
      ? { nodeIds: pending.pendingNodes.map((node) => node.id), edgeIds: pending.pendingEdges.map((edge) => edge.id) }
      : splitGraphReviewSelection(pendingItemKeys.filter((key) => pendingSelected.has(key)))
    const count = opts.allPending ? pendingCount : pendingSelectedCount
    if (count === 0) return
    if (opts.reviewStatus === 'rejected' || opts.allPending) {
      const ok = await dialog.confirm(
        opts.allPending
          ? opts.reviewStatus === 'approved'
            ? t(
                'graph.confirm_approve_all',
                '将通过全部 {{count}} 项待确认内容。通过节点时会同时通过相连的待审关系。',
                { count }
              )
            : t(
                'graph.confirm_reject_all',
                '将拒绝全部 {{count}} 项待确认内容。拒绝节点时会同时拒绝与它相连的关系。',
                { count }
              )
          : t(
              'graph.confirm_reject_selected',
              '将拒绝已选的 {{count}} 项。拒绝节点时会同时拒绝与它相连的关系。',
              { count }
            ),
        opts.allPending
          ? opts.reviewStatus === 'approved'
            ? t('graph.approve_all', '全部通过')
            : t('graph.reject_all', '全部拒绝')
          : t('graph.reject_selected', '拒绝所选')
      )
      if (!ok) return
    }
    setReviewBusy(true)
    try {
      await callKnowledgeApi('setGraphReviewsBatch', 'knowledge:set-graph-reviews-batch', {
        notebookId,
        reviewStatus: opts.reviewStatus,
        allPending: opts.allPending,
        nodeIds: selected.nodeIds,
        edgeIds: selected.edgeIds
      })
      setPendingSelected(new Set())
      await loadView()
      toast.showSuccess(
        opts.reviewStatus === 'approved'
          ? t('graph.batch_approved', '已通过 {{count}} 项', { count })
          : t('graph.batch_rejected', '已拒绝 {{count}} 项', { count })
      )
    } catch (error) {
      toast.showError(String((error as Error)?.message || error))
    } finally {
      setReviewBusy(false)
    }
  }

  const relatedEdges = edges.filter(
    (edge) => edge.fromId === selectedId || edge.toId === selectedId
  )

  return (
    <div className={styles.notebookGraphHost} aria-label={t('knowledge.graph_panel', '笔记本内关系')}>
      <div className={graphStyles.root}>
        <div
          className={`${graphStyles.mainPhase} ${showEmptyGuide ? graphStyles.mainPhaseEmpty : ''}`}
        >
          <div className={graphStyles.chrome}>
            <div className={`${graphStyles.toolbar} ${styles.notebookGraphToolbar}`}>
              <div className={graphStyles.toolbarLeft}>
                <div className={graphStyles.titleRow}>
                  <div className={graphStyles.title}>
                    {t('knowledge.graph_panel', '笔记本内关系')}
                  </div>
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
                      onChange={(event) => setQuery(event.target.value)}
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
                <button
                  type="button"
                  className={graphStyles.btn}
                  disabled={extracting || sourceCount === 0}
                  onClick={onStartExtract}
                >
                  {t('knowledge.rebuild_graph_short', '重新抽取')}
                </button>
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

          <div className={graphStyles.canvasWrap}>
            {showEmptyGuide ? (
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
                  <button
                    type="button"
                    className={graphStyles.btnPrimary}
                    disabled={sourceCount === 0 || extracting}
                    onClick={onStartExtract}
                  >
                    {t('graph.start_organize', '开始整理')}
                  </button>
                  <button
                    type="button"
                    className={graphStyles.btn}
                    onClick={() => setDismissGuide(true)}
                  >
                    {t('graph.later', '以后再说')}
                  </button>
                </div>
              </div>
            ) : (
              <GraphForceCanvas
                nodes={nodes}
                edges={edges}
                highlightIds={highlightIds}
                locateIds={locateIds ?? undefined}
                focusIds={focusIds}
                selectedId={selectedId}
                locateSeq={locateSeq}
                forceSettings={forceSettings}
                appearanceSettings={appearanceSettings}
                animationTick={animationTick}
                onSelectNode={(id) => {
                  setSelectedId(id)
                  setTab('detail')
                  openSide('content')
                }}
                onClearSelection={() => {
                  setSelectedId(null)
                  setHighlightIds(new Set())
                  setLocateIds(null)
                }}
              />
            )}
          </div>

          {!showEmptyGuide ? (
            <div
              className={`${graphStyles.sideColumn} ${
                sideCollapsed ? graphStyles.sideColumnCollapsed : ''
              }`}
              style={
                sideCollapsed
                  ? undefined
                  : { ['--graph-side-width' as string]: `${sideWidth}px` }
              }
            >
              {!sideCollapsed ? (
                <div
                  className={graphStyles.sideResizeSash}
                  onMouseDown={sideResize.onMouseDown}
                  aria-hidden
                />
              ) : null}
              <div className={graphStyles.sideRail}>
                <button
                  type="button"
                  className={`${graphStyles.railBtn} ${
                    !sideCollapsed && sideMode === 'ops' ? graphStyles.railBtnActive : ''
                  }`}
                  title={t('graph.side_ops', '操作')}
                  onClick={() => openSide('ops')}
                >
                  <MdTune size={18} />
                </button>
                <button
                  type="button"
                  className={`${graphStyles.railBtn} ${
                    !sideCollapsed && sideMode === 'content' ? graphStyles.railBtnActive : ''
                  }`}
                  title={t('graph.side_content', '内容')}
                  onClick={() => openSide('content')}
                >
                  <MdArticle size={18} />
                </button>
                <button
                  type="button"
                  className={`${graphStyles.railBtn} ${
                    !sideCollapsed && sideMode === 'settings' ? graphStyles.railBtnActive : ''
                  }`}
                  title={t('graph.side_settings', '设置')}
                  onClick={() => openSide('settings')}
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
                  onClick={() => persistCollapsed(!sideCollapsed)}
                >
                  {sideCollapsed ? <MdChevronLeft size={18} /> : <MdChevronRight size={18} />}
                </button>
              </div>
              {!sideCollapsed ? (
                <aside className={graphStyles.side}>
                  {sideMode === 'ops' ? (
                    <>
                      <div className={graphStyles.settingsHeader}>
                        <div className={graphStyles.settingsTitle}>{t('graph.side_ops', '操作')}</div>
                      </div>
                      <div className={graphStyles.panel}>
                        <div className={graphStyles.opsBlock}>
                          <button
                            type="button"
                            className={`${graphStyles.btnPrimary} ${graphStyles.opsFullBtn}`}
                            disabled={extracting || sourceCount === 0}
                            onClick={onStartExtract}
                          >
                            {t('knowledge.rebuild_graph', '重新抽取图谱')}
                          </button>
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
                          onClick={() => setTab('queue')}
                        >
                          {t('knowledge.graph_tab_queue', '抽取')}
                        </button>
                        <button
                          type="button"
                          className={`${graphStyles.tab} ${tab === 'pending' ? graphStyles.tabActive : ''}`}
                          onClick={() => setTab('pending')}
                        >
                          {t('graph.tab_pending_count', '待确认 ({{count}})', {
                            count: pendingCount
                          })}
                        </button>
                        <button
                          type="button"
                          className={`${graphStyles.tab} ${tab === 'detail' ? graphStyles.tabActive : ''}`}
                          onClick={() => setTab('detail')}
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
                          pendingCount === 0 ? (
                            <div className={graphStyles.empty}>
                              {t('graph.no_pending', '暂无待确认内容')}
                            </div>
                          ) : (
                            <>
                              <div className={graphStyles.pendingSticky}>
                                <p className={graphStyles.pendingHint}>
                                  {t(
                                    'graph.pending_hint',
                                    '确认关系会同时通过两端节点；确认节点也会通过与它相连的待审关系。可勾选后批量处理。'
                                  )}
                                </p>
                                <div className={graphStyles.pendingToolbar}>
                                  <label className={graphStyles.pendingSelectAll}>
                                    <Checkbox
                                      checked={allPendingSelected}
                                      indeterminate={pendingSelectedCount > 0 && !allPendingSelected}
                                      onChange={toggleSelectAllPending}
                                    />
                                    {allPendingSelected
                                      ? t('graph.pending_deselect_all', '取消全选')
                                      : t('graph.pending_select_all', '全选')}
                                  </label>
                                  <span className={graphStyles.pendingSelectedCount}>
                                    {t('graph.pending_selected_count', '已选 {{count}} 项', {
                                      count: pendingSelectedCount
                                    })}
                                  </span>
                                  <div className={graphStyles.pendingToolbarBtns}>
                                    <button
                                      type="button"
                                      className={graphStyles.linkBtn}
                                      disabled={reviewBusy || pendingSelectedCount === 0}
                                      onClick={() =>
                                        void applyPendingReviews({ reviewStatus: 'approved' })
                                      }
                                    >
                                      {t('graph.approve_selected', '通过所选')}
                                    </button>
                                    <button
                                      type="button"
                                      className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                                      disabled={reviewBusy || pendingSelectedCount === 0}
                                      onClick={() =>
                                        void applyPendingReviews({ reviewStatus: 'rejected' })
                                      }
                                    >
                                      {t('graph.reject_selected', '拒绝所选')}
                                    </button>
                                    <button
                                      type="button"
                                      className={graphStyles.linkBtn}
                                      disabled={reviewBusy}
                                      onClick={() =>
                                        void applyPendingReviews({
                                          reviewStatus: 'approved',
                                          allPending: true
                                        })
                                      }
                                    >
                                      {t('graph.approve_all', '全部通过')}
                                    </button>
                                    <button
                                      type="button"
                                      className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                                      disabled={reviewBusy}
                                      onClick={() =>
                                        void applyPendingReviews({
                                          reviewStatus: 'rejected',
                                          allPending: true
                                        })
                                      }
                                    >
                                      {t('graph.reject_all', '全部拒绝')}
                                    </button>
                                  </div>
                                </div>
                              </div>
                              {pending.pendingNodes.map((node) => {
                                const key = graphPendingItemKey('node', node.id)
                                return (
                                  <div key={node.id} className={graphStyles.itemCompact}>
                                    <div className={graphStyles.itemRow}>
                                      <label className={graphStyles.pendingCheckLabel}>
                                        <Checkbox
                                          checked={pendingSelected.has(key)}
                                          onChange={() => togglePendingItem(key)}
                                        />
                                        <span className={graphStyles.itemTitle}>
                                          {t('graph.pending_node', '节点')} · {node.name}
                                        </span>
                                      </label>
                                      <div className={graphStyles.rowActionsInline}>
                                        <button
                                          type="button"
                                          className={graphStyles.linkBtn}
                                          disabled={reviewBusy}
                                          onClick={() => void reviewNode(node.id, 'approved')}
                                        >
                                          {t('graph.approve', '通过')}
                                        </button>
                                        <button
                                          type="button"
                                          className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                                          disabled={reviewBusy}
                                          onClick={() => void reviewNode(node.id, 'rejected')}
                                        >
                                          {t('graph.reject', '拒绝')}
                                        </button>
                                        <button
                                          type="button"
                                          className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                                          onClick={() => locateNode(node.id)}
                                        >
                                          {t('graph.view', '查看')}
                                        </button>
                                      </div>
                                    </div>
                                    <div className={graphStyles.itemMetaCompact}>
                                      {translateGraphNodeType(tr, node.nodeType)}
                                    </div>
                                  </div>
                                )
                              })}
                              {pending.pendingEdges.map((edge) => {
                                const key = graphPendingItemKey('edge', edge.id)
                                const fromName =
                                  nodes.find((node) => node.id === edge.fromId)?.name || edge.fromId
                                const toName =
                                  nodes.find((node) => node.id === edge.toId)?.name || edge.toId
                                return (
                                  <div key={edge.id} className={graphStyles.itemCompact}>
                                    <div className={graphStyles.itemRow}>
                                      <label className={graphStyles.pendingCheckLabel}>
                                        <Checkbox
                                          checked={pendingSelected.has(key)}
                                          onChange={() => togglePendingItem(key)}
                                        />
                                        <span className={graphStyles.itemTitle}>
                                          {t('graph.pending_edge', '关系')} ·{' '}
                                          {translateGraphEdgeType(tr, edge.edgeType)}
                                        </span>
                                      </label>
                                      <div className={graphStyles.rowActionsInline}>
                                        <button
                                          type="button"
                                          className={graphStyles.linkBtn}
                                          disabled={reviewBusy}
                                          onClick={() => void reviewEdge(edge.id, 'approved')}
                                        >
                                          {t('graph.approve', '通过')}
                                        </button>
                                        <button
                                          type="button"
                                          className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                                          disabled={reviewBusy}
                                          onClick={() => void reviewEdge(edge.id, 'rejected')}
                                        >
                                          {t('graph.reject', '拒绝')}
                                        </button>
                                        <button
                                          type="button"
                                          className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                                          onClick={() => locateNode(edge.fromId)}
                                        >
                                          {t('graph.view', '查看')}
                                        </button>
                                      </div>
                                    </div>
                                    <div className={graphStyles.itemMetaCompact}>
                                      {fromName} → {toName}
                                      {edge.sourceExcerpt ? ` · ${edge.sourceExcerpt}` : ''}
                                    </div>
                                  </div>
                                )
                              })}
                            </>
                          )
                        ) : null}

                        {tab === 'detail' ? (
                          !selectedNode ? (
                            <div className={graphStyles.empty}>
                              {t('graph.click_node_for_detail', '点击画布节点查看详情')}
                            </div>
                          ) : (
                            <>
                              <div className={graphStyles.detailDepthRow}>
                                <div className={graphStyles.detailDepthMeta}>
                                  <span className={graphStyles.detailLabel}>
                                    {t('graph.focus_depth', '展开等级')}
                                  </span>
                                </div>
                                <div className={graphStyles.depthSeg} role="radiogroup">
                                  {GRAPH_FOCUS_DEPTH_OPTIONS.map((depth) => (
                                    <button
                                      key={depth}
                                      type="button"
                                      role="radio"
                                      aria-checked={focusDepth === depth}
                                      className={`${graphStyles.depthBtn} ${
                                        focusDepth === depth ? graphStyles.depthBtnActive : ''
                                      }`}
                                      onClick={() => {
                                        const next = clampGraphFocusDepth(depth)
                                        setFocusDepth(next)
                                        saveGraphFocusDepth(next)
                                      }}
                                    >
                                      {depth}
                                      {t('graph.focus_depth_unit', '级')}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className={graphStyles.detailBlock}>
                                <div className={graphStyles.detailLabel}>
                                  {t('graph.label_name', '名称')}
                                </div>
                                <div className={graphStyles.itemTitle}>{selectedNode.name}</div>
                              </div>
                              <div className={graphStyles.detailBlock}>
                                <div className={graphStyles.detailLabel}>
                                  {t('graph.label_type', '类型')}
                                </div>
                                <div>{translateGraphNodeType(tr, selectedNode.nodeType)}</div>
                              </div>
                              {selectedNode.summary ? (
                                <div className={graphStyles.detailBlock}>
                                  <div className={graphStyles.detailLabel}>
                                    {t('graph.label_summary', '摘要')}
                                  </div>
                                  <div>{selectedNode.summary}</div>
                                </div>
                              ) : null}
                              <div className={graphStyles.detailBlock}>
                                <div className={graphStyles.detailLabel}>
                                  {t('graph.label_mentions', '提及')}
                                </div>
                                <div>{selectedNode.mentionCount ?? 0}</div>
                              </div>
                              {selectedNode.reviewStatus === 'pending' ? (
                                <div className={graphStyles.rowActions}>
                                  <button
                                    type="button"
                                    className={graphStyles.btnPrimary}
                                    disabled={reviewBusy}
                                    onClick={() => void reviewNode(selectedNode.id, 'approved')}
                                  >
                                    {t('graph.approve', '通过')}
                                  </button>
                                  <button
                                    type="button"
                                    className={graphStyles.btn}
                                    disabled={reviewBusy}
                                    onClick={() => void reviewNode(selectedNode.id, 'rejected')}
                                  >
                                    {t('graph.reject', '拒绝')}
                                  </button>
                                </div>
                              ) : null}
                              {relatedEdges.length > 0 ? (
                                <div className={graphStyles.detailBlock}>
                                  <div className={graphStyles.detailLabel}>
                                    {t('graph.label_relations', '关系')}
                                  </div>
                                  {relatedEdges.map((edge) => {
                                    const otherId =
                                      edge.fromId === selectedNode.id ? edge.toId : edge.fromId
                                    const other = nodes.find((node) => node.id === otherId)
                                    return (
                                      <div key={edge.id} className={graphStyles.itemRow}>
                                        <button
                                          type="button"
                                          className={graphStyles.linkBtn}
                                          onClick={() => locateNode(otherId)}
                                        >
                                          {translateGraphEdgeType(tr, edge.edgeType)} ·{' '}
                                          {other?.name || otherId}
                                          {edge.reviewStatus === 'pending'
                                            ? ` · ${t('graph.pending_badge', '待确认')}`
                                            : ''}
                                        </button>
                                        {edge.reviewStatus === 'pending' ? (
                                          <div className={graphStyles.rowActionsInline}>
                                            <button
                                              type="button"
                                              className={graphStyles.linkBtn}
                                              disabled={reviewBusy}
                                              onClick={() => void reviewEdge(edge.id, 'approved')}
                                            >
                                              {t('graph.approve', '通过')}
                                            </button>
                                            <button
                                              type="button"
                                              className={`${graphStyles.linkBtn} ${graphStyles.linkBtnMuted}`}
                                              disabled={reviewBusy}
                                              onClick={() => void reviewEdge(edge.id, 'rejected')}
                                            >
                                              {t('graph.reject', '拒绝')}
                                            </button>
                                          </div>
                                        ) : null}
                                      </div>
                                    )
                                  })}
                                </div>
                              ) : null}
                              {(() => {
                                const sourceId = relatedEdges
                                  .map((edge) => edge.sourceRef?.split('#')[0]?.trim() || '')
                                  .find(Boolean)
                                if (!sourceId || !onPreviewSource) return null
                                return (
                                  <button
                                    type="button"
                                    className={graphStyles.btn}
                                    onClick={() => onPreviewSource(sourceId)}
                                  >
                                    {t('graph.source', '原文')}
                                  </button>
                                )
                              })()}
                            </>
                          )
                        ) : null}
                      </div>
                    </>
                  ) : null}

                  {sideMode === 'settings' ? (
                    <>
                      <div className={graphStyles.settingsHeader}>
                        <div className={graphStyles.settingsTitle}>
                          {t('graph.side_settings', '设置')}
                        </div>
                        <button
                          type="button"
                          className={graphStyles.settingsReset}
                          title={t('graph.force_reset', '恢复默认')}
                          onClick={resetGraphSettings}
                        >
                          {t('graph.force_reset', '恢复默认')}
                        </button>
                      </div>
                      <div className={graphStyles.panel}>
                        <GraphCanvasSettingsPanel
                          focusDepth={focusDepth}
                          appearanceSettings={appearanceSettings}
                          forceSettings={forceSettings}
                          onFocusDepthChange={updateFocusDepth}
                          onAppearanceChange={updateAppearance}
                          onForceChange={updateForce}
                          onReplayLayout={() => setAnimationTick((n) => n + 1)}
                        />
                      </div>
                    </>
                  ) : null}
                </aside>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
