import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { GraphSimilarPendingPair } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, Input, SegmentedControl, SettingsSection, useNativeTheme } from '@baishou/ui/native'
import { GraphForceWebView } from '../GraphScreen/GraphForceWebView'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
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
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const pendingCount = props.pendingNodes.length + props.pendingEdges.length
  const canvasHeight = tokens.spacing.xl * 9

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
              highlightIds={props.highlightIds}
              locateIds={props.locateIds}
              locateSeq={props.locateSeq}
              onSelectNode={(node) => props.onSelectNode(node.id)}
              onClearSelection={props.onClearSelection}
            />
          </View>
        ) : null}
        {props.tab === 'pending' ? (
          <View style={{ gap: tokens.spacing.sm }}>
            {pendingCount === 0 ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: settingsTypography.desc.fontSize
                }}
              >
                {t('graph.no_pending', '暂无待确认内容')}
              </Text>
            ) : (
              <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                <Button
                  isDisabled={props.reviewBusy}
                  onPress={() => void props.onReviewAll('approved')}
                >
                  {t('graph.approve_all', '全部通过')}
                </Button>
                <Button
                  isDisabled={props.reviewBusy}
                  destructive
                  onPress={() => void props.onReviewAll('rejected')}
                >
                  {t('graph.reject_all', '全部拒绝')}
                </Button>
              </View>
            )}
            {props.pendingNodes.map((node) => (
              <Card key={node.id}>
                <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.sm }}>
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: settingsTypography.row.fontSize,
                      fontWeight: settingsTypography.row.fontWeight
                    }}
                  >
                    {t('graph.pending_node', '节点')} · {node.name}
                  </Text>
                  <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                    <Button
                      isDisabled={props.reviewBusy}
                      onPress={() => void props.onReviewNode(node.id, 'approved')}
                    >
                      {t('graph.approve', '通过')}
                    </Button>
                    <Button
                      isDisabled={props.reviewBusy}
                      destructive
                      onPress={() => void props.onReviewNode(node.id, 'rejected')}
                    >
                      {t('graph.reject', '拒绝')}
                    </Button>
                  </View>
                </View>
              </Card>
            ))}
            {props.pendingEdges.map((edge) => {
              const from = props.nodes.find((node) => node.id === edge.fromId)?.name || edge.fromId
              const to = props.nodes.find((node) => node.id === edge.toId)?.name || edge.toId
              return (
                <Card key={edge.id}>
                  <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.sm }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: settingsTypography.row.fontSize,
                        fontWeight: settingsTypography.row.fontWeight
                      }}
                    >
                      {t('graph.pending_edge', '关系')} · {from} —{edge.edgeType}→ {to}
                    </Text>
                    {edge.sourceExcerpt ? (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: settingsTypography.desc.fontSize
                        }}
                      >
                        {edge.sourceExcerpt}
                      </Text>
                    ) : null}
                    <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                      <Button
                        isDisabled={props.reviewBusy}
                        onPress={() => void props.onReviewEdge(edge.id, 'approved')}
                      >
                        {t('graph.approve', '通过')}
                      </Button>
                      <Button
                        isDisabled={props.reviewBusy}
                        destructive
                        onPress={() => void props.onReviewEdge(edge.id, 'rejected')}
                      >
                        {t('graph.reject', '拒绝')}
                      </Button>
                    </View>
                  </View>
                </Card>
              )
            })}
          </View>
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
