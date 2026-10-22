import React, { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  Button,
  FloatingModal,
  HelpTooltip,
  SegmentedContent,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
import { GraphAwakenWelcome } from './GraphAwakenWelcome'
import { GraphPhaseFade } from './GraphPhaseFade'
import { GraphScreenEmptyGuide } from './GraphScreenEmptyGuide'
import { GraphScreenEmbeddedPane, type GraphEmbeddedViewMode } from './GraphScreenEmbeddedPane'
import { GRAPH_FILTER_NODE_TYPES } from './graph-screen-display.util'
import { GraphScreenOverlays } from './GraphScreenOverlays'
import { GraphScreenPendingTab } from './GraphScreenPendingTab'
import { GraphScreenSimilarTab } from './GraphScreenSimilarTab'
import { GraphScreenReextractTab } from './GraphScreenReextractTab'
import { GraphScreenSearchTab } from './GraphScreenSearchTab'
import { GraphScreenDetailPane } from './GraphScreenDetailPane'
import { GraphScreenSettingsSheet } from './GraphScreenSettingsSheet'
import { styles } from './GraphScreen.styles'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { useGraphScreenModel } from './useGraphScreenModel'
import { graphSuspectReviewCopy } from '@/src/services/graph-name-candidates.util'
import { sharedTokens } from '@baishou/ui/theme/tokens'
import { graphNodeHref } from './graph-screen-view.util'

export type GraphScreenProps = {
  embedded?: boolean
  onUnifiedOrganize?: () => void | Promise<void>
}

export function GraphScreen({ embedded = false, onUnifiedOrganize }: GraphScreenProps = {}) {
  const m = useGraphScreenModel({ onUnifiedOrganize })
  const { colors, tokens } = useNativeTheme()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const chrome = getStackScreenChrome(colors)
  const listPad = {
    padding: sharedTokens.spacing.md,
    paddingBottom:
      sharedTokens.spacing.md +
      insets.bottom +
      (embedded ? tokens.spacing.xl + tokens.spacing.lg : 0)
  }
  const { tab, setTab, settings, data, search, review, detail, extract } = m
  const [nodeDetailOpen, setNodeDetailOpen] = useState(false)
  const [viewMode, setViewMode] = useState<GraphEmbeddedViewMode>('list')

  const openReview = () => {
    settings.setSettingsOpen(false)
    router.push('/graph-review')
  }

  const content = (
    <View style={{ flex: 1 }}>
      <GraphPhaseFade phaseKey={m.phaseKey} disabled={embedded && m.phaseKey === 'main'}>
        {m.phaseKey === 'boot' ? (
          <View style={[styles.bootShell, { backgroundColor: colors.bgApp }]} />
        ) : m.phaseKey === 'awaken' ? (
          <GraphAwakenWelcome
            initialProfile={settings.awakenProfile}
            busy={settings.awakenBusy}
            onSubmit={settings.completeAwaken}
          />
        ) : embedded ? (
          <GraphScreenEmbeddedPane
            m={m}
            listPadBottom={listPad.paddingBottom}
            viewMode={viewMode}
            onViewModeChange={(mode) => {
              setViewMode(mode)
              if (mode !== 'graph') settings.setSettingsOpen(false)
            }}
            onOpenReview={() => openReview()}
            onOpenNode={(id) => {
              router.push(graphNodeHref(id))
            }}
            onOpenPeekDetail={() => {
              const targetId = search.selectedNode?.id || search.selectedId
              if (targetId) {
                router.push(graphNodeHref(targetId))
              }
            }}
            onOpenSettings={() => settings.setSettingsOpen(true)}
          />
        ) : (
          <>
            <View style={styles.opsBar}>
              <Button variant="outlined" size="sm" onPress={() => settings.setSettingsOpen(true)}>
                {m.t('graph.side_organize', '整理')}
              </Button>
            </View>

            <View
              style={{
                marginHorizontal: sharedTokens.spacing.mdTight,
                marginTop: sharedTokens.spacing.smPlus,
                marginBottom: sharedTokens.spacing.sm
              }}
            >
              <SegmentedControl
                size="small"
                value={tab}
                onChange={setTab}
                options={m.tabItems.map(([value, label]) => ({ value, label }))}
              />
            </View>

            {m.status ? (
              <Pressable
                onPress={() => {
                  if (extract.extractRunning || (extract.extractQueue?.items.length ?? 0) > 0) {
                    extract.setQueueModalOpen(true)
                  }
                }}
              >
                <Text style={[styles.status, { color: colors.textSecondary }]}>{m.status}</Text>
              </Pressable>
            ) : null}
            {m.busy && !extract.extractRunning ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ marginBottom: sharedTokens.spacing.sm }}
              />
            ) : null}

            {m.showEmptyGuide ? (
              <GraphScreenEmptyGuide
                estimate={data.estimate}
                pendingCount={data.pending.length}
                onStartOrganize={() => void m.startOrganize()}
                onDismissGuide={() => m.setDismissGuide(true)}
              />
            ) : null}

            {search.selectedNode ? (
              <GraphScreenDetailPane
                selectedNode={search.selectedNode}
                editName={detail.editName}
                onEditNameChange={detail.setEditName}
                editNameConflict={detail.editNameConflict}
                sameNameEntities={detail.sameNameEntities}
                editSummary={detail.editSummary}
                onEditSummaryChange={detail.setEditSummary}
                editAliases={detail.editAliases}
                onEditAliasesChange={detail.setEditAliases}
                busy={m.busy}
                onSaveNodeEdit={() => void detail.saveNodeEdit()}
                onReviewNode={(nodeId, status) => review.reviewNode(nodeId, status)}
                onDeleteSelected={detail.deleteSelected}
                onOpenSplit={() => detail.setSplitOpen(true)}
                onRevertSplit={(discriminator) => void detail.revertSplit(discriminator)}
                onSelectNode={(id) => void search.onSelectNode(id)}
                onMergeIntoExisting={(survivorId, survivorName, loserId, loserName) =>
                  review.setMergeConfirm({
                    survivorId,
                    survivorName,
                    losers: [{ id: loserId, name: loserName }]
                  })
                }
                detailEdges={m.detailEdges}
                onOpenSource={(ref, excerpt) => void m.openSource(ref, excerpt)}
                onReviewEdge={(edgeId, status, endpoints) =>
                  review.reviewEdge(edgeId, status, endpoints)
                }
                onDeleteEdge={detail.deleteEdge}
                addEdgeQuery={detail.addEdgeQuery}
                onAddEdgeQueryChange={detail.setAddEdgeQuery}
                onSearchAddEdgeTarget={(query, mode) =>
                  void detail.searchAddEdgeTarget(query, mode)
                }
                addEdgeSearchMode={detail.addEdgeSearchMode}
                onAddEdgeSearchModeChange={detail.setAddEdgeSearchMode}
                addEdgeSearching={detail.addEdgeSearching}
                addEdgeType={detail.addEdgeType}
                onAddEdgeTypeChange={detail.setAddEdgeType}
                addEdgeToId={detail.addEdgeToId}
                onAddEdgeToIdChange={detail.setAddEdgeToId}
                onAddEdge={() => void detail.addEdge()}
                addEdgeHits={detail.addEdgeHits}
              />
            ) : null}

            <SegmentedContent value={tab} style={{ flex: 1, minHeight: 0 }}>
              {tab === 'search' && (
                <GraphScreenSearchTab
                  query={search.query}
                  onQueryChange={search.setQuery}
                  searchMode={search.searchMode}
                  onSearchModeChange={search.setSearchMode}
                  onSearch={(mode) => void search.onSearch(mode)}
                  searching={search.searching}
                  hits={search.hits}
                  onHitPress={(item) => void search.onSearchHitPress(item)}
                  listPad={listPad}
                />
              )}

              {tab === 'pending' && (
                <GraphScreenPendingTab
                  pendingItems={review.pendingItems}
                  pendingSelected={review.pendingSelected}
                  pendingSelectedCount={review.pendingSelectedCount}
                  allPendingSelected={review.allPendingSelected}
                  reviewingSelectedStatus={review.reviewingSelectedStatus}
                  graphNodeNameById={m.graphNodeNameById}
                  busy={m.busy}
                  onToggleSelectAll={review.toggleSelectAllPending}
                  onToggleItem={review.togglePendingItem}
                  onApplyReviews={(opts) => void review.applyPendingReviews(opts)}
                  onReviewNode={(nodeId, status) => void review.reviewNode(nodeId, status)}
                  onReviewEdge={(edgeId, status, endpoints) =>
                    void review.reviewEdge(edgeId, status, endpoints)
                  }
                  onLocateNode={(id) => void search.onSelectNode(id)}
                  onViewNodeSource={(id, node) =>
                    void m.openNodeSource(id, node as { propsJson?: string | null })
                  }
                  onLocateEdge={(edge) => void search.onSelectNode(edge.fromId)}
                  onOpenSource={(ref, excerpt) => void m.openSource(ref, excerpt)}
                  listPad={listPad}
                />
              )}

              {tab === 'similar' && (
                <GraphScreenSimilarTab
                  pairs={data.similarPairs}
                  busy={m.busy}
                  onMerge={(pair) =>
                    review.mergeSimilarPair(pair.peerId, pair.nodeId, pair.peerName, pair.nodeName)
                  }
                  onMergeAll={() => void review.mergeAllSimilarPairs()}
                  onKeepApart={(pair) => void review.dismissSimilarPair(pair.nodeId, pair.peerId)}
                  onLocateNode={(id) => void search.onSelectNode(id)}
                  listPad={listPad}
                />
              )}

              {tab === 'reextract' && (
                <GraphScreenReextractTab
                  pending={data.pending}
                  queueByPath={extract.queueByPath}
                  busy={m.busy}
                  onRunExtract={(filePaths) => void extract.runExtract(filePaths)}
                  onCancelQueueItem={extract.cancelQueueItem}
                  onOpenSource={(date) => void m.openSource(date)}
                  listPad={listPad}
                />
              )}
            </SegmentedContent>
          </>
        )}
      </GraphPhaseFade>

      <GraphScreenSettingsSheet
        visible={settings.settingsOpen}
        onClose={() => settings.setSettingsOpen(false)}
        mode={embedded ? 'canvas' : 'organize'}
        settingsSection={settings.settingsSection}
        onToggleSection={(key) => settings.setSettingsSection((s) => ({ ...s, [key]: !s[key] }))}
        organize={{
          profileForm: settings.profileForm,
          onProfileFormChange: (patch) =>
            settings.setProfileForm((prev) => ({ ...prev, ...patch })),
          profileErrors: settings.profileErrors,
          profileBusy: settings.profileBusy,
          onSaveProfile: () => void m.saveProfileFromSettings(),
          pendingCount: data.pending.length,
          busy: m.busy,
          extractRunning: extract.extractRunning,
          extractConcurrency: extract.extractConcurrency,
          extractDate: extract.extractDate,
          onExtractDateChange: extract.setExtractDate,
          onRunExtract: () => void extract.runExtract(),
          onOpenQueue: () => extract.setQueueModalOpen(true),
          onChangeConcurrency: extract.changeExtractConcurrency,
          onRunExtractOne: () => void extract.runExtractOne(),
          mergeSearchOpen: review.mergeSearchOpen,
          onOpenCreate: () => {
            review.setMergeSearchOpen(false)
            detail.setCreateOpen(true)
            settings.setSettingsOpen(false)
          },
          onOpenMerge: () => {
            detail.setCreateOpen(false)
            review.setMergeSearchOpen(true)
            settings.setSettingsOpen(false)
          },
          onClearLifeGraph: () => void m.clearLifeGraph()
        }}
        canvas={
          embedded
            ? {
                filterActive: settings.filterActive,
                typeFilterActive: settings.typeFilterActive,
                hideEntry: settings.hideEntry,
                approvedOnly: settings.approvedOnly,
                enabledNodeTypes: settings.enabledNodeTypes,
                filterNodeTypes: GRAPH_FILTER_NODE_TYPES,
                onHideEntryChange: settings.setHideEntry,
                onApprovedOnlyChange: settings.setApprovedOnly,
                onResetFilters: settings.resetFilters,
                onToggleTypeFilter: settings.toggleNodeTypeFilter,
                onToggleAllTypes: () =>
                  settings.setEnabledNodeTypes(
                    settings.typeFilterActive ? new Set(GRAPH_FILTER_NODE_TYPES) : new Set()
                  ),
                focusDepth: search.focusDepth,
                onFocusDepthChange: search.updateFocusDepth,
                appearanceSettings: settings.appearanceSettings,
                onAppearanceChange: settings.updateAppearance,
                viewMaxNodes: settings.viewMaxNodes,
                onViewMaxNodesChange: settings.updateViewMaxNodes,
                forceSettings: settings.forceSettings,
                onForceChange: settings.updateForce,
                onReplayLayout: () => m.setAnimationTick((n) => n + 1),
                onResetGraphSettings: settings.resetGraphSettings
              }
            : undefined
        }
      />

      <GraphScreenOverlays
        queueModalOpen={extract.queueModalOpen}
        onCloseQueue={() => extract.setQueueModalOpen(false)}
        extractRunning={extract.extractRunning}
        extractQueue={extract.extractQueue}
        extractConcurrency={extract.extractConcurrency}
        onChangeConcurrency={extract.changeExtractConcurrency}
        onCancelQueueItem={extract.cancelQueueItem}
        onStopExtract={extract.stopExtract}
        sourcePreview={m.sourcePreview}
        onCloseSource={() => m.setSourcePreview(null)}
        createOpen={detail.createOpen}
        splitOpen={detail.splitOpen}
        mergeSearchOpen={review.mergeSearchOpen}
        mergeConfirm={review.mergeConfirm}
        busy={m.busy}
        services={m.services}
        vaultId={m.vaultId}
        vaultName={m.vaultName}
        selectedId={search.selectedId}
        selectedNode={search.selectedNode}
        sameNameEntities={detail.sameNameEntities}
        detailEdges={m.detailEdges}
        findNode={review.findGraphNode}
        onCloseCreate={() => detail.setCreateOpen(false)}
        onCreated={(id) => {
          detail.setCreateOpen(false)
          void data.refresh().then(() => {
            void search.onSelectNode(id).then(() => {
              if (embedded) setNodeDetailOpen(true)
            })
          })
        }}
        onOpenExisting={(id) => {
          detail.setCreateOpen(false)
          void search.onSelectNode(id).then(() => {
            if (embedded) setNodeDetailOpen(true)
          })
        }}
        onCloseSplit={() => detail.setSplitOpen(false)}
        onSplit={(id) => {
          detail.setSplitOpen(false)
          void data.refresh().then(() => search.onSelectNode(id))
        }}
        onApprove={() => {
          const nodeId = search.selectedNode?.id
          if (!nodeId) return
          const copy = graphSuspectReviewCopy(search.selectedNode)
          void review.reviewNode(nodeId, 'approved').then(() => {
            detail.setSplitOpen(false)
            m.toast.showSuccess(m.t(copy.doneKey, copy.doneDefault))
          })
        }}
        onCloseMergeSearch={() => review.setMergeSearchOpen(false)}
        onRequestMerge={review.setMergeConfirm}
        onCancelMerge={() => review.setMergeConfirm(null)}
        onConfirmMerge={() => void review.runConfirmedMerge()}
      />
      {embedded ? (
        <>
          <FloatingModal visible={nodeDetailOpen} onClose={() => setNodeDetailOpen(false)}>
            {search.selectedNode ? (
              <View style={{ maxHeight: tokens.spacing.xl * 16 }}>
                <GraphScreenDetailPane
                  selectedNode={search.selectedNode}
                  editName={detail.editName}
                  onEditNameChange={detail.setEditName}
                  editNameConflict={detail.editNameConflict}
                  sameNameEntities={detail.sameNameEntities}
                  editSummary={detail.editSummary}
                  onEditSummaryChange={detail.setEditSummary}
                  editAliases={detail.editAliases}
                  onEditAliasesChange={detail.setEditAliases}
                  busy={m.busy}
                  onSaveNodeEdit={() => void detail.saveNodeEdit()}
                  onReviewNode={(nodeId, status) => review.reviewNode(nodeId, status)}
                  onDeleteSelected={detail.deleteSelected}
                  onOpenSplit={() => detail.setSplitOpen(true)}
                  onRevertSplit={(discriminator) => void detail.revertSplit(discriminator)}
                  onSelectNode={(id) => void search.onSelectNode(id)}
                  onMergeIntoExisting={(survivorId, survivorName, loserId, loserName) =>
                    review.setMergeConfirm({
                      survivorId,
                      survivorName,
                      losers: [{ id: loserId, name: loserName }]
                    })
                  }
                  detailEdges={m.detailEdges}
                  onOpenSource={(ref, excerpt) => void m.openSource(ref, excerpt)}
                  onReviewEdge={(edgeId, status, endpoints) =>
                    review.reviewEdge(edgeId, status, endpoints)
                  }
                  onDeleteEdge={detail.deleteEdge}
                  addEdgeQuery={detail.addEdgeQuery}
                  onAddEdgeQueryChange={detail.setAddEdgeQuery}
                  onSearchAddEdgeTarget={(query, mode) =>
                    void detail.searchAddEdgeTarget(query, mode)
                  }
                  addEdgeSearchMode={detail.addEdgeSearchMode}
                  onAddEdgeSearchModeChange={detail.setAddEdgeSearchMode}
                  addEdgeSearching={detail.addEdgeSearching}
                  addEdgeType={detail.addEdgeType}
                  onAddEdgeTypeChange={detail.setAddEdgeType}
                  addEdgeToId={detail.addEdgeToId}
                  onAddEdgeToIdChange={detail.setAddEdgeToId}
                  onAddEdge={() => void detail.addEdge()}
                  addEdgeHits={detail.addEdgeHits}
                />
              </View>
            ) : null}
          </FloatingModal>
        </>
      ) : null}
    </View>
  )

  if (embedded) {
    return <View style={{ flex: 1 }}>{content}</View>
  }

  return (
    <StackScreenLayout
      title={m.t('graph.title', '人生关系图')}
      titleAddon={
        <HelpTooltip
          size={16}
          content={m.t(
            'graph.title_help',
            '这是从日记里整理出的人物、地点和事件关系。笔记本里的关系图是另一套库，不会混在这里。'
          )}
        />
      }
      {...chrome}
      headerRight={
        m.phaseKey !== 'main'
          ? undefined
          : extract.extractRunning
            ? {
                label: m.t('graph.queue_view_progress', '进度'),
                onPress: () => extract.setQueueModalOpen(true)
              }
            : m.showEmptyGuide
              ? undefined
              : {
                  label: m.t('graph.extract', '梳理'),
                  onPress: () => void extract.runExtract(),
                  disabled: m.busy
                }
      }
      contentStyle={styles.layoutContent}
    >
      {content}
    </StackScreenLayout>
  )
}
