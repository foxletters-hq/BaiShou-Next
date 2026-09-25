import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import { MemoryReadinessBar } from '../memory/MemoryReadinessBar'
import { GraphAwakenWelcome } from './GraphAwakenWelcome'
import { GraphPageCanvasStage } from './GraphPageCanvasStage'
import { GraphPageOverlays } from './GraphPageOverlays'
import { GraphPageSideColumn } from './GraphPageSideColumn'
import { GraphPageToolbar } from './GraphPageToolbar'
import type { GraphPageProps } from './graph-page.types'
import { graphSuspectReviewCopy } from './graph-page-view.util'
import { useGraphPageModel } from './useGraphPageModel'
import styles from './GraphPage.module.css'

export type { GraphPageProps }

const PHASE_TRANSITION = { duration: 0.36, ease: [0.22, 1, 0.36, 1] as const }

export const GraphPage: React.FC<GraphPageProps> = ({
  embedded = false,
  active = true,
  highlightStartOrganize = false,
  autoStartOrganize = false,
  onAutoStartOrganizeConsumed,
  onUnifiedOrganize
}) => {
  const m = useGraphPageModel({
    autoStartOrganize,
    onAutoStartOrganizeConsumed,
    onUnifiedOrganize
  })
  const {
    selection,
    search,
    extract,
    settings,
    side,
    data,
    review,
    detail,
    awaken,
    source,
    readiness
  } = m

  return (
    <div className={styles.root}>
      <AnimatePresence initial={false}>
        {m.phaseKey === 'boot' ? (
          <motion.div
            key="boot"
            className={`${styles.phase} ${styles.bootShell}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            aria-busy="true"
          >
            <div className={styles.bootAtmosphere} />
          </motion.div>
        ) : null}
        {m.phaseKey === 'awaken' ? (
          <motion.div
            key="awaken"
            className={styles.phase}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={PHASE_TRANSITION}
          >
            <GraphAwakenWelcome
              initialProfile={awaken.awakenProfile}
              busy={awaken.awakenBusy}
              onSubmit={awaken.completeAwaken}
            />
          </motion.div>
        ) : null}
        {m.phaseKey === 'main' ? (
          <motion.div
            key="main"
            className={`${styles.mainPhase} ${m.showEmptyGuide ? styles.mainPhaseEmpty : ''}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={PHASE_TRANSITION}
          >
            <div className={styles.chrome}>
              {embedded && m.showEmptyGuide ? null : (
                <GraphPageToolbar
                embedded={embedded}
                showEmptyGuide={m.showEmptyGuide}
                searchGroupRef={search.searchGroupRef}
                searchMode={search.searchMode}
                onSearchModeChange={search.setSearchMode}
                query={search.query}
                onQueryChange={search.setQuery}
                onSearchAttemptedClear={() => search.setSearchAttempted(false)}
                onSearch={search.onSearch}
                dismissSearchPanel={search.dismissSearchPanel}
                searching={search.searching}
                searchAttempted={search.searchAttempted}
                searchHits={search.searchHits}
                onSelectNode={selection.onSelectNode}
                monthRange={m.month.monthRange}
                onMonthRangeChange={m.updateMonthRange}
                onClearToGlobal={m.clearToGlobal}
                pinNeighborhood={selection.pinNeighborhood}
                sideCollapsed={side.sideCollapsed}
                highlightStartOrganize={highlightStartOrganize}
                pendingReextractCount={data.pendingReextract.length}
                onRunExtract={() => void extract.runExtract()}
                />
              )}
              {m.status && !extract.extractRunning ? (
                <div className={styles.statusRow}>
                  <p
                    className={`${styles.statusBar} ${m.busy ? styles.statusBarBusy : ''}`}
                  >
                    {m.status}
                  </p>
                </div>
              ) : null}
              {embedded ? null : (
                <div className={styles.chipRow}>
                  <MemoryReadinessBar
                    wrap
                    rows={readiness.rows}
                    onConfigureEmbedding={() => m.navigate(`${SETTINGS_HUB_PREFIX}/ai-models`)}
                    onStartIndex={() => m.navigate('/memory/vectors')}
                    onStartOrganize={m.startOrganize}
                    onOpenOrganize={() => m.navigate('/memory/vectors')}
                    pendingEmbedParts={readiness.pendingEmbedParts}
                    indexing={readiness.indexing}
                    extracting={readiness.graphExtracting}
                    organizePipeline={readiness.organizePipeline}
                  />
                </div>
              )}
            </div>

            <GraphPageCanvasStage
              paused={!active}
              showEmptyGuide={m.showEmptyGuide}
              showMonthEmpty={m.showMonthEmpty}
              organizePendingCount={Math.max(
                readiness.pendingEmbedCount,
                readiness.pendingGraphCount,
                data.estimate?.entryCount ?? 0,
                data.pendingReextract.length
              )}
              highlightStartOrganize={highlightStartOrganize}
              onStartOrganize={m.startOrganize}
              onDismissGuide={() => m.setDismissGuide(true)}
              displayNodes={selection.displayNodes}
              displayEdges={selection.displayEdges}
              highlightIds={selection.highlightIds}
              highlightedEdgeIds={selection.highlightedEdgeIds}
              locateIds={selection.locateIds}
              focusIds={selection.focusIds}
              selectedId={selection.selectedId}
              locateSeq={selection.locateSeq}
              forceSettings={settings.forceSettings}
              appearanceSettings={settings.appearanceSettings}
              animationTick={settings.animationTick}
              onSelectNode={(id) => {
                void selection.onSelectNode(id)
              }}
              onClearSelection={() => {
                // 邻域「查看」模式下：空白单击仅取消选中，不退回月份主图
                selection.setHighlightIds(new Set())
                selection.setHighlightedEdgeIds(new Set())
                selection.setLocateIds(null)
                selection.setSelectedId(null)
                selection.setSelectedNode(null)
              }}
              monthRange={m.month.monthRange}
              onResetMonthRange={m.resetMonthRange}
              onExtendMonthRangeEarlier={(startMonth) => m.updateMonthRange({ startMonth })}
              focusDepth={selection.focusDepth}
            />

            {!m.showEmptyGuide ? (
              <GraphPageSideColumn
                sideWidth={side.sideWidth}
                sideCollapsed={side.sideCollapsed}
                sideMode={side.sideMode}
                pendingReextractCount={data.pendingReextract.length}
                pendingReviewCount={review.pendingCount}
                extractRunning={extract.extractRunning}
                filterActive={m.filterActive}
                onOpenSide={(mode) => {
                  const jumpToPending =
                    mode === 'content' &&
                    review.pendingCount > 0 &&
                    (side.sideCollapsed || side.sideMode !== 'content')
                  side.openSide(mode)
                  if (jumpToPending) m.setTab('pending')
                }}
                onToggleCollapsed={() => side.setSideCollapsedPersist(!side.sideCollapsed)}
                onSideResizeDown={side.onSideResizeDown}
                organize={{
                  profileSectionOpen: awaken.profileSectionOpen,
                  onToggleProfileSection: () =>
                    awaken.setProfileSectionOpen(!awaken.profileSectionOpen),
                  profileForm: awaken.profileForm,
                  onProfileFormChange: (patch) =>
                    awaken.setProfileForm((prev) => ({ ...prev, ...patch })),
                  profileBusy: awaken.profileBusy,
                  profileErrors: awaken.profileErrors,
                  onSaveProfile: () => void awaken.saveProfileFromSettings(),
                  pendingReextractCount: data.pendingReextract.length,
                  onRunExtract: () => void extract.runExtract(),
                  extractRunning: extract.extractRunning,
                  onOpenQueue: () => extract.setQueueModalOpen(true),
                  extractConcurrency: extract.extractConcurrency,
                  onExtractConcurrencyChange: extract.changeExtractConcurrency,
                  extractDate: extract.extractDate,
                  onExtractDateChange: extract.setExtractDate,
                  busy: m.busy,
                  onRunExtractOne: () => void extract.runExtractOne(),
                  mergeSearchOpen: review.mergeSearchOpen,
                  onOpenCreate: () => {
                    review.setMergeSearchOpen(false)
                    detail.setCreateOpen(true)
                  },
                  onToggleMerge: () => {
                    detail.setCreateOpen(false)
                    review.setMergeSearchOpen((open) => !open)
                  },
                  onClearLifeGraph: () => void m.clearLifeGraph()
                }}
                canvas={{
                  filterActive: m.filterActive,
                  typeFilterActive: m.typeFilterActive,
                  hideEntry: settings.hideEntry,
                  approvedOnly: settings.approvedOnly,
                  enabledNodeTypes: settings.enabledNodeTypes,
                  onHideEntryChange: settings.setHideEntry,
                  onApprovedOnlyChange: settings.setApprovedOnly,
                  onResetFilters: settings.resetFilters,
                  onToggleTypeFilter: settings.toggleNodeTypeFilter,
                  onToggleAllTypes: () =>
                    settings.setEnabledNodeTypes(
                      m.typeFilterActive ? new Set(m.GRAPH_FILTER_NODE_TYPES) : new Set()
                    ),
                  focusDepth: selection.focusDepth,
                  appearanceSettings: settings.appearanceSettings,
                  forceSettings: settings.forceSettings,
                  onFocusDepthChange: selection.updateFocusDepth,
                  onAppearanceChange: settings.updateAppearance,
                  onForceChange: settings.updateForce,
                  onReplayLayout: () => settings.setAnimationTick((n) => n + 1),
                  onResetGraphSettings: settings.resetGraphSettings
                }}
                content={{
                  tab: m.tab,
                  onTabChange: m.setTab,
                  pendingCount: review.pendingCount,
                  similarCount: data.similarPairs.length,
                  reextract: {
                    pendingReextract: data.pendingReextract,
                    queueByPath: extract.queueByPath,
                    onCancelQueueItem: (filePath) => void extract.cancelQueueItem(filePath),
                    onRunExtract: (filePaths) => void extract.runExtract(filePaths),
                    onOpenSource: (date) => void source.openSource(date)
                  },
                  pending: {
                    pendingCount: review.pendingCount,
                    pendingNodes: data.pendingNodes,
                    pendingEdges: data.pendingEdges,
                    pendingSelected: review.pendingSelected,
                    pendingSelectedCount: review.pendingSelectedCount,
                    allPendingSelected: review.allPendingSelected,
                    graphNodeNameById: selection.graphNodeNameById,
                    busy: m.busy,
                    onToggleSelectAll: review.toggleSelectAllPending,
                    onToggleItem: review.togglePendingItem,
                    onApplyReviews: (opts) => void review.applyPendingReviews(opts),
                    onReviewNode: (nodeId, status) => void review.reviewNode(nodeId, status),
                    onReviewEdge: (edgeId, status, endpoints) =>
                      void review.reviewEdge(edgeId, status, endpoints),
                    onLocateNode: selection.locatePendingNode,
                    onLocateEdge: (edge) => void selection.locatePendingEdge(edge),
                    onOpenSource: (ref, excerpt) => void source.openSource(ref, excerpt)
                  },
                  similar: {
                    pairs: data.similarPairs,
                    busy: m.busy,
                    onMerge: (pair) => review.mergeNodes(pair.peerId, pair.nodeId),
                    onKeepApart: (pair) => void review.dismissSimilarPair(pair.nodeId, pair.peerId),
                    onLocateNode: selection.locatePendingNode
                  },
                  detail: {
                    selectedNode: selection.selectedNode,
                    focusDepth: selection.focusDepth,
                    onFocusDepthChange: selection.updateFocusDepth,
                    editName: detail.editName,
                    onEditNameChange: detail.setEditName,
                    editNameConflict: detail.editNameConflict,
                    onSelectNode: (id) => void selection.onSelectNode(id),
                    onMergeIntoExisting: review.mergeNodes,
                    editSummary: detail.editSummary,
                    onEditSummaryChange: detail.setEditSummary,
                    editAliases: detail.editAliases,
                    onEditAliasesChange: detail.setEditAliases,
                    nameCandidates: detail.nameCandidates,
                    busy: m.busy,
                    onSaveNodeEdit: () => void detail.saveNodeEdit(),
                    onDeleteSelectedNode: () => void detail.deleteSelectedNode(),
                    onOpenSplit: () => detail.setSplitOpen(true),
                    onRevertSplit: (discriminator) => void detail.revertSplit(discriminator),
                    onReviewNode: (nodeId, status) => void review.reviewNode(nodeId, status),
                    addEdgeQuery: detail.addEdgeQuery,
                    onAddEdgeQueryChange: detail.setAddEdgeQuery,
                    onSearchAddEdgeTarget: () => void detail.searchAddEdgeTarget(),
                    addEdgeType: detail.addEdgeType,
                    onAddEdgeTypeChange: detail.setAddEdgeType,
                    edgeTypes: detail.edgeTypes,
                    addEdgeToId: detail.addEdgeToId,
                    onAddEdgeToIdChange: detail.setAddEdgeToId,
                    onAddEdge: () => void detail.addEdge(),
                    addEdgeHits: detail.addEdgeHits,
                    detailEdges: selection.detailEdges,
                    onOpenSource: (ref, excerpt) => void source.openSource(ref, excerpt),
                    onDeleteEdge: (edgeId) => void detail.deleteEdge(edgeId)
                  }
                }}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <GraphPageOverlays
        createOpen={detail.createOpen}
        splitOpen={detail.splitOpen}
        mergeSearchOpen={review.mergeSearchOpen}
        mergeConfirm={review.mergeConfirm}
        queueModalOpen={extract.queueModalOpen}
        sourcePreview={source.sourcePreview}
        busy={m.busy}
        selectedId={selection.selectedId}
        selectedNode={selection.selectedNode}
        nameCandidates={detail.nameCandidates}
        findNode={review.findGraphNode}
        extractRunning={extract.extractRunning}
        extractQueue={extract.extractQueue}
        queueItemCount={extract.queueItemCount}
        queueOverallPct={extract.queueOverallPct}
        onCloseCreate={() => detail.setCreateOpen(false)}
        onCreated={(id) => {
          detail.setCreateOpen(false)
          void data.refresh().then(() => selection.onSelectNode(id))
        }}
        onOpenExisting={(id) => {
          detail.setCreateOpen(false)
          void selection.onSelectNode(id)
        }}
        onCloseSplit={() => detail.setSplitOpen(false)}
        onSplit={(id) => {
          detail.setSplitOpen(false)
          m.toast.showSuccess(m.t('graph.split_done', '已拆出新实体'))
          void data.refresh().then(() => selection.onSelectNode(id))
        }}
        onApprove={() => {
          const nodeId = selection.selectedNode?.id
          if (!nodeId) return
          const copy = graphSuspectReviewCopy(selection.selectedNode)
          void review.reviewNode(nodeId, 'approved').then(() => {
            detail.setSplitOpen(false)
            m.toast.showSuccess(m.t(copy.doneKey, copy.doneDefault))
          })
        }}
        onCloseMergeSearch={() => review.setMergeSearchOpen(false)}
        onRequestMerge={review.openMergeConfirm}
        onCancelMerge={() => review.setMergeConfirm(null)}
        onConfirmMerge={() => void review.runConfirmedMerge()}
        onCloseQueue={() => extract.setQueueModalOpen(false)}
        onCancelQueueItem={(filePath) => void extract.cancelQueueItem(filePath)}
        onCancelExtract={() => void extract.cancelExtract()}
        onCloseSource={() => source.setSourcePreview(null)}
      />
    </div>
  )
}
