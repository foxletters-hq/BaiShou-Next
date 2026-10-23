import React, { memo, useCallback, useMemo, useRef } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { graphPendingItemKey } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  Checkbox,
  modalActionsStyle,
  scrollIndicatorStyle,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

/** 标题行高；复选框容器与之同高并居中，保证复选框和标题第一行对齐 */
const TITLE_LINE_HEIGHT = 22

type PendingKind = 'node' | 'edge'
type ReviewStatus = 'approved' | 'rejected'

type PendingListItem = {
  key: string
  kind: PendingKind
  id: string
  locateId: string
  title: string
  excerpt?: string
}

/**
 * 待确认卡片。回调都是稳定引用（父组件 useCallback 提供），配合 memo，
 * 勾选某一张时只重渲染它自己。
 */
const PendingItemCard = memo(function PendingItemCard(props: {
  kind: PendingKind
  id: string
  locateId: string
  selected: boolean
  title: string
  excerpt?: string
  reviewBusy: boolean
  onToggle: (kind: PendingKind, id: string) => void
  onLocate: (nodeId: string) => void
  onReview: (kind: PendingKind, id: string, status: ReviewStatus) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  return (
    <Card style={{ padding: 0 }}>
      <Pressable
        onPress={() => props.onToggle(props.kind, props.id)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: props.selected }}
        style={{ padding: tokens.spacing.md + tokens.spacing.sm, gap: tokens.spacing.sm }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: tokens.spacing.sm }}>
          <View style={{ height: TITLE_LINE_HEIGHT, justifyContent: 'center' }}>
            <Checkbox selected={props.selected} />
          </View>
          <Text
            style={{
              color: colors.textPrimary,
              flex: 1,
              fontSize: mobileTypography.primary.fontSize,
              fontWeight: mobileTypography.primary.fontWeight,
              lineHeight: TITLE_LINE_HEIGHT
            }}
          >
            {props.title}
          </Text>
        </View>
        {props.excerpt ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {props.excerpt}
          </Text>
        ) : null}
        <View style={[modalActionsStyle, { marginTop: 0 }]}>
          <Button
            size="sm"
            variant="outlined"
            isDisabled={props.reviewBusy}
            onPress={() => props.onLocate(props.locateId)}
          >
            {t('graph.locate', '查看')}
          </Button>
          <Button
            size="sm"
            isDisabled={props.reviewBusy}
            onPress={() => void props.onReview(props.kind, props.id, 'approved')}
          >
            {t('graph.approve', '通过')}
          </Button>
          <Button
            size="sm"
            isDisabled={props.reviewBusy}
            destructive
            onPress={() => void props.onReview(props.kind, props.id, 'rejected')}
          >
            {t('graph.reject', '拒绝')}
          </Button>
        </View>
      </Pressable>
    </Card>
  )
})

export function KnowledgeNotebookGraphPendingTab(props: {
  nodes: KnowledgeGraphNodeRow[]
  pendingNodes: KnowledgeGraphNodeRow[]
  pendingEdges: KnowledgeGraphEdgeRow[]
  pendingSelection: Set<string>
  reviewBusy: boolean
  reviewingSelectedStatus: 'approved' | 'rejected' | null
  onTogglePending: (kind: 'node' | 'edge', id: string) => void
  onToggleSelectAll: () => void
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void
  onReviewEdge: (edgeId: string, status: 'approved' | 'rejected') => void
  onReviewSelected: (status: 'approved' | 'rejected') => void
  onLocateNode: (nodeId: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()

  // 子组件拿到的回调引用必须稳定，否则 memo 失效；真正执行时读取最新 props
  const latest = useRef(props)
  latest.current = props
  const handleToggle = useCallback(
    (kind: PendingKind, id: string) => latest.current.onTogglePending(kind, id),
    []
  )
  const handleLocate = useCallback((nodeId: string) => latest.current.onLocateNode(nodeId), [])
  const handleReview = useCallback((kind: PendingKind, id: string, status: ReviewStatus) => {
    if (kind === 'node') void latest.current.onReviewNode(id, status)
    else void latest.current.onReviewEdge(id, status)
  }, [])

  // 列表项只依赖数据，不依赖勾选状态：勾选时不会重建整份列表
  const nameById = useMemo(
    () => new Map(props.nodes.map((node) => [node.id, node.name])),
    [props.nodes]
  )
  const items = useMemo<PendingListItem[]>(
    () => [
      ...props.pendingNodes.map((node) => ({
        key: `node-${node.id}`,
        kind: 'node' as const,
        id: node.id,
        locateId: node.id,
        title: `${t('graph.pending_node', '节点')} · ${node.name}`
      })),
      ...props.pendingEdges.map((edge) => ({
        key: `edge-${edge.id}`,
        kind: 'edge' as const,
        id: edge.id,
        locateId: edge.fromId,
        title: `${t('graph.pending_edge', '关系')} · ${nameById.get(edge.fromId) || edge.fromId} —${edge.edgeType}→ ${nameById.get(edge.toId) || edge.toId}`,
        excerpt: edge.sourceExcerpt || undefined
      }))
    ],
    [props.pendingNodes, props.pendingEdges, nameById, t]
  )

  // 选中数不足总数时直接判定为未全选，只有选满时才逐项核对
  const allSelected = useMemo(() => {
    if (items.length === 0 || props.pendingSelection.size < items.length) return false
    return items.every((item) =>
      props.pendingSelection.has(graphPendingItemKey(item.kind, item.id))
    )
  }, [items, props.pendingSelection])

  const renderItem = useCallback(
    ({ item }: { item: PendingListItem }) => (
      <PendingItemCard
        kind={item.kind}
        id={item.id}
        locateId={item.locateId}
        selected={props.pendingSelection.has(graphPendingItemKey(item.kind, item.id))}
        title={item.title}
        excerpt={item.excerpt}
        reviewBusy={props.reviewBusy}
        onToggle={handleToggle}
        onLocate={handleLocate}
        onReview={handleReview}
      />
    ),
    [props.pendingSelection, props.reviewBusy, handleToggle, handleLocate, handleReview]
  )

  const header = (
    <View style={{ gap: tokens.spacing.sm }}>
      {props.reviewingSelectedStatus ? (
        <View
          style={[
            styles.batchBar,
            {
              justifyContent: 'flex-start',
              gap: tokens.spacing.sm,
              paddingVertical: tokens.spacing.xs
            }
          ]}
          accessibilityLiveRegion="polite"
        >
          <ActivityIndicator size="small" color={colors.primary} />
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {props.reviewingSelectedStatus === 'approved'
              ? t('graph.approving_selected', '正在通过所选…')
              : t('graph.rejecting_selected', '正在拒绝所选…')}
          </Text>
        </View>
      ) : null}
      {items.length > 0 ? (
        <View style={[styles.batchBar, { gap: tokens.spacing.sm }]}>
          <View style={[styles.batchSelectAll, { gap: tokens.spacing.sm }]}>
            <Checkbox selected={allSelected} onPress={props.onToggleSelectAll} />
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: mobileTypography.secondary.fontSize
              }}
            >
              {t('graph.select_all', '全选')}
            </Text>
          </View>
          <View style={[styles.batchActions, { gap: tokens.spacing.sm }]}>
            <Button
              size="sm"
              isDisabled={props.reviewBusy || props.pendingSelection.size === 0}
              onPress={() => void props.onReviewSelected('approved')}
            >
              {t('graph.approve_selected', '通过所选')}
            </Button>
            <Button
              size="sm"
              isDisabled={props.reviewBusy || props.pendingSelection.size === 0}
              destructive
              onPress={() => void props.onReviewSelected('rejected')}
            >
              {t('graph.reject_selected', '拒绝所选')}
            </Button>
          </View>
        </View>
      ) : null}
    </View>
  )

  const empty = (
    <Text
      style={{
        color: colors.textSecondary,
        fontSize: mobileTypography.secondary.fontSize
      }}
    >
      {t('graph.no_pending', '暂无待确认内容')}
    </Text>
  )

  return (
    <FlatList
      style={{ flex: 1 }}
      data={items}
      keyExtractor={(item) => item.key}
      renderItem={renderItem}
      ListHeaderComponent={header}
      ListEmptyComponent={props.reviewingSelectedStatus ? null : empty}
      keyboardShouldPersistTaps="handled"
      indicatorStyle={scrollIndicatorStyle(isDark)}
      contentContainerStyle={{
        padding: tokens.spacing.md,
        paddingBottom: tokens.spacing.xl * 2,
        gap: tokens.spacing.sm
      }}
      initialNumToRender={12}
      maxToRenderPerBatch={8}
      windowSize={7}
    />
  )
}
