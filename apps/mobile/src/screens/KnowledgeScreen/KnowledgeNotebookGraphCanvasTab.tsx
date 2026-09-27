import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  GRAPH_FOCUS_DEPTH_OPTIONS,
  GRAPH_VIEW_MAX_NODES_MAX,
  GRAPH_VIEW_MAX_NODES_MIN,
  GRAPH_VIEW_MAX_NODES_STEP,
  clampGraphFocusDepth,
  collectGraphFocusIds,
  graphViewMaxNodesSliderValue,
  isGraphViewMaxNodesUnlimited,
  type GraphFocusDepth
} from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  Checkbox,
  Input,
  NativeSlider,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
import { GraphForceWebView } from '../GraphScreen/GraphForceWebView'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

export type KnowledgeGraphSearchHit = {
  id: string
  name: string
  nodeType?: string
  summary?: string
}

export function KnowledgeNotebookGraphCanvasTab(props: {
  nodes: KnowledgeGraphNodeRow[]
  edges: KnowledgeGraphEdgeRow[]
  selectedId: string | null
  highlightIds: Set<string>
  locateIds: string[] | null
  locateSeq: number
  onSelectNode: (id: string) => void
  onClearSelection: () => void
  busy: boolean
  reviewBusy: boolean
  viewMaxNodes: number
  onViewMaxNodesChange: (value: number) => void
  focusDepth: GraphFocusDepth
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  searchHits: KnowledgeGraphSearchHit[]
  onLocateNode: (nodeId: string) => void
  mergeSearchQuery: string
  onMergeSearchQueryChange: (value: string) => void
  onSearchMerge: () => void
  mergeHits: Array<{ id: string; name: string; nodeType?: string }>
  mergeLoserIds: Set<string>
  onToggleMergeLoser: (id: string) => void
  onMergeSearched: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const canvasHeight = tokens.spacing.xl * 9
  const focusIds = props.selectedId
    ? collectGraphFocusIds(props.selectedId, props.edges, props.focusDepth)
    : null

  return (
    <>
      <View
        style={{
          height: canvasHeight,
          borderRadius: tokens.radius.md,
          overflow: 'hidden'
        }}
      >
        <GraphForceWebView
          nodes={props.nodes}
          edges={props.edges}
          selectedId={props.selectedId}
          focusIds={focusIds}
          highlightIds={props.highlightIds}
          locateIds={props.locateIds}
          locateSeq={props.locateSeq}
          onSelectNode={(node) => props.onSelectNode(node.id)}
          onClearSelection={props.onClearSelection}
        />
      </View>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: settingsTypography.desc.fontSize
        }}
      >
        {t('graph.focus_depth', '展开')}
      </Text>
      <SegmentedControl
        value={String(props.focusDepth)}
        onChange={(value) => props.onFocusDepthChange(clampGraphFocusDepth(value))}
        options={GRAPH_FOCUS_DEPTH_OPTIONS.map((depth) => ({
          value: String(depth),
          label: `${depth}${t('graph.focus_depth_unit', '级')}`
        }))}
      />
      {props.searchHits.length > 0 ? (
        <View style={{ gap: tokens.spacing.xs }}>
          {props.searchHits.map((hit) => (
            <Card key={hit.id}>
              <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.xs }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: settingsTypography.row.fontSize
                  }}
                >
                  {hit.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: settingsTypography.desc.fontSize
                  }}
                >
                  {[hit.nodeType, hit.summary].filter(Boolean).join(' · ')}
                </Text>
                <Button variant="outlined" onPress={() => props.onLocateNode(hit.id)}>
                  {t('graph.view_on_canvas', '在画布查看')}
                </Button>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: settingsTypography.desc.fontSize
        }}
      >
        {t('graph.max_nodes', '最多节点')}
        {isGraphViewMaxNodesUnlimited(props.viewMaxNodes)
          ? ` · ${t('graph.unlimited', '不限制')}`
          : ` · ${props.viewMaxNodes}`}
      </Text>
      <NativeSlider
        value={graphViewMaxNodesSliderValue(props.viewMaxNodes)}
        minValue={GRAPH_VIEW_MAX_NODES_MIN}
        maxValue={GRAPH_VIEW_MAX_NODES_MAX}
        step={GRAPH_VIEW_MAX_NODES_STEP}
        onChange={(value) => void props.onViewMaxNodesChange(value)}
      />
      <Input
        value={props.mergeSearchQuery}
        onChangeText={props.onMergeSearchQueryChange}
        placeholder={t('graph.merge_search', '搜索要并入当前节点的节点')}
      />
      <Button isDisabled={props.busy} onPress={() => void props.onSearchMerge()}>
        {t('graph.search_merge', '搜索合并')}
      </Button>
      {props.mergeHits.map((hit) => (
        <View key={hit.id} style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
          <Checkbox
            selected={props.mergeLoserIds.has(hit.id)}
            onPress={() => props.onToggleMergeLoser(hit.id)}
          />
          <Text style={{ color: colors.textPrimary, flex: 1 }}>
            {hit.name}
            {hit.nodeType ? ` · ${hit.nodeType}` : ''}
          </Text>
        </View>
      ))}
      {props.mergeLoserIds.size > 0 ? (
        <Button
          isDisabled={props.reviewBusy || !props.selectedId}
          onPress={() => void props.onMergeSearched()}
        >
          {t('graph.merge_selected', '合并所选')}
        </Button>
      ) : null}
    </>
  )
}
