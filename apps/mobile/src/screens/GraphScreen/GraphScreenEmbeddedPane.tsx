import React from 'react'
import { View } from 'react-native'
import { useIsFocused } from '@react-navigation/native'
import { KeyboardAwareScrollView, SegmentedContent, useNativeTheme } from '@baishou/ui/native'
import { sharedTokens } from '@baishou/ui/theme/tokens'
import { GraphScreenCanvasPane } from './GraphScreenCanvasPane'
import { GraphScreenNodeList } from './GraphScreenNodeList'
import { GraphScreenReviewActionsSection } from './GraphScreenReviewActionsSection'
import { GraphScreenSearchSection } from './GraphScreenSearchSection'
import type { GraphEmbeddedViewMode } from './graph-screen.types'
import type { useGraphScreenModel } from './useGraphScreenModel'

export type { GraphEmbeddedViewMode }

export function GraphScreenEmbeddedPane(props: {
  m: ReturnType<typeof useGraphScreenModel>
  listPadBottom: number
  viewMode: GraphEmbeddedViewMode
  onViewModeChange: (mode: GraphEmbeddedViewMode) => void
  onOpenReview: () => void
  onOpenNode: (id: string) => void
  onOpenPeekDetail: () => void
  onOpenSettings: () => void
}) {
  const { m } = props
  const { colors, tokens } = useNativeTheme()
  const focused = useIsFocused()
  const { search, review, data, settings } = m
  const canvasHeight = tokens.spacing.xl * 18

  const reviewAndSearch = (
    <>
      <GraphScreenReviewActionsSection
        pendingCount={review.pendingItems.length}
        similarCount={data.similarPairs.length}
        reextractCount={data.pending.length}
        onOpenReview={props.onOpenReview}
      />
      <GraphScreenSearchSection
        query={search.query}
        onQueryChange={search.setQuery}
        searchMode={search.searchMode}
        onSearchModeChange={search.setSearchMode}
        onSearch={(queryOrMode, mode) => void search.onSearch(queryOrMode, mode)}
        searching={search.searching}
        listed={m.inventory.listed}
        nodeCount={m.inventory.nodeCount}
        edgeCount={m.inventory.edgeCount}
        pageSize={m.inventory.pageSize}
        onPageChange={m.inventory.setPage}
        onPageSizeChange={m.inventory.setPageSize}
        onHitPress={(item) => props.onOpenNode(item.id)}
        hideList
        viewMode={props.viewMode}
        onViewModeChange={props.onViewModeChange}
      />
    </>
  )

  const canvas = (
    <GraphScreenCanvasPane
      style={{
        height: canvasHeight,
        minHeight: 0,
        backgroundColor: colors.bgApp
      }}
      nodes={m.displayNodes}
      edges={m.displayEdges}
      forceSettings={settings.forceSettings}
      appearanceSettings={settings.appearanceSettings}
      selectedId={search.selectedId}
      focusIds={m.focusIds}
      highlightIds={search.highlightIds}
      highlightEdgeIds={search.highlightedEdgeIds}
      locateIds={search.locateIds}
      locateSeq={search.locateSeq}
      animationTick={m.animationTick}
      monthRange={settings.monthRange}
      onMonthRangeChange={m.updateMonthRange}
      monthEmpty={m.showMonthEmpty}
      onSelectNode={(id) => void search.onSelectNode(id)}
      onClearSelection={() => search.clearSelectionKeepPin()}
      peekName={
        search.selectedNode ? search.selectedNode.name || search.selectedNode.id : undefined
      }
      peekDiscriminator={search.selectedNode?.discriminator}
      onOpenPeekDetail={props.onOpenPeekDetail}
      onOpenSettings={props.onOpenSettings}
      settingsActive={settings.settingsOpen}
    />
  )

  return (
    <View style={{ gap: sharedTokens.spacing.sm }}>
      {reviewAndSearch}
      <SegmentedContent value={props.viewMode} style={{ minHeight: 0 }}>
        {props.viewMode === 'list' ? (
          <KeyboardAwareScrollView
            scrollEnabled={false}
            contentContainerStyle={{
              paddingHorizontal: sharedTokens.spacing.md,
              paddingBottom: sharedTokens.spacing.sm,
              gap: sharedTokens.spacing.sm
            }}
          >
            <GraphScreenNodeList
              items={m.inventory.listed.items}
              total={m.inventory.listed.total}
              page={m.inventory.listed.page}
              pageSize={m.inventory.pageSize}
              totalPages={m.inventory.listed.totalPages}
              showPagination={m.inventory.listed.showPagination}
              query={search.query}
              onPageChange={m.inventory.setPage}
              onPageSizeChange={m.inventory.setPageSize}
              onOpenNode={props.onOpenNode}
            />
          </KeyboardAwareScrollView>
        ) : props.viewMode === 'graph' ? (
          <View
            style={{
              minHeight: 0,
              paddingBottom: sharedTokens.spacing.sm
            }}
          >
            {focused ? (
              canvas
            ) : (
              <View
                style={{
                  height: canvasHeight,
                  marginHorizontal: sharedTokens.spacing.md,
                  marginBottom: sharedTokens.spacing.sm
                }}
              />
            )}
          </View>
        ) : null}
      </SegmentedContent>
    </View>
  )
}
