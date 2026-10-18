import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { GraphFocusDepth } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, Checkbox, CompactSearchBar, useNativeTheme } from '@baishou/ui/native'
import { GraphDesktopOnlyNotice } from '../GraphScreen/GraphDesktopOnlyNotice'
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

  return (
    <>
      <View
        style={{
          height: canvasHeight,
          borderRadius: tokens.radius.md,
          overflow: 'hidden',
          backgroundColor: colors.bgSurface
        }}
      >
        <GraphDesktopOnlyNotice />
      </View>
      {props.searchHits.length > 0 ? (
        <View style={{ gap: tokens.spacing.xs }}>
          {props.searchHits.map((hit) => (
            <Card key={hit.id}>
              <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.xs }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.primary.fontSize,
                    fontWeight: mobileTypography.primary.fontWeight
                  }}
                >
                  {hit.name}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                >
                  {[hit.nodeType, hit.summary].filter(Boolean).join(' · ')}
                </Text>
                <Button size="sm" variant="outlined" onPress={() => props.onLocateNode(hit.id)}>
                  {t('graph.locate', '查看')}
                </Button>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      <View style={[styles.searchToolbar, { gap: tokens.spacing.sm }]}>
        <CompactSearchBar
          value={props.mergeSearchQuery}
          onChangeText={props.onMergeSearchQueryChange}
          onSubmitEditing={() => void props.onSearchMerge()}
          onClear={() => props.onMergeSearchQueryChange('')}
          placeholder={t('graph.merge_search_placeholder', '搜索要并入当前节点的节点…')}
        />
        <Button size="sm" isDisabled={props.busy} onPress={() => void props.onSearchMerge()}>
          {t('graph.search_merge', '搜索合并')}
        </Button>
      </View>
      {props.mergeHits.map((hit) => (
        <View key={hit.id} style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
          <Checkbox
            selected={props.mergeLoserIds.has(hit.id)}
            onPress={() => props.onToggleMergeLoser(hit.id)}
          />
          <Text
            style={{
              color: colors.textPrimary,
              flex: 1,
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {hit.name}
            {hit.nodeType ? ` · ${hit.nodeType}` : ''}
          </Text>
        </View>
      ))}
      {props.mergeLoserIds.size > 0 ? (
        <Button
          size="sm"
          isDisabled={props.reviewBusy || !props.selectedId}
          onPress={() => void props.onMergeSearched()}
        >
          {t('graph.merge_selected', '合并所选')}
        </Button>
      ) : null}
    </>
  )
}
