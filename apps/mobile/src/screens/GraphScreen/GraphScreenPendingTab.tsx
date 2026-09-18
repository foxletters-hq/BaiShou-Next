import React from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  graphPendingItemKey,
  resolveGraphNodeDisplayName,
  translateGraphEdgeType,
  translateGraphNodeType
} from '@baishou/shared'
import { Checkbox, useNativeTheme } from '@baishou/ui/native'
import { GraphDiscriminatorLabel } from './GraphNodeSameNameList'
import { styles } from './GraphScreen.styles'
import type { GraphPendingItem } from './graph-screen.types'

export function GraphScreenPendingTab(props: {
  pendingItems: GraphPendingItem[]
  pendingSelected: Set<string>
  pendingSelectedCount: number
  allPendingSelected: boolean
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
          <Text style={[styles.pendingHintText, { color: colors.textSecondary }]}>
            {t(
              'graph.pending_hint',
              '确认关系会同时通过两端节点；确认节点也会通过与它相连的待审关系。可勾选后批量处理。'
            )}
          </Text>
          <View style={styles.pendingToolbarRow}>
            <Pressable
              onPress={props.onToggleSelectAll}
              hitSlop={8}
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
                selected={props.allPendingSelected}
                indeterminate={props.pendingSelectedCount > 0 && !props.allPendingSelected}
              />
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                {props.allPendingSelected
                  ? t('graph.pending_deselect_all', '取消全选')
                  : t('graph.pending_select_all', '全选')}
              </Text>
            </Pressable>
            <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
              {t('graph.pending_selected_count', '已选 {{count}} 项', {
                count: props.pendingSelectedCount
              })}
            </Text>
          </View>
          <View style={styles.pendingToolbarRow}>
            <Pressable
              disabled={props.busy || props.pendingSelectedCount === 0}
              onPress={() => void props.onApplyReviews({ reviewStatus: 'approved' })}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: '600',
                  opacity: props.busy || props.pendingSelectedCount === 0 ? 0.4 : 1
                }}
              >
                {t('graph.approve_selected', '通过所选')}
              </Text>
            </Pressable>
            <Pressable
              disabled={props.busy || props.pendingSelectedCount === 0}
              onPress={() => void props.onApplyReviews({ reviewStatus: 'rejected' })}
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: '600',
                  opacity: props.busy || props.pendingSelectedCount === 0 ? 0.4 : 1
                }}
              >
                {t('graph.reject_selected', '拒绝所选')}
              </Text>
            </Pressable>
            <Pressable
              disabled={props.busy}
              onPress={() =>
                void props.onApplyReviews({ reviewStatus: 'approved', allPending: true })
              }
            >
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: '700',
                  opacity: props.busy ? 0.4 : 1
                }}
              >
                {t('graph.approve_all', '全部通过')}
              </Text>
            </Pressable>
            <Pressable
              disabled={props.busy}
              onPress={() =>
                void props.onApplyReviews({ reviewStatus: 'rejected', allPending: true })
              }
            >
              <Text
                style={{
                  color: colors.textSecondary,
                  fontWeight: '600',
                  opacity: props.busy ? 0.4 : 1
                }}
              >
                {t('graph.reject_all', '全部拒绝')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <FlatList
        data={props.pendingItems}
        keyExtractor={(item) => `${item.kind}-${item.id}`}
        contentContainerStyle={props.listPad}
        style={styles.pendingList}
        ListEmptyComponent={
          <Text style={{ color: colors.textSecondary }}>
            {t('graph.no_pending', '没有待确认的节点或边')}
          </Text>
        }
        renderItem={({ item }) => {
          const key = graphPendingItemKey(item.kind, item.id)
          const selected = props.pendingSelected.has(key)
          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.bgSurface,
                  borderColor: colors.borderSubtle
                }
              ]}
            >
              <View style={styles.pendingTitleRow}>
                <Pressable
                  onPress={() => props.onToggleItem(key)}
                  hitSlop={8}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={{ marginTop: 2 }}
                >
                  <Checkbox selected={selected} />
                </Pressable>
                <View style={{ flex: 1, minWidth: 0 }}>
                  {item.kind === 'node' ? (
                    <>
                      <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                        {t('graph.pending_node', '节点')} · {item.data.name}
                      </Text>
                      <GraphDiscriminatorLabel value={item.data.discriminator} />
                      <Text style={[styles.cardMeta, { color: colors.textSecondary }]}>
                        {translateGraphNodeType(tr, item.data.nodeType)}
                        {item.data.summary ? ` · ${item.data.summary}` : ''}
                      </Text>
                      <View style={styles.row}>
                        <Pressable onPress={() => void props.onReviewNode(item.id, 'approved')}>
                          <Text style={{ color: colors.primary, fontWeight: '600' }}>
                            {t('graph.approve', '通过')}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => void props.onReviewNode(item.id, 'rejected')}>
                          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                            {t('graph.reject', '拒绝')}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => props.onLocateNode(item.id)}>
                          <Text style={{ color: colors.primary, fontWeight: '600' }}>
                            {t('graph.locate', '查看')}
                          </Text>
                        </Pressable>
                      </View>
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
                      <View style={styles.row}>
                        <Pressable
                          onPress={() =>
                            void props.onReviewEdge(item.id, 'approved', {
                              fromId: item.data.fromId,
                              toId: item.data.toId
                            })
                          }
                        >
                          <Text style={{ color: colors.primary, fontWeight: '600' }}>
                            {t('graph.approve', '通过')}
                          </Text>
                        </Pressable>
                        <Pressable onPress={() => void props.onReviewEdge(item.id, 'rejected')}>
                          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
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
                    </>
                  )}
                </View>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}
