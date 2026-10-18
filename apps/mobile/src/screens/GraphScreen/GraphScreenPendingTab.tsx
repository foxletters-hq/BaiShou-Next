import React from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  graphPendingItemKey,
  resolveGraphNodeDisplayName,
  translateGraphEdgeType,
  translateGraphNodeType
} from '@baishou/shared'
import { Checkbox, useNativeTheme } from '@baishou/ui/native'
import {
  graphSuspectReviewCopy,
  readGraphNodeSuspectReason
} from '@/src/services/graph-name-candidates.util'
import { GraphDiscriminatorLabel } from './GraphNodeSameNameList'
import { styles } from './GraphScreen.styles'
import type { GraphPendingItem } from './graph-screen.types'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export function GraphScreenPendingTab(props: {
  pendingItems: GraphPendingItem[]
  pendingSelected: Set<string>
  pendingSelectedCount: number
  allPendingSelected: boolean
  reviewingSelectedStatus?: 'approved' | 'rejected' | null
  graphNodeNameById: Map<string, string>
  busy: boolean
  onToggleSelectAll: () => void
  onToggleItem: (key: string) => void
  onApplyReviews: (opts: { reviewStatus: 'approved' | 'rejected'; allPending?: boolean }) => void
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void
  onReviewEdge: (
    edgeId: string,
    status: 'approved' | 'rejected',
    endpoints?: { fromId?: string; toId?: string }
  ) => void
  onLocateNode: (id: string) => void
  onViewNodeSource: (nodeId: string, node: unknown) => void
  onLocateEdge: (edge: {
    id: string
    fromId: string
    toId: string
    edgeType?: string
    reviewStatus?: string
  }) => void
  onOpenSource: (ref: string | null | undefined, excerpt?: string | null) => void
  listPad: { padding: number; paddingBottom: number }
}) {
  const { t } = useTranslation()
  const tr = (key: string, defaultValue?: string) => t(key, defaultValue ?? '')
  const { colors } = useNativeTheme()

  return (
    <View style={styles.pendingPane}>
      {props.pendingItems.length > 0 ? (
        <View style={styles.pendingToolbar}>
          <View
            style={[
              styles.pendingHintBox,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderControl
              }
            ]}
          >
            <Text style={[styles.pendingHintText, { color: colors.textSecondary }]}>
              {t(
                'graph.pending_hint',
                '确认关系会同时通过两端节点；确认节点也会通过与它相连的待审关系。可勾选后批量处理。'
              )}
            </Text>
            {props.pendingItems.some(
              (item) => item.kind === 'node' && readGraphNodeSuspectReason(item.data)
            ) ? (
              <Text style={[styles.pendingHintText, { color: colors.textSecondary }]}>
                {t(
                  'graph.suspect_pending_hint',
                  '带「可疑」的节点可能把多个现实实体折在一起。通过表示就是一个人；要拆开请点详情后拆分。'
                )}
              </Text>
            ) : null}
          </View>
          <View style={styles.pendingToolbarRow}>
            <View style={styles.pendingSelectAllGroup}>
              <Pressable
                onPress={props.onToggleSelectAll}
                hitSlop={10}
                style={styles.pendingSelectAll}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: props.allPendingSelected
                    ? true
                    : props.pendingSelectedCount > 0
                      ? 'mixed'
                      : false
                }}
              >
                <Checkbox
                  size="md"
                  selected={props.allPendingSelected}
                  indeterminate={props.pendingSelectedCount > 0 && !props.allPendingSelected}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.body.fontSize,
                    fontWeight: '600'
                  }}
                >
                  {props.allPendingSelected
                    ? t('graph.pending_deselect_all', '取消全选')
                    : t('graph.pending_select_all', '全选')}
                </Text>
              </Pressable>
              <Text
                style={{ color: colors.textSecondary, fontSize: mobileTypography.caption.fontSize }}
              >
                {t('graph.pending_selected_count', '已选 {{count}} 项', {
                  count: props.pendingSelectedCount
                })}
              </Text>
            </View>
            <View style={styles.pendingToolbarActions}>
              <Pressable
                disabled={
                  props.busy ||
                  props.pendingSelectedCount === 0 ||
                  Boolean(props.reviewingSelectedStatus)
                }
                onPress={() => void props.onApplyReviews({ reviewStatus: 'approved' })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}
              >
                {props.reviewingSelectedStatus === 'approved' ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : null}
                <Text
                  style={{
                    color: colors.primary,
                    fontWeight: '600',
                    opacity:
                      props.busy ||
                      props.pendingSelectedCount === 0 ||
                      Boolean(props.reviewingSelectedStatus)
                        ? 0.4
                        : 1
                  }}
                >
                  {props.reviewingSelectedStatus === 'approved'
                    ? t('graph.approving_selected', '正在通过所选…')
                    : t('graph.approve_selected', '通过所选')}
                </Text>
              </Pressable>
              <Pressable
                disabled={
                  props.busy ||
                  props.pendingSelectedCount === 0 ||
                  Boolean(props.reviewingSelectedStatus)
                }
                onPress={() => void props.onApplyReviews({ reviewStatus: 'rejected' })}
                style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}
              >
                {props.reviewingSelectedStatus === 'rejected' ? (
                  <ActivityIndicator size="small" color={colors.textSecondary} />
                ) : null}
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontWeight: '600',
                    opacity:
                      props.busy ||
                      props.pendingSelectedCount === 0 ||
                      Boolean(props.reviewingSelectedStatus)
                        ? 0.4
                        : 1
                  }}
                >
                  {props.reviewingSelectedStatus === 'rejected'
                    ? t('graph.rejecting_selected', '正在拒绝所选…')
                    : t('graph.reject_selected', '拒绝所选')}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}
      <FlatList
        data={props.pendingItems}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={props.listPad}
        style={styles.pendingList}
        ListEmptyComponent={
          props.reviewingSelectedStatus ? null : (
            <Text style={{ color: colors.textSecondary }}>
              {t('graph.no_pending', '没有待确认的节点或边')}
            </Text>
          )
        }
        renderItem={({ item }) => {
          const key = graphPendingItemKey(item.kind, item.id)
          const selected = props.pendingSelected.has(key)
          const nodeActions =
            item.kind === 'node' ? (
              <View style={styles.pendingActions}>
                <Pressable
                  disabled={props.busy}
                  onPress={() => void props.onReviewNode(item.id, 'approved')}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: '600',
                      opacity: props.busy ? 0.4 : 1
                    }}
                  >
                    {t(
                      graphSuspectReviewCopy(item.data).actionKey,
                      graphSuspectReviewCopy(item.data).actionDefault
                    )}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={props.busy}
                  onPress={() => void props.onReviewNode(item.id, 'rejected')}
                >
                  <Text
                    style={{
                      color: colors.error,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: '600',
                      opacity: props.busy ? 0.4 : 1
                    }}
                  >
                    {t('graph.reject', '拒绝')}
                  </Text>
                </Pressable>
                <Pressable
                  disabled={props.busy}
                  onPress={() => props.onViewNodeSource(item.id, item.data)}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: '600',
                      opacity: props.busy ? 0.4 : 1
                    }}
                  >
                    {t('graph.locate', '查看')}
                  </Text>
                </Pressable>
                <Pressable disabled={props.busy} onPress={() => props.onLocateNode(item.id)}>
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: '600',
                      opacity: props.busy ? 0.4 : 1
                    }}
                  >
                    {t('graph.node_detail', '详情')}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.pendingActions}>
                <Pressable
                  onPress={() =>
                    void props.onReviewEdge(item.id, 'approved', {
                      fromId: item.data.fromId,
                      toId: item.data.toId
                    })
                  }
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: '600'
                    }}
                  >
                    {t('graph.approve', '通过')}
                  </Text>
                </Pressable>
                <Pressable onPress={() => void props.onReviewEdge(item.id, 'rejected')}>
                  <Text
                    style={{
                      color: colors.error,
                      fontSize: mobileTypography.secondary.fontSize,
                      fontWeight: '600'
                    }}
                  >
                    {t('graph.reject', '拒绝')}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() =>
                    void props.onLocateEdge({
                      id: item.data.id,
                      fromId: item.data.fromId,
                      toId: item.data.toId,
                      edgeType: item.data.edgeType,
                      reviewStatus: item.data.reviewStatus
                    })
                  }
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>
                    {t('graph.locate', '查看')}
                  </Text>
                </Pressable>
                {item.data.sourceRef ? (
                  <Pressable
                    onPress={() =>
                      void props.onOpenSource(item.data.sourceRef, item.data.sourceExcerpt)
                    }
                  >
                    <Text style={{ color: colors.primary, fontWeight: '600' }}>
                      {t('graph.open_source', '原文')}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            )
          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: selected ? colors.primary : colors.borderControl
                }
              ]}
            >
              <Pressable
                onPress={() => props.onToggleItem(key)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                style={styles.pendingTitleRow}
              >
                <View style={styles.pendingCheck}>
                  <Checkbox selected={selected} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {item.kind === 'node' ? (
                    <>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                        {t('graph.pending_node', '节点')} · {item.data.name}
                        {readGraphNodeSuspectReason(item.data)
                          ? ` · ${t('graph.suspect_badge', '可疑')}`
                          : ''}
                      </Text>
                      <GraphDiscriminatorLabel value={item.data.discriminator} />
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                        {translateGraphNodeType(tr, item.data.nodeType)}
                        {item.data.summary ? ` · ${item.data.summary}` : ''}
                        {readGraphNodeSuspectReason(item.data)
                          ? ` · ${t('graph.suspect_reason', '怀疑理由')}：${readGraphNodeSuspectReason(item.data)}`
                          : ''}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                        {t('graph.pending_edge', '关系')} ·{' '}
                        {translateGraphEdgeType(tr, item.data.edgeType)} · {item.data.confidence}
                      </Text>
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                        {resolveGraphNodeDisplayName(
                          props.graphNodeNameById,
                          item.data.fromId,
                          t('graph.unknown_node', '未知节点')
                        )}{' '}
                        →{' '}
                        {resolveGraphNodeDisplayName(
                          props.graphNodeNameById,
                          item.data.toId,
                          t('graph.unknown_node', '未知节点')
                        )}
                      </Text>
                      {item.data.sourceExcerpt || item.data.sourceRef ? (
                        <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                          {item.data.sourceExcerpt || item.data.sourceRef}
                        </Text>
                      ) : null}
                    </>
                  )}
                </View>
              </Pressable>
              {nodeActions}
            </View>
          )
        }}
      />
    </View>
  )
}
