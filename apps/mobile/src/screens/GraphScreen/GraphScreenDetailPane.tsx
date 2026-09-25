import React from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  listAmbiguousSourceRefs,
  translateGraphEdgeType,
  translateGraphNodeType
} from '@baishou/shared'
import { GRAPH_EDGE_TYPES } from '@baishou/database'
import { useNativeTheme } from '@baishou/ui/native'
import {
  canApproveGraphNode,
  graphSuspectReviewCopy,
  parseGraphNodePropsJson,
  readGraphNodeSuspectReason,
  type GraphRegisteredSameNameEntity
} from '@/src/services/graph-name-candidates.util'
import { GraphDiscriminatorLabel, GraphNodeSameNameList } from './GraphNodeSameNameList'
import { styles } from './GraphScreen.styles'
import type { GraphEditNameConflict } from './graph-screen.types'

export function GraphScreenDetailPane(props: {
  selectedNode: any
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
  onSelectNode: (id: string) => void
  onMergeIntoExisting: (
    survivorId: string,
    survivorName: string,
    loserId: string,
    loserName: string
  ) => void
  detailEdges: Array<{
    edge: {
      id: string
      fromId: string
      toId: string
      edgeType?: string
      reviewStatus?: string
      sourceRef?: string | null
      sourceExcerpt?: string | null
    }
    partnerName: string
  }>
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
}) {
  const { t } = useTranslation()
  const tr = (key: string, defaultValue?: string) => t(key, defaultValue ?? '')
  const { colors } = useNativeTheme()
  const { selectedNode } = props

  return (
    <ScrollView
      style={[
        styles.detailPanel,
        {
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderSubtle
        }
      ]}
      contentContainerStyle={styles.detailPanelContent}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        value={props.editName}
        onChangeText={props.onEditNameChange}
        placeholder={t('graph.edit_name', '名称')}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.renameInput,
          { color: colors.textPrimary, borderColor: colors.borderSubtle }
        ]}
      />
      <GraphDiscriminatorLabel
        value={typeof selectedNode.discriminator === 'string' ? selectedNode.discriminator : ''}
      />
      <GraphNodeSameNameList
        entities={props.sameNameEntities.filter((item) => item.nodeId !== selectedNode.id)}
        onOpen={(id) => void props.onSelectNode(id)}
        onRevertSplit={props.onRevertSplit}
        busy={props.busy}
      />
      {(() => {
        const ambiguousRefs = listAmbiguousSourceRefs(
          parseGraphNodePropsJson(selectedNode.propsJson)
        )
        if (selectedNode.discriminator || ambiguousRefs.length === 0) return null
        return (
          <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 18 }}>
            {t('graph.ambiguous_sources_hint', '有 {{count}} 条出处待确认归谁', {
              count: ambiguousRefs.length
            })}
          </Text>
        )
      })()}
      {(() => {
        const reason = readGraphNodeSuspectReason(selectedNode)
        if (!reason) return null
        return (
          <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 18 }}>
            {t('graph.suspect_reason', '怀疑理由')} {reason}
          </Text>
        )
      })()}
      {props.editNameConflict ? (
        <View style={{ gap: 6 }}>
          <Text style={{ color: colors.textPrimary, fontSize: 12, lineHeight: 18 }}>
            {t(
              'graph.same_name_exists_edit',
              '已有同类型同名节点「{{name}}」。保存前请换名，或合并到该节点。',
              { name: props.editNameConflict.name }
            )}
          </Text>
          <View style={styles.row}>
            <Pressable onPress={() => void props.onSelectNode(props.editNameConflict!.id)}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t('graph.open_existing_node', '打开已有节点')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() =>
                props.onMergeIntoExisting(
                  props.editNameConflict!.id,
                  props.editNameConflict!.name,
                  selectedNode.id,
                  String(selectedNode.name || selectedNode.id)
                )
              }
            >
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t('graph.merge_into_existing', '合并到该节点')}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
      <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
        {translateGraphNodeType(tr, selectedNode.nodeType)}
        {selectedNode.reviewStatus === 'pending' ? ` · ${t('graph.pending_badge', '待确认')}` : ''}
      </Text>
      <TextInput
        value={props.editSummary}
        onChangeText={props.onEditSummaryChange}
        placeholder={t('graph.edit_summary', '摘要')}
        placeholderTextColor={colors.textSecondary}
        multiline
        style={[
          styles.renameInput,
          styles.multilineInput,
          { color: colors.textPrimary, borderColor: colors.borderSubtle }
        ]}
      />
      <TextInput
        value={props.editAliases}
        onChangeText={props.onEditAliasesChange}
        placeholder={t('graph.edit_aliases', '别名（逗号分隔）')}
        placeholderTextColor={colors.textSecondary}
        style={[
          styles.renameInput,
          { color: colors.textPrimary, borderColor: colors.borderSubtle }
        ]}
      />
      <View style={styles.row}>
        <Pressable disabled={props.busy || !!props.editNameConflict} onPress={props.onSaveNodeEdit}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {t('graph.save_edit', '保存修改')}
          </Text>
        </Pressable>
        {canApproveGraphNode(selectedNode) ? (
          <>
            <Pressable onPress={() => void props.onReviewNode(selectedNode.id, 'approved')}>
              <Text style={{ color: colors.primary, fontWeight: '600' }}>
                {t(
                  graphSuspectReviewCopy(selectedNode).actionKey,
                  graphSuspectReviewCopy(selectedNode).actionDefault
                )}
              </Text>
            </Pressable>
            {selectedNode.reviewStatus === 'pending' ? (
              <Pressable onPress={() => void props.onReviewNode(selectedNode.id, 'rejected')}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                  {t('graph.reject', '拒绝')}
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
        <Pressable onPress={props.onDeleteSelected}>
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
            {t('graph.delete_node', '删除')}
          </Text>
        </Pressable>
        {selectedNode.nodeType !== 'entry' ? (
          <Pressable disabled={props.busy} onPress={props.onOpenSplit}>
            <Text style={{ color: colors.primary, fontWeight: '600' }}>
              {t('graph.split_node', '拆分')}
            </Text>
          </Pressable>
        ) : null}
        {selectedNode.discriminator ? (
          <Pressable
            disabled={props.busy}
            onPress={() => void props.onRevertSplit(String(selectedNode.discriminator))}
          >
            <Text style={{ color: colors.primary, fontWeight: '600' }}>
              {t('graph.revert_split', '撤回拆分')}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {props.detailEdges.length > 0 ? (
        <View style={styles.incidentBlock}>
          <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
            {t('graph.incident_edges', '相关关系')}
          </Text>
          {props.detailEdges.map(({ edge, partnerName }) => (
            <View key={edge.id} style={[styles.incidentRow, { borderColor: colors.borderSubtle }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {translateGraphEdgeType(tr, String(edge.edgeType || ''))} · {partnerName}
                </Text>
                {edge.reviewStatus === 'pending' ? (
                  <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                    {t('graph.pending_badge', '待确认')}
                  </Text>
                ) : null}
              </View>
              {edge.sourceRef || edge.sourceExcerpt ? (
                <Pressable
                  onPress={() => void props.onOpenSource(edge.sourceRef, edge.sourceExcerpt)}
                  hitSlop={6}
                >
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                    {t('graph.open_source', '原文')}
                  </Text>
                </Pressable>
              ) : null}
              {edge.reviewStatus === 'pending' ? (
                <>
                  <Pressable
                    onPress={() =>
                      void props.onReviewEdge(edge.id, 'approved', {
                        fromId: edge.fromId,
                        toId: edge.toId
                      })
                    }
                  >
                    <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
                      {t('graph.approve', '通过')}
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => void props.onReviewEdge(edge.id, 'rejected')}>
                    <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                      {t('graph.reject', '拒绝')}
                    </Text>
                  </Pressable>
                </>
              ) : null}
              <Pressable onPress={() => props.onDeleteEdge(edge.id)}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {t('graph.delete_edge', '删除')}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <Text style={[styles.detailMeta, { color: colors.textSecondary, marginTop: 4 }]}>
        {t('graph.add_edge', '添加关系')}
      </Text>
      <View style={styles.addEdgeSearchRow}>
        <TextInput
          value={props.addEdgeQuery}
          onChangeText={props.onAddEdgeQueryChange}
          placeholder={t('graph.add_edge_search', '搜索目标节点')}
          placeholderTextColor={colors.textSecondary}
          style={[
            styles.renameInput,
            { flex: 1, color: colors.textPrimary, borderColor: colors.borderSubtle }
          ]}
          returnKeyType="search"
          onSubmitEditing={props.onSearchAddEdgeTarget}
        />
        <Pressable onPress={props.onSearchAddEdgeTarget} hitSlop={8}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>
            {t('graph.search', '搜索')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.edgeTypeRow}>
        {GRAPH_EDGE_TYPES.map((et) => {
          const active = props.addEdgeType === et
          return (
            <Pressable
              key={et}
              onPress={() => props.onAddEdgeTypeChange(et)}
              style={[
                styles.edgeTypeChip,
                {
                  backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                  borderColor: active ? colors.primary : colors.borderSubtle
                }
              ]}
            >
              <Text
                style={{
                  color: active ? colors.textOnPrimary : colors.textSecondary,
                  fontSize: 11,
                  fontWeight: active ? '700' : '500'
                }}
              >
                {translateGraphEdgeType(tr, et)}
              </Text>
            </Pressable>
          )
        })}
      </View>
      <Pressable
        disabled={props.busy || !props.addEdgeToId}
        onPress={props.onAddEdge}
        style={{ opacity: props.busy || !props.addEdgeToId ? 0.4 : 1 }}
      >
        <Text style={{ color: colors.primary, fontWeight: '700' }}>
          {t('graph.add_edge_submit', '添加')}
        </Text>
      </Pressable>
      {props.addEdgeHits.map((h) => {
        const active = props.addEdgeToId === h.id
        return (
          <Pressable
            key={h.id}
            onPress={() => props.onAddEdgeToIdChange(h.id)}
            style={[
              styles.hitBtn,
              {
                backgroundColor: active ? colors.bgSurfaceNormal : 'transparent',
                borderColor: active ? colors.primary : colors.borderSubtle
              }
            ]}
          >
            <Text style={{ color: colors.textPrimary, fontSize: 13, fontWeight: '600' }}>
              {h.name}
            </Text>
            <GraphDiscriminatorLabel value={h.discriminator} />
            <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
              {translateGraphNodeType(tr, h.nodeType)}
            </Text>
          </Pressable>
        )
      })}
    </ScrollView>
  )
}
