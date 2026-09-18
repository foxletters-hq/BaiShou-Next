import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
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
  type GraphFocusDepth,
  type GraphForceSettings
} from '@baishou/shared'
import { toast, useDialog } from '@baishou/ui'
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
import {
  NOTEBOOK_GRAPH_SIDE_WIDTH_MAX,
  NOTEBOOK_GRAPH_SIDE_WIDTH_MIN,
  loadNotebookGraphSideCollapsed,
  loadNotebookGraphSideWidth,
  persistNotebookGraphSideCollapsed,
  persistNotebookGraphSideWidth
} from './notebook-graph-side.util'
import { NotebookGraphEmptyGuide, NotebookGraphToolbar } from './NotebookGraphToolbar'
import {
  NotebookGraphSidePanel,
  type NotebookGraphSideMode,
  type NotebookGraphSideTab
} from './NotebookGraphSidePanel'
import graphStyles from '../graph/GraphPage.module.css'
import styles from './KnowledgePage.module.css'

export const NotebookGraphPane: React.FC<{
  notebookId: string
  sourceCount: number
  progress: NotebookGraphProgressView
  extracting: boolean
  reloadKey: string
  onStartExtract: () => void
  onRebuildGraph?: () => void
  onPreviewFragments?: (edges: NotebookGraphViewEdge[]) => void
}> = ({
  notebookId,
  sourceCount,
  progress,
  extracting,
  reloadKey,
  onStartExtract,
  onRebuildGraph,
  onPreviewFragments
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
  const [sideMode, setSideMode] = useState<NotebookGraphSideMode>('content')
  const [tab, setTab] = useState<NotebookGraphSideTab>('detail')
  const [sideWidth, setSideWidth] = useState(loadNotebookGraphSideWidth)
  const [sideCollapsed, setSideCollapsed] = useState(loadNotebookGraphSideCollapsed)

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
    persistNotebookGraphSideCollapsed(false)
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
  const displayNodes = nodes
  const displayEdges = useMemo(() => {
    const idSet = new Set(displayNodes.map((node) => node.id))
    return edges.filter((edge) => idSet.has(edge.fromId) && idSet.has(edge.toId))
  }, [displayNodes, edges])
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
    min: NOTEBOOK_GRAPH_SIDE_WIDTH_MIN,
    max: NOTEBOOK_GRAPH_SIDE_WIDTH_MAX,
    getWidth: () => sideWidth,
    onResize: setSideWidth,
    onCommit: (next) => persistNotebookGraphSideWidth(next)
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
    persistNotebookGraphSideCollapsed(collapsed)
  }

  const openSide = (mode: NotebookGraphSideMode) => {
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
      ? {
          nodeIds: pending.pendingNodes.map((node) => node.id),
          edgeIds: pending.pendingEdges.map((edge) => edge.id)
        }
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
    <div
      className={styles.notebookGraphHost}
      aria-label={t('knowledge.graph_panel', '笔记本内关系')}
    >
      <div className={graphStyles.root}>
        <div
          className={`${graphStyles.mainPhase} ${showEmptyGuide ? graphStyles.mainPhaseEmpty : ''}`}
        >
          <NotebookGraphToolbar
            query={query}
            extracting={extracting}
            sourceCount={sourceCount}
            progress={progress}
            onQueryChange={setQuery}
            onSearch={() => void onSearch()}
            onRebuildGraph={onRebuildGraph}
            onStartExtract={onStartExtract}
          />

          <div className={graphStyles.canvasWrap}>
            {showEmptyGuide ? (
              <NotebookGraphEmptyGuide
                sourceCount={sourceCount}
                extracting={extracting}
                onStartExtract={onStartExtract}
                onDismiss={() => setDismissGuide(true)}
              />
            ) : (
              <GraphForceCanvas
                nodes={displayNodes}
                edges={displayEdges}
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
            <NotebookGraphSidePanel
              sideCollapsed={sideCollapsed}
              sideWidth={sideWidth}
              sideMode={sideMode}
              tab={tab}
              extracting={extracting}
              sourceCount={sourceCount}
              progress={progress}
              pending={pending}
              nodes={nodes}
              selectedNode={selectedNode}
              relatedEdges={relatedEdges}
              pendingSelected={pendingSelected}
              allPendingSelected={allPendingSelected}
              pendingSelectedCount={pendingSelectedCount}
              reviewBusy={reviewBusy}
              focusDepth={focusDepth}
              appearanceSettings={appearanceSettings}
              forceSettings={forceSettings}
              tr={tr}
              onSideResizeMouseDown={sideResize.onMouseDown}
              onOpenSide={openSide}
              onToggleCollapsed={() => persistCollapsed(!sideCollapsed)}
              onTabChange={setTab}
              onRebuildGraph={onRebuildGraph}
              onStartExtract={onStartExtract}
              onToggleSelectAll={toggleSelectAllPending}
              onToggleItem={togglePendingItem}
              onApproveSelected={() => void applyPendingReviews({ reviewStatus: 'approved' })}
              onRejectSelected={() => void applyPendingReviews({ reviewStatus: 'rejected' })}
              onApproveAll={() =>
                void applyPendingReviews({ reviewStatus: 'approved', allPending: true })
              }
              onRejectAll={() =>
                void applyPendingReviews({ reviewStatus: 'rejected', allPending: true })
              }
              onReviewNode={(nodeId, reviewStatus) => void reviewNode(nodeId, reviewStatus)}
              onReviewEdge={(edgeId, reviewStatus) => void reviewEdge(edgeId, reviewStatus)}
              onLocate={locateNode}
              onFocusDepthChange={updateFocusDepth}
              onAppearanceChange={updateAppearance}
              onForceChange={updateForce}
              onReplayLayout={() => setAnimationTick((n) => n + 1)}
              onResetSettings={resetGraphSettings}
              onPreviewFragments={onPreviewFragments}
            />
          ) : null}
        </div>
      </div>
    </div>
  )
}
