import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HelpTooltip, useNativeTheme } from '@baishou/ui/native'
import { GraphAwakenWelcome } from './GraphAwakenWelcome'
import { GraphPhaseFade } from './GraphPhaseFade'
import { GraphScreenCanvasTab } from './GraphScreenCanvasTab'
import { GraphScreenOverlays } from './GraphScreenOverlays'
import { GraphScreenPendingTab } from './GraphScreenPendingTab'
import { GraphScreenSimilarTab } from './GraphScreenSimilarTab'
import { GraphScreenReextractTab } from './GraphScreenReextractTab'
import { GraphScreenSearchTab } from './GraphScreenSearchTab'
import { GraphScreenSettingsSheet } from './GraphScreenSettingsSheet'
import { styles } from './GraphScreen.styles'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { useGraphScreenModel } from './useGraphScreenModel'
import { GRAPH_FILTER_NODE_TYPES } from './graph-screen-display.util'

export function GraphScreen() {
  const m = useGraphScreenModel()
  const { colors } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const chrome = getStackScreenChrome(colors)
  const listPad = { padding: 16, paddingBottom: 16 + insets.bottom }
  const { tab, setTab, settings, data, search, review, detail, extract } = m

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
            : m.showEmptyGuide && tab === 'graph'
              ? undefined
              : {
                  label: m.t('graph.extract', '梳理'),
                  onPress: () => void extract.runExtract(),
                  disabled: m.busy
                }
      }
      contentStyle={styles.layoutContent}
    >
      <GraphPhaseFade phaseKey={m.phaseKey}>
        {m.phaseKey === 'boot' ? (
          <View style={[styles.bootShell, { backgroundColor: colors.bgApp }]} />
        ) : m.phaseKey === 'awaken' ? (
          <GraphAwakenWelcome
            initialProfile={settings.awakenProfile}
            busy={settings.awakenBusy}
            onSubmit={settings.completeAwaken}
          />
        ) : (
          <>
            <View style={[styles.tabTrack, { backgroundColor: colors.bgSurfaceNormal }]}>
              {m.tabItems.map(([id, label]) => {
                const active = tab === id
                return (
                  <Pressable
                    key={id}
                    style={[
                      styles.tab,
                      active && {
                        backgroundColor: colors.bgSurface,
                        borderColor: colors.borderMuted
                      }
                    ]}
                    onPress={() => setTab(id)}
                  >
                    <Text
                      style={{
                        color: active ? colors.primary : colors.textSecondary,
                        fontSize: 12,
                        fontWeight: active ? '600' : '500'
                      }}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </Pressable>
                )
              })}
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
              <ActivityIndicator color={colors.primary} style={{ marginBottom: 8 }} />
            ) : null}

            {tab === 'graph' && (
              <GraphScreenCanvasTab
                showEmptyGuide={m.showEmptyGuide}
                showMonthEmpty={m.showMonthEmpty}
                monthRange={settings.monthRange}
                onMonthRangeChange={m.updateMonthRange}
                onClearToGlobal={search.clearToGlobal}
                filterActive={settings.filterActive}
                mergeSearchOpen={review.mergeSearchOpen}
                onOpenSettings={() => settings.setSettingsOpen(true)}
                focusDepth={search.focusDepth}
                onFocusDepthChange={search.updateFocusDepth}
                selectedNode={search.selectedNode}
                estimate={data.estimate}
                pendingCount={data.pending.length}
                formatTokens={m.formatTokens}
                onStartOrganize={() => void m.startOrganize()}
                onDismissGuide={() => m.setDismissGuide(true)}
                onResetMonthRange={m.resetMonthRange}
                displayNodes={m.displayNodes}
                displayEdges={m.displayEdges}
                forceSettings={settings.forceSettings}
                appearanceSettings={settings.appearanceSettings}
                selectedId={search.selectedId}
                focusIds={m.focusIds}
                highlightIds={search.highlightIds}
                highlightedEdgeIds={search.highlightedEdgeIds}
                locateIds={search.locateIds}
                locateSeq={search.locateSeq}
                animationTick={m.animationTick}
                onSelectNode={(id) => void search.onSelectNode(id)}
                onClearSelection={search.clearSelectionKeepPin}
                paddingBottom={insets.bottom}
                detail={{
                  editName: detail.editName,
                  onEditNameChange: detail.setEditName,
                  editNameConflict: detail.editNameConflict,
                  sameNameEntities: detail.sameNameEntities,
                  editSummary: detail.editSummary,
                  onEditSummaryChange: detail.setEditSummary,
                  editAliases: detail.editAliases,
                  onEditAliasesChange: detail.setEditAliases,
                  busy: m.busy,
                  onSaveNodeEdit: () => void detail.saveNodeEdit(),
                  onReviewNode: (nodeId, status) => void review.reviewNode(nodeId, status),
                  onDeleteSelected: detail.deleteSelected,
                  onOpenSplit: () => detail.setSplitOpen(true),
                  onRevertSplit: (discriminator) => void detail.revertSplit(discriminator),
                  onMergeIntoExisting: (survivorId, survivorName, loserId, loserName) =>
                    review.setMergeConfirm({
                      survivorId,
                      survivorName,
                      losers: [{ id: loserId, name: loserName }]
                    }),
                  detailEdges: m.detailEdges,
                  onOpenSource: (ref, excerpt) => void m.openSource(ref, excerpt),
                  onReviewEdge: (edgeId, status, endpoints) =>
                    void review.reviewEdge(edgeId, status, endpoints),
                  onDeleteEdge: detail.deleteEdge,
                  addEdgeQuery: detail.addEdgeQuery,
                  onAddEdgeQueryChange: detail.setAddEdgeQuery,
                  onSearchAddEdgeTarget: () => void detail.searchAddEdgeTarget(),
                  addEdgeType: detail.addEdgeType,
                  onAddEdgeTypeChange: detail.setAddEdgeType,
                  addEdgeToId: detail.addEdgeToId,
                  onAddEdgeToIdChange: detail.setAddEdgeToId,
                  onAddEdge: () => void detail.addEdge(),
                  addEdgeHits: detail.addEdgeHits
                }}
              />
            )}

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

            {tab === 'reextract' && (
              <GraphScreenReextractTab
                pending={data.pending}
                queueByPath={extract.queueByPath}
                onRunExtract={(filePaths) => void extract.runExtract(filePaths)}
                onCancelQueueItem={extract.cancelQueueItem}
                onOpenSource={(date) => void m.openSource(date)}
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
                onKeepApart={(pair) => void review.dismissSimilarPair(pair.nodeId, pair.peerId)}
                onLocateNode={search.locatePendingNode}
                listPad={listPad}
              />
            )}

            {tab === 'pending' && (
              <GraphScreenPendingTab
                pendingItems={review.pendingItems}
                pendingSelected={review.pendingSelected}
                pendingSelectedCount={review.pendingSelectedCount}
                allPendingSelected={review.allPendingSelected}
                graphNodeNameById={m.graphNodeNameById}
                busy={m.busy}
                onToggleSelectAll={review.toggleSelectAllPending}
                onToggleItem={review.togglePendingItem}
                onApplyReviews={(opts) => void review.applyPendingReviews(opts)}
                onReviewNode={(nodeId, status) => void review.reviewNode(nodeId, status)}
                onReviewEdge={(edgeId, status, endpoints) =>
                  void review.reviewEdge(edgeId, status, endpoints)
                }
                onLocateNode={search.locatePendingNode}
                onLocateEdge={(edge) => void search.locatePendingEdge(edge)}
                onOpenSource={(ref, excerpt) => void m.openSource(ref, excerpt)}
                listPad={listPad}
              />
            )}
          </>
        )}
      </GraphPhaseFade>

      <GraphScreenSettingsSheet
        visible={settings.settingsOpen}
        onClose={() => settings.setSettingsOpen(false)}
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
        canvas={{
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
          forceSettings: settings.forceSettings,
          onForceChange: settings.updateForce,
          onReplayLayout: () => m.setAnimationTick((n) => n + 1),
          onResetGraphSettings: settings.resetGraphSettings
        }}
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
        findNode={review.findGraphNode}
        onCloseCreate={() => detail.setCreateOpen(false)}
        onCreated={(id) => {
          detail.setCreateOpen(false)
          void data.refresh().then(() => search.onSelectNode(id))
        }}
        onOpenExisting={(id) => {
          detail.setCreateOpen(false)
          void search.onSelectNode(id)
        }}
        onCloseSplit={() => detail.setSplitOpen(false)}
        onSplit={(id) => {
          detail.setSplitOpen(false)
          void data.refresh().then(() => search.onSelectNode(id))
        }}
        onCloseMergeSearch={() => review.setMergeSearchOpen(false)}
        onRequestMerge={review.setMergeConfirm}
        onCancelMerge={() => review.setMergeConfirm(null)}
        onConfirmMerge={() => void review.runConfirmedMerge()}
      />
    </StackScreenLayout>
  )
}
