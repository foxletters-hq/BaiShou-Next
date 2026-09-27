import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { GraphSimilarPendingPair, GraphFocusDepth } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  Input,
  SegmentedControl,
  SettingsSection,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import {
  KnowledgeNotebookGraphCanvasTab,
  type KnowledgeGraphSearchHit
} from './KnowledgeNotebookGraphCanvasTab'
import { KnowledgeNotebookGraphPendingTab } from './KnowledgeNotebookGraphPendingTab'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

type GraphTab = 'canvas' | 'pending' | 'similar'

export function KnowledgeNotebookGraphSection(props: {
  nodes: KnowledgeGraphNodeRow[]
  edges: KnowledgeGraphEdgeRow[]
  pendingNodes: KnowledgeGraphNodeRow[]
  pendingEdges: KnowledgeGraphEdgeRow[]
  similarPairs: GraphSimilarPendingPair[]
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearch: () => void
  selectedId: string | null
  highlightIds: Set<string>
  locateIds: string[] | null
  locateSeq: number
  onSelectNode: (id: string) => void
  onClearSelection: () => void
  tab: GraphTab
  onTabChange: (tab: GraphTab) => void
  graphProgress: string
  busy: boolean
  reviewBusy: boolean
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void
  onReviewEdge: (edgeId: string, status: 'approved' | 'rejected') => void
  onReviewAll: (status: 'approved' | 'rejected') => void
  onMergeSimilar: (pair: GraphSimilarPendingPair) => void
  onDismissSimilar: (pair: GraphSimilarPendingPair) => void
  onLocateNode: (nodeId: string) => void
  onPreviewFragments: (edges: KnowledgeGraphEdgeRow[]) => void
  searchMode: 'text' | 'semantic'
  onSearchModeChange: (mode: 'text' | 'semantic') => void
  viewMaxNodes: number
  onViewMaxNodesChange: (value: number) => void
  focusDepth: GraphFocusDepth
  onFocusDepthChange: (depth: GraphFocusDepth) => void
  searchHits: KnowledgeGraphSearchHit[]
  mergeSearchQuery: string
  onMergeSearchQueryChange: (value: string) => void
  onSearchMerge: () => void
  mergeHits: Array<{ id: string; name: string; nodeType?: string }>
  mergeLoserIds: Set<string>
  onToggleMergeLoser: (id: string) => void
  onMergeSearched: () => void
  pendingSelection: Set<string>
  onTogglePending: (kind: 'node' | 'edge', id: string) => void
  onToggleSelectAllPending: () => void
  onReviewSelected: (status: 'approved' | 'rejected') => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const pendingCount = props.pendingNodes.length + props.pendingEdges.length
  const selectedNode = props.nodes.find((node) => node.id === props.selectedId)
  const relatedEdges = props.edges.filter(
    (edge) => edge.fromId === props.selectedId || edge.toId === props.selectedId
  )

  return (
    <SettingsSection title={t('knowledge.graph_panel', '本笔记本图谱')}>
      <View style={{ padding: tokens.spacing.md, gap: tokens.spacing.sm }}>
        {props.graphProgress ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize,
              fontWeight: settingsTypography.desc.fontWeight
            }}
          >
            {props.graphProgress}
          </Text>
        ) : null}
        <Input
          value={props.searchQuery}
          onChangeText={props.onSearchQueryChange}
          placeholder={t('graph.search_placeholder', '搜索节点')}
        />
        <SegmentedControl
          value={props.searchMode}
          onChange={(value) => props.onSearchModeChange(value as 'text' | 'semantic')}
          options={[
            { value: 'text', label: t('knowledge.vector_search_text', '文本') },
            { value: 'semantic', label: t('knowledge.vector_search_semantic', '语义') }
          ]}
        />
        <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
          <Button isDisabled={props.busy} onPress={() => void props.onSearch()}>
            {t('common.search', '搜索')}
          </Button>
        </View>
        <SegmentedControl
          value={props.tab}
          onChange={(value) => props.onTabChange(value as GraphTab)}
          options={[
            { value: 'canvas', label: t('graph.tab_canvas', '画布') },
            {
              value: 'pending',
              label: t('graph.tab_pending_count', '待确认 ({{count}})', { count: pendingCount })
            },
            {
              value: 'similar',
              label: t('graph.tab_similar_count', '相似待合并 ({{count}})', {
                count: props.similarPairs.length
              })
            }
          ]}
        />
        {props.tab === 'canvas' ? (
          <KnowledgeNotebookGraphCanvasTab
            nodes={props.nodes}
            edges={props.edges}
            selectedId={props.selectedId}
            highlightIds={props.highlightIds}
            locateIds={props.locateIds}
            locateSeq={props.locateSeq}
            onSelectNode={props.onSelectNode}
            onClearSelection={props.onClearSelection}
            busy={props.busy}
            reviewBusy={props.reviewBusy}
            viewMaxNodes={props.viewMaxNodes}
            onViewMaxNodesChange={props.onViewMaxNodesChange}
            focusDepth={props.focusDepth}
            onFocusDepthChange={props.onFocusDepthChange}
            searchHits={props.searchHits}
            onLocateNode={props.onLocateNode}
            mergeSearchQuery={props.mergeSearchQuery}
            onMergeSearchQueryChange={props.onMergeSearchQueryChange}
            onSearchMerge={props.onSearchMerge}
            mergeHits={props.mergeHits}
            mergeLoserIds={props.mergeLoserIds}
            onToggleMergeLoser={props.onToggleMergeLoser}
            onMergeSearched={props.onMergeSearched}
          />
        ) : null}
        {props.selectedId ? (
          <Card>
            <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.sm }}>
              <Text
                style={{ color: colors.textPrimary, fontSize: settingsTypography.row.fontSize }}
              >
                {selectedNode?.name || props.selectedId}
              </Text>
              {selectedNode?.nodeType ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: settingsTypography.desc.fontSize
                  }}
                >
                  {t('graph.node_type', '类型')} · {selectedNode.nodeType}
                </Text>
              ) : null}
              {selectedNode?.mentionCount != null ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: settingsTypography.desc.fontSize
                  }}
                >
                  {t('graph.mention_count', '提及 {{count}} 次', {
                    count: selectedNode.mentionCount
                  })}
                </Text>
              ) : null}
              <Text
                style={{ color: colors.textSecondary, fontSize: settingsTypography.desc.fontSize }}
              >
                {selectedNode?.summary ||
                  t('graph.node_detail_empty', '点选节点后可以在这里看名称和摘要')}
              </Text>
              {relatedEdges.map((edge) => {
                const otherId = edge.fromId === props.selectedId ? edge.toId : edge.fromId
                const other = props.nodes.find((node) => node.id === otherId)?.name || otherId
                return (
                  <View key={edge.id} style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                    <Text style={{ color: colors.textPrimary, flex: 1 }}>
                      {edge.edgeType} · {other}
                    </Text>
                    <Button variant="outlined" onPress={() => props.onLocateNode(otherId)}>
                      {t('graph.view_on_canvas', '在画布查看')}
                    </Button>
                    {edge.reviewStatus === 'pending' ? (
                      <>
                        <Button
                          isDisabled={props.reviewBusy}
                          onPress={() => void props.onReviewEdge(edge.id, 'approved')}
                        >
                          {t('graph.approve', '通过')}
                        </Button>
                        <Button
                          destructive
                          isDisabled={props.reviewBusy}
                          onPress={() => void props.onReviewEdge(edge.id, 'rejected')}
                        >
                          {t('graph.reject', '拒绝')}
                        </Button>
                      </>
                    ) : null}
                  </View>
                )
              })}
              <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                {selectedNode?.reviewStatus === 'pending' ? (
                  <>
                    <Button
                      isDisabled={props.reviewBusy}
                      onPress={() => void props.onReviewNode(selectedNode.id, 'approved')}
                    >
                      {t('graph.approve', '通过')}
                    </Button>
                    <Button
                      destructive
                      isDisabled={props.reviewBusy}
                      onPress={() => void props.onReviewNode(selectedNode.id, 'rejected')}
                    >
                      {t('graph.reject', '拒绝')}
                    </Button>
                  </>
                ) : null}
                <Button
                  variant="outlined"
                  isDisabled={relatedEdges.length === 0}
                  onPress={() => void props.onPreviewFragments(relatedEdges)}
                >
                  {t('knowledge.graph_fragments', '查看原文窗口')}
                </Button>
              </View>
            </View>
          </Card>
        ) : null}
        {props.tab === 'pending' ? (
          <KnowledgeNotebookGraphPendingTab
            nodes={props.nodes}
            pendingNodes={props.pendingNodes}
            pendingEdges={props.pendingEdges}
            pendingSelection={props.pendingSelection}
            reviewBusy={props.reviewBusy}
            onTogglePending={props.onTogglePending}
            onToggleSelectAll={props.onToggleSelectAllPending}
            onReviewNode={props.onReviewNode}
            onReviewEdge={props.onReviewEdge}
            onReviewAll={props.onReviewAll}
            onReviewSelected={props.onReviewSelected}
            onLocateNode={props.onLocateNode}
          />
        ) : null}
        {props.tab === 'similar' ? (
          <View style={{ gap: tokens.spacing.sm }}>
            {props.similarPairs.length === 0 ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: settingsTypography.desc.fontSize
                }}
              >
                {t('graph.no_similar_pending', '没有相似待合并')}
              </Text>
            ) : (
              props.similarPairs.map((pair) => (
                <Card key={`${pair.nodeId}:${pair.peerId}`}>
                  <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.sm }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: settingsTypography.row.fontSize,
                        fontWeight: settingsTypography.row.fontWeight
                      }}
                    >
                      {pair.nodeName} · {pair.peerName}
                    </Text>
                    <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                      <Button variant="outlined" onPress={() => props.onLocateNode(pair.nodeId)}>
                        {t('graph.view_on_canvas', '在画布查看')}
                      </Button>
                    </View>
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: settingsTypography.desc.fontSize
                      }}
                    >
                      {pair.reason || t('graph.similar_pending', '相似待合并')}
                    </Text>
                    <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                      <Button
                        isDisabled={props.reviewBusy}
                        onPress={() => void props.onMergeSimilar(pair)}
                      >
                        {t('graph.merge', '合并')}
                      </Button>
                      <Button
                        variant="outlined"
                        isDisabled={props.reviewBusy}
                        onPress={() => void props.onDismissSimilar(pair)}
                      >
                        {t('graph.keep_apart', '分开保留')}
                      </Button>
                    </View>
                  </View>
                </Card>
              ))
            )}
          </View>
        ) : null}
      </View>
    </SettingsSection>
  )
}
