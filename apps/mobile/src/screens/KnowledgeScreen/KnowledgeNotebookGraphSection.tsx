import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native'
import { Settings } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { type GraphSimilarPendingPair } from '@baishou/shared'
import { mobileTypography, settingsIcons } from '@baishou/ui/theme/tokens'
import {
  Button,
  CompactSearchBar,
  FloatingModal,
  SegmentedContent,
  SegmentedControl,
  modalActionsStyle,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeGraphSearchHit } from './KnowledgeNotebookGraphCanvasTab'
import { GraphCanvasNodePeek } from '../GraphScreen/GraphCanvasNodePeek'
import { GraphForceWebView } from '../GraphScreen/GraphForceWebView'
import { KnowledgeNotebookGraphAppearance } from './KnowledgeNotebookGraphAppearance'
import { KnowledgeNotebookGraphNodeList } from './KnowledgeNotebookGraphNodeList'
import { KnowledgeNotebookGraphReviewBar } from './KnowledgeNotebookGraphReviewBar'
import { useNotebookGraphAppearance } from './useNotebookGraphAppearance'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'
import {
  notebookGraphHasInventory,
  resolveNotebookGraphList
} from './knowledge-notebook-graph.util'

export function KnowledgeNotebookGraphSection(props: {
  nodes: KnowledgeGraphNodeRow[]
  edges: KnowledgeGraphEdgeRow[]
  pagedNodes?: KnowledgeGraphNodeRow[]
  nodeTotal?: number
  nodeInventoryCount?: number
  edgeInventoryCount?: number
  loading?: boolean
  pendingNodes: KnowledgeGraphNodeRow[]
  pendingEdges: KnowledgeGraphEdgeRow[]
  similarPairs: GraphSimilarPendingPair[]
  searchQuery: string
  onSearchQueryChange: (value: string) => void
  onSearch?: (overrideQuery?: string, overrideMode?: 'text' | 'semantic') => void
  graphProgress: string
  onOpenReview: () => void
  onOpenNode: (nodeId: string) => void
  searchMode: 'text' | 'semantic'
  onSearchModeChange: (mode: 'text' | 'semantic') => void
  searchHits: KnowledgeGraphSearchHit[]
  nodePage: number
  nodePageSize: number
  onNodePageChange: (page: number) => void
  onNodePageSizeChange: (size: number) => void
  viewMode: 'list' | 'graph'
  onViewModeChange: (mode: 'list' | 'graph') => void
  fillRemaining?: boolean
  viewMaxNodes: number
  onViewMaxNodesChange: (value: number) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const {
    appearanceSettings,
    forceSettings,
    onAppearanceChange,
    onForceChange,
    resetGraphSettings
  } = useNotebookGraphAppearance()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [animationTick, setAnimationTick] = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const settingsSize = tokens.spacing.xl + tokens.spacing.md
  const isServerPaged = Boolean(props.pagedNodes)
  const displayNodes = props.pagedNodes ?? props.nodes

  useEffect(() => {
    if (props.viewMode !== 'graph') {
      setSelectedNodeId(null)
    }
  }, [props.viewMode])

  const selectedNode = useMemo(
    () =>
      selectedNodeId
        ? (displayNodes.find((n) => n.id === selectedNodeId) ??
          props.nodes.find((n) => n.id === selectedNodeId) ??
          null)
        : null,
    [selectedNodeId, displayNodes, props.nodes]
  )
  const listed = resolveNotebookGraphList({
    nodes: displayNodes,
    searchHits: props.searchHits,
    searchMode: props.searchMode,
    query: props.searchQuery,
    page: props.nodePage,
    pageSize: props.nodePageSize,
    totalOverride: props.nodeTotal,
    isServerPaged
  })
  const totalNodesCount = props.nodeInventoryCount ?? props.nodes.length
  const totalEdgesCount = props.edgeInventoryCount ?? props.edges.length
  const showNodeList =
    notebookGraphHasInventory(totalNodesCount) || props.searchQuery.trim().length > 0

  const canvasNodes = useMemo(
    () =>
      props.nodes.map((node) => ({
        id: node.id,
        name: node.name || node.id,
        nodeType: node.nodeType || 'topic',
        mentionCount: node.mentionCount,
        reviewStatus: node.reviewStatus
      })),
    [props.nodes]
  )

  const canvasEdges = useMemo(
    () =>
      props.edges.map((edge) => ({
        id: edge.id,
        fromId: edge.fromId,
        toId: edge.toId,
        edgeType: edge.edgeType || 'relates_to',
        reviewStatus: edge.reviewStatus
      })),
    [props.edges]
  )

  return (
    <View
      style={{
        flex: props.fillRemaining ? 1 : undefined,
        minHeight: props.fillRemaining ? 0 : undefined,
        marginHorizontal: tokens.spacing.md,
        marginTop: tokens.spacing.sm,
        gap: tokens.spacing.sm
      }}
    >
      <KnowledgeNotebookGraphReviewBar
        pendingNodeCount={props.pendingNodes.length}
        pendingEdgeCount={props.pendingEdges.length}
        similarPairCount={props.similarPairs.length}
        onOpenReview={props.onOpenReview}
      />
      {props.loading ? (
        <View
          style={{
            padding: tokens.spacing.xl,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: colors.borderControl,
            backgroundColor: colors.bgSurface,
            gap: tokens.spacing.sm,
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {t('knowledge.graph_loading', '正在加载图谱数据…')}
          </Text>
        </View>
      ) : !showNodeList && totalNodesCount === 0 && !props.searchQuery.trim() ? (
        <View
          style={{
            padding: tokens.spacing.md,
            borderRadius: tokens.radius.md,
            borderWidth: 1,
            borderColor: colors.borderControl,
            backgroundColor: colors.bgSurface,
            gap: tokens.spacing.xs,
            alignItems: 'center'
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: mobileTypography.primary.fontSize,
              fontWeight: mobileTypography.primary.fontWeight,
              textAlign: 'center'
            }}
          >
            {t('knowledge.graph_empty_title', '还没有开始整理这本笔记本的关系')}
          </Text>
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize,
              textAlign: 'center'
            }}
          >
            {t(
              'knowledge.graph_empty_desc',
              '可点击右下角整理按钮，自动分析这本笔记本中的人物、地点与事件关系。'
            )}
          </Text>
        </View>
      ) : null}
      {notebookGraphHasInventory(props.nodes.length) ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: mobileTypography.secondary.fontSize
          }}
        >
          {t('knowledge.graph_inventory', '已有节点 {{nodeCount}} · 关系 {{edgeCount}}', {
            nodeCount: totalNodesCount,
            edgeCount: totalEdgesCount
          })}
        </Text>
      ) : null}
      {props.graphProgress ? (
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: mobileTypography.secondary.fontSize,
            fontWeight: mobileTypography.secondary.fontWeight
          }}
        >
          {props.graphProgress}
        </Text>
      ) : null}
      <View style={styles.searchToolbar}>
        <CompactSearchBar
          value={props.searchQuery}
          onChangeText={(text) => {
            props.onSearchQueryChange(text)
            if (props.searchMode === 'semantic') props.onSearch?.(text)
          }}
          onSubmitEditing={() => void props.onSearch?.()}
          onClear={() => {
            props.onSearchQueryChange('')
            props.onSearch?.('')
          }}
          placeholder={t('graph.search_placeholder', '搜索节点名称或语义…')}
        />
        <View style={{ flexShrink: 0 }}>
          <SegmentedControl
            size="small"
            stretch={false}
            value={props.searchMode}
            onChange={(value) => {
              const nextMode = value as 'text' | 'semantic'
              props.onSearchModeChange(nextMode)
              if (nextMode === 'semantic' && props.searchQuery.trim()) {
                props.onSearch?.(undefined, nextMode)
              }
            }}
            options={[
              { value: 'semantic', label: t('settings.rag_search_semantic', '语义搜索') },
              { value: 'text', label: t('settings.rag_search_text', '文本搜索') }
            ]}
          />
        </View>
      </View>
      <SegmentedControl
        size="small"
        accessibilityLabel={t('graph.view_mode', '显示方式')}
        value={props.viewMode}
        onChange={(value) => props.onViewModeChange(value as 'list' | 'graph')}
        options={[
          { value: 'list', label: t('graph.view_list', '列表') },
          { value: 'graph', label: t('graph.view_graph', '关系图') }
        ]}
      />
      <SegmentedContent
        value={props.viewMode}
        style={{
          flex: props.fillRemaining ? 1 : undefined,
          minHeight: props.fillRemaining ? 0 : undefined
        }}
      >
        {props.viewMode === 'graph' ? (
          <>
            <View
              collapsable={false}
              style={{
                flex: props.fillRemaining ? 1 : undefined,
                height: props.fillRemaining ? undefined : tokens.spacing.xl * 18,
                minHeight: 0,
                borderRadius: tokens.radius.lg,
                overflow: 'hidden',
                backgroundColor: colors.bgSurface,
                borderWidth: 1,
                borderColor: colors.borderControl
              }}
            >
              <GraphForceWebView
                nodes={canvasNodes}
                edges={canvasEdges}
                forceSettings={forceSettings}
                appearanceSettings={appearanceSettings}
                selectedId={selectedNodeId}
                animationTick={animationTick}
                onSelectNode={(node) => setSelectedNodeId(node.id)}
                onClearSelection={() => setSelectedNodeId(null)}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  borderRadius: tokens.radius.lg,
                  borderWidth: 1,
                  borderColor: colors.borderControl
                }}
              />
              <View
                pointerEvents="box-none"
                style={{
                  position: 'absolute',
                  top: tokens.spacing.sm,
                  right: tokens.spacing.sm
                }}
              >
                <Pressable
                  onPress={() => setSettingsOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('graph.settings', '设置')}
                  style={{
                    width: settingsSize,
                    height: settingsSize,
                    borderRadius: tokens.radius.md,
                    borderWidth: 1,
                    borderColor: settingsOpen ? colors.primary : colors.borderControl,
                    backgroundColor: colors.bgSurface,
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Settings
                    size={settingsIcons.leading}
                    color={settingsOpen ? colors.primary : colors.textPrimary}
                    strokeWidth={2}
                  />
                </Pressable>
              </View>
              {selectedNodeId ? (
                <GraphCanvasNodePeek
                  name={selectedNode?.name || selectedNodeId}
                  onOpenDetail={() => props.onOpenNode(selectedNodeId)}
                  style={{ bottom: tokens.spacing.sm }}
                />
              ) : null}
            </View>
            <FloatingModal
              visible={settingsOpen}
              onClose={() => setSettingsOpen(false)}
              maxWidth={440}
              cardStyle={{ padding: tokens.spacing.lg }}
            >
              <View style={{ gap: tokens.spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.title.fontSize,
                    fontWeight: mobileTypography.title.fontWeight
                  }}
                >
                  {t('graph.settings', '设置')}
                </Text>
                <ScrollView
                  style={{ maxHeight: tokens.spacing.xl * 16 }}
                  contentContainerStyle={{
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.sm
                  }}
                  keyboardShouldPersistTaps="handled"
                >
                  <KnowledgeNotebookGraphAppearance
                    appearanceSettings={appearanceSettings}
                    forceSettings={forceSettings}
                    viewMaxNodes={props.viewMaxNodes}
                    onAppearanceChange={onAppearanceChange}
                    onForceChange={onForceChange}
                    onViewMaxNodesChange={props.onViewMaxNodesChange}
                    onReplayLayout={() => setAnimationTick((tick) => tick + 1)}
                    onResetGraphSettings={resetGraphSettings}
                  />
                </ScrollView>
                <View style={modalActionsStyle}>
                  <Button size="sm" onPress={() => setSettingsOpen(false)}>
                    {t('common.close', '关闭')}
                  </Button>
                </View>
              </View>
            </FloatingModal>
          </>
        ) : showNodeList ? (
          <KnowledgeNotebookGraphNodeList
            items={listed.items}
            total={listed.total}
            page={listed.page}
            pageSize={props.nodePageSize}
            totalPages={listed.totalPages}
            showPagination={listed.showPagination}
            query={props.searchQuery}
            onPageChange={props.onNodePageChange}
            onPageSizeChange={props.onNodePageSizeChange}
            onOpenNode={props.onOpenNode}
          />
        ) : null}
      </SegmentedContent>
    </View>
  )
}
