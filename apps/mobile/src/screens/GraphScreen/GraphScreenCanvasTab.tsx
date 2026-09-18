import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  formatGraphMonth,
  parseGraphMonthToDate,
  type GraphAppearanceSettings,
  type GraphFocusDepth,
  type GraphForceSettings,
  type GraphMonthRange
} from '@baishou/shared'
import { useNativeTheme } from '@baishou/ui/native'
import { GraphForceWebView } from './GraphForceWebView'
import { GraphMonthRangeSheet } from './GraphMonthRangeSheet'
import { GraphScreenDepthChips } from './GraphScreenDepthChips'
import { GraphScreenDetailPane } from './GraphScreenDetailPane'
import { styles } from './GraphScreen.styles'
import type { GraphCostEstimate, GraphEditNameConflict } from './graph-screen.types'
import type { GraphRegisteredSameNameEntity } from '@/src/services/graph-name-candidates.util'

export function GraphScreenCanvasTab(props: {
  showEmptyGuide: boolean
  showMonthEmpty: boolean
  monthRange: GraphMonthRange
  onMonthRangeChange: (next: GraphMonthRange | Partial<GraphMonthRange>) => void
  onClearToGlobal: () => void
  filterActive: boolean
  mergeSearchOpen: boolean
  onOpenSettings: () => void
  focusDepth: GraphFocusDepth
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  selectedNode: any | null
  estimate: GraphCostEstimate | null
  pendingCount: number
  formatTokens: (n: number) => string
  onStartOrganize: () => void
  onDismissGuide: () => void
  onResetMonthRange: () => void
  displayNodes: any[]
  displayEdges: any[]
  forceSettings: GraphForceSettings
  appearanceSettings: GraphAppearanceSettings
  selectedId: string | null
  focusIds?: Set<string> | null
  highlightIds: Set<string>
  highlightedEdgeIds: Set<string>
  locateIds: string[] | null
  locateSeq: number
  animationTick: number
  onSelectNode: (id: string) => void
  onClearSelection: () => void
  detail: {
    editName: string
    onEditNameChange: (value: string) => void
    editNameConflict: GraphEditNameConflict | null
    sameNameEntities: GraphRegisteredSameNameEntity[]
    editSummary: string
    onEditSummaryChange: (value: string) => void
    editAliases: string
    onEditAliasesChange: (value: string) => void
    busy: boolean
    onSaveNodeEdit: () => void
    onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void
    onDeleteSelected: () => void
    onOpenSplit: () => void
    onRevertSplit: (discriminator: string) => void
    onMergeIntoExisting: (
      survivorId: string,
      survivorName: string,
      loserId: string,
      loserName: string
    ) => void
    detailEdges: Array<{ edge: any; partnerName: string }>
    onOpenSource: (ref: string | null | undefined, excerpt?: string | null) => void
    onReviewEdge: (
      edgeId: string,
      status: 'approved' | 'rejected',
      endpoints?: { fromId?: string; toId?: string }
    ) => void
    onDeleteEdge: (edgeId: string) => void
    addEdgeQuery: string
    onAddEdgeQueryChange: (value: string) => void
    onSearchAddEdgeTarget: () => void
    addEdgeType: string
    onAddEdgeTypeChange: (value: string) => void
    addEdgeToId: string
    onAddEdgeToIdChange: (id: string) => void
    onAddEdge: () => void
    addEdgeHits: any[]
  }
  paddingBottom: number
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const renderDepthChips = () => (
    <GraphScreenDepthChips focusDepth={props.focusDepth} onChange={props.onFocusDepthChange} />
  )

  return (
    <View style={[styles.graphBody, { paddingBottom: props.paddingBottom }]}>
      {!props.showEmptyGuide ? (
        <>
          <View style={styles.toolbarRow}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <GraphMonthRangeSheet value={props.monthRange} onChange={props.onMonthRangeChange} />
            </View>
            <Pressable
              onPress={props.onClearToGlobal}
              accessibilityRole="button"
              accessibilityLabel={t('graph.global_view', '全局')}
              accessibilityHint={t(
                'graph.global_view_hint',
                '退出当前查看的局部关系，显示这个月份范围内的全部节点。不会改月份范围。'
              )}
              style={[
                styles.toolBtn,
                {
                  borderColor: colors.borderSubtle,
                  backgroundColor: colors.bgSurfaceNormal
                }
              ]}
            >
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                {t('graph.global_view', '全局')}
              </Text>
            </Pressable>
            <Pressable
              onPress={props.onOpenSettings}
              style={[
                styles.toolBtn,
                {
                  borderColor:
                    props.filterActive || props.mergeSearchOpen
                      ? colors.primary
                      : colors.borderSubtle,
                  backgroundColor: colors.bgSurfaceNormal
                }
              ]}
            >
              <Text
                style={{
                  color:
                    props.filterActive || props.mergeSearchOpen
                      ? colors.primary
                      : colors.textSecondary,
                  fontSize: 12,
                  fontWeight: '600'
                }}
              >
                {t('graph.settings', '设置')}
              </Text>
            </Pressable>
          </View>
          {renderDepthChips()}
        </>
      ) : null}

      {props.selectedNode ? (
        <GraphScreenDetailPane
          selectedNode={props.selectedNode}
          editName={props.detail.editName}
          onEditNameChange={props.detail.onEditNameChange}
          editNameConflict={props.detail.editNameConflict}
          sameNameEntities={props.detail.sameNameEntities}
          editSummary={props.detail.editSummary}
          onEditSummaryChange={props.detail.onEditSummaryChange}
          editAliases={props.detail.editAliases}
          onEditAliasesChange={props.detail.onEditAliasesChange}
          busy={props.detail.busy}
          onSaveNodeEdit={props.detail.onSaveNodeEdit}
          onReviewNode={props.detail.onReviewNode}
          onDeleteSelected={props.detail.onDeleteSelected}
          onOpenSplit={props.detail.onOpenSplit}
          onRevertSplit={props.detail.onRevertSplit}
          onSelectNode={props.onSelectNode}
          onMergeIntoExisting={props.detail.onMergeIntoExisting}
          detailEdges={props.detail.detailEdges}
          onOpenSource={props.detail.onOpenSource}
          onReviewEdge={props.detail.onReviewEdge}
          onDeleteEdge={props.detail.onDeleteEdge}
          addEdgeQuery={props.detail.addEdgeQuery}
          onAddEdgeQueryChange={props.detail.onAddEdgeQueryChange}
          onSearchAddEdgeTarget={props.detail.onSearchAddEdgeTarget}
          addEdgeType={props.detail.addEdgeType}
          onAddEdgeTypeChange={props.detail.onAddEdgeTypeChange}
          addEdgeToId={props.detail.addEdgeToId}
          onAddEdgeToIdChange={props.detail.onAddEdgeToIdChange}
          onAddEdge={props.detail.onAddEdge}
          addEdgeHits={props.detail.addEdgeHits}
        />
      ) : null}

      {props.showEmptyGuide ? (
        <View style={styles.guide}>
          <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
            {t('graph.empty_guide_title', '还没有开始整理你的人生关系图')}
          </Text>
          <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
            {t(
              'graph.empty_guide_body',
              '发现 {{count}} 篇日记可以分析，预计消耗 {{tokens}} tokens，用时约 {{minLow}}–{{minHigh}} 分钟。',
              {
                count: props.estimate?.entryCount ?? props.pendingCount,
                tokens: props.formatTokens(props.estimate?.estimatedTokens ?? 0),
                minLow: props.estimate?.estimatedMinutesLow ?? 1,
                minHigh: props.estimate?.estimatedMinutesHigh ?? 1
              }
            )}
          </Text>
          <View style={styles.row}>
            <Pressable onPress={props.onStartOrganize}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {t('graph.start_organize', '开始整理')}
              </Text>
            </Pressable>
            <Pressable onPress={props.onDismissGuide}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                {t('graph.later', '以后再说')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : props.showMonthEmpty ? (
        <View style={styles.guide}>
          <Text style={[styles.guideTitle, { color: colors.textPrimary }]}>
            {t('graph.month_empty_title', '这个月份范围内还没有关系')}
          </Text>
          <Text style={[styles.guideBody, { color: colors.textSecondary }]}>
            {t(
              'graph.month_empty_body',
              '当前显示 {{start}} — {{end}}。可扩大月份范围，或先梳理日记。',
              {
                start: props.monthRange.startMonth,
                end: props.monthRange.endMonth
              }
            )}
          </Text>
          <View style={styles.row}>
            <Pressable onPress={props.onResetMonthRange}>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {t('graph.month_range_recent3', '近3月')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const start = parseGraphMonthToDate(props.monthRange.startMonth)
                start.setMonth(start.getMonth() - 12)
                props.onMonthRangeChange({
                  startMonth: formatGraphMonth(start),
                  endMonth: props.monthRange.endMonth
                })
              }}
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t('graph.month_range_earlier', '再往前一年')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={[styles.webWrap, { backgroundColor: colors.bgApp }]}>
          <GraphForceWebView
            nodes={props.displayNodes.map((n) => ({
              id: n.id,
              name: n.name,
              discriminator: n.discriminator,
              nodeType: n.nodeType,
              mentionCount: n.mentionCount,
              reviewStatus: n.reviewStatus
            }))}
            edges={props.displayEdges.map((e) => ({
              id: e.id,
              fromId: e.fromId,
              toId: e.toId,
              edgeType: e.edgeType,
              reviewStatus: e.reviewStatus
            }))}
            forceSettings={props.forceSettings}
            appearanceSettings={props.appearanceSettings}
            selectedId={props.selectedId}
            focusIds={props.focusIds}
            highlightIds={props.highlightIds}
            highlightEdgeIds={props.highlightedEdgeIds}
            locateIds={props.locateIds}
            locateSeq={props.locateSeq}
            animationTick={props.animationTick}
            onSelectNode={(n) => void props.onSelectNode(n.id)}
            onClearSelection={props.onClearSelection}
          />
        </View>
      )}
    </View>
  )
}
