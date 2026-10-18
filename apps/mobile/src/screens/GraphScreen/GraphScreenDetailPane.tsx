import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  type StyleProp,
  type ViewStyle
} from 'react-native'
import { X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import {
  listAmbiguousSourceRefs,
  translateGraphEdgeType,
  translateGraphNodeType,
  type GraphSearchMode
} from '@baishou/shared'
import { GRAPH_EDGE_TYPES } from '@baishou/database'
import {
  Button,
  CompactSearchBar,
  FloatingModal,
  Input,
  modalActionsStyle,
  SegmentedControl,
  useNativeTheme
} from '@baishou/ui/native'
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
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

export function GraphScreenDetailPane(props: {
  fullPage?: boolean
  style?: StyleProp<ViewStyle>
  contentContainerStyle?: StyleProp<ViewStyle>
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
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void | Promise<void>
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
  ) => void | Promise<void>
  onDeleteEdge: (edgeId: string) => void
  addEdgeQuery: string
  onAddEdgeQueryChange: (value: string) => void
  onSearchAddEdgeTarget: (query?: string, mode?: GraphSearchMode) => void | Promise<void>
  addEdgeSearchMode?: GraphSearchMode
  onAddEdgeSearchModeChange?: (mode: GraphSearchMode) => void
  addEdgeSearching?: boolean
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
  const [reviewingEdgeId, setReviewingEdgeId] = React.useState<string | null>(null)
  const [reviewingNodeStatus, setReviewingNodeStatus] = React.useState<
    'approved' | 'rejected' | null
  >(null)
  const [addEdgeModalOpen, setAddEdgeModalOpen] = React.useState(false)
  const [selectedEdgeDetail, setSelectedEdgeDetail] = React.useState<
    (typeof props.detailEdges)[0] | null
  >(null)
  const searchTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchMode = props.addEdgeSearchMode ?? 'text'

  const triggerSearch = React.useCallback(
    (query: string, mode: GraphSearchMode) => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }
      void props.onSearchAddEdgeTarget(query, mode)
    },
    [props.onSearchAddEdgeTarget]
  )

  const handleQueryChange = React.useCallback(
    (text: string) => {
      props.onAddEdgeQueryChange(text)
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
      searchTimerRef.current = setTimeout(() => {
        triggerSearch(text, searchMode)
      }, 250)
    },
    [props.onAddEdgeQueryChange, triggerSearch, searchMode]
  )

  const handleClear = React.useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    props.onAddEdgeQueryChange('')
    props.onAddEdgeToIdChange('')
    triggerSearch('', searchMode)
  }, [props.onAddEdgeQueryChange, props.onAddEdgeToIdChange, triggerSearch, searchMode])

  const handleModeChange = React.useCallback(
    (mode: GraphSearchMode) => {
      props.onAddEdgeSearchModeChange?.(mode)
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
        searchTimerRef.current = null
      }
      triggerSearch(props.addEdgeQuery, mode)
    },
    [props.onAddEdgeSearchModeChange, triggerSearch, props.addEdgeQuery]
  )

  const handleSubmit = React.useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current)
      searchTimerRef.current = null
    }
    triggerSearch(props.addEdgeQuery, searchMode)
  }, [triggerSearch, props.addEdgeQuery, searchMode])

  React.useEffect(() => {
    return () => {
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current)
      }
    }
  }, [])

  const handleReviewEdge = async (
    edgeId: string,
    status: 'approved' | 'rejected',
    endpoints?: { fromId?: string; toId?: string }
  ) => {
    setReviewingEdgeId(`${edgeId}:${status}`)
    // 先让原生界面在首帧渲染出 loading 转圈圈，避免 JS 执行重逻辑时首帧卡顿
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    try {
      await props.onReviewEdge(edgeId, status, endpoints)
    } finally {
      setReviewingEdgeId(null)
    }
  }

  const handleReviewNode = async (nodeId: string, status: 'approved' | 'rejected') => {
    setReviewingNodeStatus(status)
    // 先让原生界面在首帧渲染出 loading 转圈圈，避免 JS 执行重逻辑时首帧卡顿
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
    try {
      await props.onReviewNode(nodeId, status)
    } finally {
      setReviewingNodeStatus(null)
    }
  }

  return (
    <ScrollView
      style={[
        styles.detailPanel,
        props.fullPage && { maxHeight: undefined, flex: 1, borderBottomWidth: 0 },
        {
          backgroundColor: colors.bgSurface,
          borderBottomColor: colors.borderSubtle
        },
        props.style
      ]}
      contentContainerStyle={[styles.detailPanelContent, props.contentContainerStyle]}
      nestedScrollEnabled
      keyboardShouldPersistTaps="handled"
    >
      <Input
        label={t('graph.edit_name', '名称')}
        value={props.editName}
        onChangeText={props.onEditNameChange}
        placeholder={t('graph.edit_name', '名称')}
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
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: mobileTypography.caption.fontSize,
              lineHeight: 18
            }}
          >
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
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: mobileTypography.caption.fontSize,
              lineHeight: 18
            }}
          >
            {t('graph.suspect_reason', '怀疑理由')} {reason}
          </Text>
        )
      })()}
      {props.editNameConflict ? (
        <View style={{ gap: sharedTokens.spacing.xsPlus }}>
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: mobileTypography.caption.fontSize,
              lineHeight: 18
            }}
          >
            {t(
              'graph.same_name_exists_edit',
              '已有同类型同名节点「{{name}}」。保存前请换名，或合并到该节点。',
              { name: props.editNameConflict.name }
            )}
          </Text>
          <View style={styles.detailActions}>
            <Button size="sm" onPress={() => void props.onSelectNode(props.editNameConflict!.id)}>
              {t('graph.open_existing_node', '打开已有节点')}
            </Button>
            <Button
              size="sm"
              onPress={() =>
                props.onMergeIntoExisting(
                  props.editNameConflict!.id,
                  props.editNameConflict!.name,
                  selectedNode.id,
                  String(selectedNode.name || selectedNode.id)
                )
              }
            >
              {t('graph.merge_into_existing', '合并到该节点')}
            </Button>
          </View>
        </View>
      ) : null}
      {canApproveGraphNode(selectedNode) || selectedNode.reviewStatus === 'pending' ? (
        <View
          style={[
            styles.nodeReviewBanner,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderControl
            }
          ]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: sharedTokens.spacing.xsPlus
            }}
          >
            <View
              style={{ flexDirection: 'row', alignItems: 'center', gap: sharedTokens.spacing.xs }}
            >
              <Text
                style={{
                  color: colors.primary,
                  fontSize: mobileTypography.secondary.fontSize,
                  fontWeight: '700'
                }}
              >
                {t('graph.node_pending_badge', '待确认节点')}
              </Text>
              <Text
                style={{ color: colors.textSecondary, fontSize: mobileTypography.caption.fontSize }}
              >
                {translateGraphNodeType(tr, selectedNode.nodeType)}
              </Text>
            </View>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: sharedTokens.spacing.xsPlus
              }}
            >
              <Button
                size="sm"
                variant="primary"
                isDisabled={props.busy || reviewingNodeStatus !== null}
                isLoading={reviewingNodeStatus === 'approved'}
                onPress={() => void handleReviewNode(selectedNode.id, 'approved')}
              >
                {t(
                  graphSuspectReviewCopy(selectedNode).actionKey,
                  graphSuspectReviewCopy(selectedNode).actionDefault
                )}
              </Button>
              {selectedNode.reviewStatus === 'pending' ? (
                <Button
                  size="sm"
                  variant="outlined"
                  destructive
                  isDisabled={props.busy || reviewingNodeStatus !== null}
                  isLoading={reviewingNodeStatus === 'rejected'}
                  onPress={() => void handleReviewNode(selectedNode.id, 'rejected')}
                >
                  {t('graph.reject', '拒绝')}
                </Button>
              ) : null}
            </View>
          </View>
        </View>
      ) : (
        <Text style={[styles.detailMeta, { color: colors.textSecondary }]}>
          {translateGraphNodeType(tr, selectedNode.nodeType)}
        </Text>
      )}
      <Input
        label={t('graph.edit_summary', '摘要')}
        value={props.editSummary}
        onChangeText={props.onEditSummaryChange}
        placeholder={t('graph.edit_summary', '摘要')}
        multiline
        textarea
        style={styles.detailSummaryInput}
      />
      <Input
        label={t('graph.edit_aliases', '别名（逗号分隔）')}
        value={props.editAliases}
        onChangeText={props.onEditAliasesChange}
        placeholder={t('graph.edit_aliases', '别名（逗号分隔）')}
      />
      <View style={styles.detailActions}>
        {selectedNode.nodeType !== 'entry' ? (
          <Button
            size="sm"
            variant="outlined"
            isDisabled={props.busy || reviewingNodeStatus !== null}
            onPress={props.onOpenSplit}
          >
            {t('graph.split_node', '拆分节点')}
          </Button>
        ) : null}
        {selectedNode.discriminator ? (
          <Button
            size="sm"
            variant="outlined"
            isDisabled={props.busy || reviewingNodeStatus !== null}
            onPress={() => void props.onRevertSplit(String(selectedNode.discriminator))}
          >
            {t('graph.revert_split', '撤回拆分')}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="outlined"
          destructive
          isDisabled={props.busy || reviewingNodeStatus !== null}
          onPress={props.onDeleteSelected}
        >
          {t('graph.delete_node', '删除')}
        </Button>
        <Button
          size="sm"
          isDisabled={props.busy || !!props.editNameConflict || reviewingNodeStatus !== null}
          onPress={props.onSaveNodeEdit}
        >
          {t('graph.save_edit', '保存修改')}
        </Button>
      </View>

      <View style={styles.incidentBlock}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: sharedTokens.spacing.xsPlus,
            marginBottom: sharedTokens.spacing.xs
          }}
        >
          <Text
            style={{
              color: colors.textPrimary,
              fontSize: mobileTypography.primary.fontSize,
              fontWeight: mobileTypography.primary.fontWeight
            }}
          >
            {t('graph.incident_edges', '相关关系')} ({props.detailEdges.length})
          </Text>
          <Button size="sm" variant="outlined" onPress={() => setAddEdgeModalOpen(true)}>
            {t('graph.add_edge', '添加关系')}
          </Button>
        </View>

        {props.detailEdges.length > 0 ? (
          props.detailEdges.map((item) => {
            const { edge, partnerName } = item
            return (
              <View
                key={edge.id}
                style={[
                  styles.incidentRow,
                  { borderColor: colors.borderControl, backgroundColor: colors.bgSurface }
                ]}
              >
                <Pressable
                  style={{ flex: 1, minWidth: 0 }}
                  onPress={() => {
                    setSelectedEdgeDetail(item)
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: sharedTokens.spacing.xs,
                      flexWrap: 'wrap'
                    }}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: mobileTypography.primary.fontSize,
                        fontWeight: '600'
                      }}
                    >
                      {translateGraphEdgeType(tr, String(edge.edgeType || ''))}
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: mobileTypography.primary.fontSize,
                        fontWeight: '600'
                      }}
                      numberOfLines={1}
                    >
                      {partnerName}
                    </Text>
                    {edge.reviewStatus === 'pending' ? (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: mobileTypography.caption.fontSize,
                          backgroundColor: colors.bgSurfaceNormal,
                          paddingHorizontal: sharedTokens.spacing.xs,
                          paddingVertical: 1,
                          borderRadius: sharedTokens.radius.xs
                        }}
                      >
                        {t('graph.pending_badge', '待确认')}
                      </Text>
                    ) : null}
                  </View>
                  {edge.sourceExcerpt ? (
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.caption.fontSize,
                        lineHeight: 16,
                        marginTop: 2
                      }}
                      numberOfLines={1}
                    >
                      {edge.sourceExcerpt}
                    </Text>
                  ) : null}
                </Pressable>
                <View style={styles.incidentActions}>
                  <Button size="sm" variant="outlined" onPress={() => setSelectedEdgeDetail(item)}>
                    {t('graph.view_detail', '查看详情')}
                  </Button>
                </View>
              </View>
            )
          })
        ) : (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.caption.fontSize,
              paddingVertical: sharedTokens.spacing.xs
            }}
          >
            {t('graph.no_incident_edges', '暂无相关关系')}
          </Text>
        )}
      </View>

      {selectedEdgeDetail ? (
        <FloatingModal
          visible={!!selectedEdgeDetail}
          onClose={() => setSelectedEdgeDetail(null)}
          maxWidth={420}
        >
          {(() => {
            const { edge, partnerName } = selectedEdgeDetail
            const partnerId = edge.fromId === selectedNode.id ? edge.toId : edge.fromId
            return (
              <View style={{ padding: sharedTokens.spacing.md, gap: sharedTokens.spacing.md }}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Text
                    style={{
                      color: colors.textPrimary,
                      fontSize: mobileTypography.title.fontSize,
                      fontWeight: mobileTypography.title.fontWeight
                    }}
                  >
                    {t('graph.edge_detail_title', '关系详情')}
                  </Text>
                  <TouchableOpacity onPress={() => setSelectedEdgeDetail(null)} hitSlop={8}>
                    <X size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>

                <View
                  style={{
                    padding: sharedTokens.spacing.md,
                    backgroundColor: colors.bgSurface,
                    borderRadius: sharedTokens.radius.md,
                    borderWidth: 1,
                    borderColor: colors.borderControl,
                    gap: sharedTokens.spacing.sm
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.secondary.fontSize
                      }}
                    >
                      {t('graph.edge_type_label', '关系类型')}
                    </Text>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: mobileTypography.body.fontSize,
                        fontWeight: '600'
                      }}
                    >
                      {translateGraphEdgeType(tr, String(edge.edgeType || ''))}
                    </Text>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.secondary.fontSize
                      }}
                    >
                      {t('graph.edge_partner_label', '目标节点')}
                    </Text>
                    <Pressable
                      onPress={() => {
                        if (partnerId) {
                          setSelectedEdgeDetail(null)
                          props.onSelectNode(partnerId)
                        }
                      }}
                    >
                      <Text
                        style={{
                          color: colors.primary,
                          fontSize: mobileTypography.body.fontSize,
                          fontWeight: '600',
                          textDecorationLine: 'underline'
                        }}
                      >
                        {partnerName}
                      </Text>
                    </Pressable>
                  </View>
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between'
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.secondary.fontSize
                      }}
                    >
                      {t('graph.edge_status_label', '审核状态')}
                    </Text>
                    <Text
                      style={{
                        color:
                          edge.reviewStatus === 'pending' ? colors.primary : colors.textSecondary,
                        fontSize: mobileTypography.secondary.fontSize,
                        fontWeight: '600'
                      }}
                    >
                      {edge.reviewStatus === 'pending'
                        ? t('graph.pending_badge', '待确认')
                        : t('graph.approved_badge', '已确认')}
                    </Text>
                  </View>
                </View>

                {edge.sourceExcerpt || edge.sourceRef ? (
                  <View
                    style={{
                      padding: sharedTokens.spacing.md,
                      backgroundColor: colors.bgSurface,
                      borderRadius: sharedTokens.radius.md,
                      borderWidth: 1,
                      borderColor: colors.borderControl,
                      gap: sharedTokens.spacing.sm
                    }}
                  >
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.secondary.fontSize
                      }}
                    >
                      {t('graph.source_excerpt', '出处引文')}
                    </Text>
                    {edge.sourceExcerpt ? (
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: mobileTypography.body.fontSize,
                          lineHeight: 22
                        }}
                      >
                        {edge.sourceExcerpt}
                      </Text>
                    ) : null}
                    <View style={{ alignItems: 'flex-end', marginTop: sharedTokens.spacing.xs }}>
                      <Button
                        size="sm"
                        variant="outlined"
                        isDisabled={props.busy}
                        onPress={() => {
                          void props.onOpenSource(edge.sourceRef, edge.sourceExcerpt)
                        }}
                      >
                        {t('graph.open_source', '打开原文')}
                      </Button>
                    </View>
                  </View>
                ) : null}

                <View style={[modalActionsStyle, { marginTop: sharedTokens.spacing.xs }]}>
                  <Button
                    size="sm"
                    variant="outlined"
                    destructive
                    isDisabled={props.busy || reviewingEdgeId !== null}
                    onPress={() => {
                      props.onDeleteEdge(edge.id)
                      setSelectedEdgeDetail(null)
                    }}
                  >
                    {t('graph.delete_edge', '删除')}
                  </Button>
                  {edge.reviewStatus === 'pending' ? (
                    <>
                      <Button
                        size="sm"
                        variant="outlined"
                        destructive
                        isDisabled={props.busy || reviewingEdgeId !== null}
                        isLoading={reviewingEdgeId === `${edge.id}:rejected`}
                        onPress={async () => {
                          await handleReviewEdge(edge.id, 'rejected')
                          setSelectedEdgeDetail(null)
                        }}
                      >
                        {t('graph.reject', '拒绝')}
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        isDisabled={props.busy || reviewingEdgeId !== null}
                        isLoading={reviewingEdgeId === `${edge.id}:approved`}
                        onPress={async () => {
                          await handleReviewEdge(edge.id, 'approved', {
                            fromId: edge.fromId,
                            toId: edge.toId
                          })
                          setSelectedEdgeDetail(null)
                        }}
                      >
                        {t('graph.approve', '通过')}
                      </Button>
                    </>
                  ) : null}
                </View>
              </View>
            )
          })()}
        </FloatingModal>
      ) : null}

      {addEdgeModalOpen ? (
        <FloatingModal
          visible={addEdgeModalOpen}
          onClose={() => setAddEdgeModalOpen(false)}
          maxWidth={420}
        >
          <View style={{ padding: sharedTokens.spacing.md, gap: sharedTokens.spacing.smPlus }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: mobileTypography.primary.fontSize,
                  fontWeight: '700'
                }}
              >
                {t('graph.add_edge', '添加关系')}
              </Text>
              <TouchableOpacity onPress={() => setAddEdgeModalOpen(false)} hitSlop={8}>
                <X size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.addEdgeTypeRow}>
              {GRAPH_EDGE_TYPES.map((et) => {
                const active = props.addEdgeType === et
                return (
                  <Pressable
                    key={et}
                    onPress={() => props.onAddEdgeTypeChange(et)}
                    style={[
                      styles.addEdgeTypeChip,
                      {
                        backgroundColor: active ? colors.primary : colors.bgSurfaceNormal,
                        borderColor: active ? colors.primary : colors.borderControl
                      }
                    ]}
                  >
                    <Text
                      style={[
                        styles.addEdgeTypeChipText,
                        {
                          color: active ? colors.textOnPrimary : colors.textSecondary,
                          fontWeight: active ? '700' : '500'
                        }
                      ]}
                    >
                      {translateGraphEdgeType(tr, et)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>

            <View style={styles.addEdgeSearchToolbar}>
              <CompactSearchBar
                value={props.addEdgeQuery}
                onChangeText={handleQueryChange}
                onClear={handleClear}
                onSubmitEditing={handleSubmit}
                placeholder={
                  searchMode === 'semantic'
                    ? t('graph.search_placeholder_semantic', '按意思搜索目标节点…')
                    : t('graph.search_placeholder_text', '按名称 / 别名搜索')
                }
                style={styles.addEdgeSearchBox}
                rightSlot={
                  props.addEdgeSearching ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : undefined
                }
              />
              <SegmentedControl
                size="small"
                stretch={false}
                value={searchMode}
                onChange={(val) => handleModeChange(val as GraphSearchMode)}
                options={[
                  { value: 'text', label: t('graph.search_text', '文本搜索') },
                  { value: 'semantic', label: t('graph.search_semantic', '语义搜索') }
                ]}
              />
            </View>

            <ScrollView
              style={{ maxHeight: 200 }}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {!props.addEdgeSearching &&
              props.addEdgeQuery.trim() !== '' &&
              props.addEdgeHits.length === 0 ? (
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.caption.fontSize,
                    textAlign: 'center',
                    paddingVertical: sharedTokens.spacing.sm
                  }}
                >
                  {t('graph.search_no_results', '未找到匹配的节点')}
                </Text>
              ) : null}
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
                        borderColor: active ? colors.primary : colors.borderControl,
                        marginBottom: sharedTokens.spacing.xs
                      }
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: mobileTypography.secondary.fontSize,
                        fontWeight: '600'
                      }}
                    >
                      {h.name}
                    </Text>
                    <GraphDiscriminatorLabel value={h.discriminator} />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.caption.fontSize
                      }}
                    >
                      {translateGraphNodeType(tr, h.nodeType)}
                    </Text>
                  </Pressable>
                )
              })}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                gap: sharedTokens.spacing.sm
              }}
            >
              <Button size="sm" variant="outlined" onPress={() => setAddEdgeModalOpen(false)}>
                {t('common.cancel', '取消')}
              </Button>
              <Button
                size="sm"
                isDisabled={props.busy || !props.addEdgeToId}
                onPress={async () => {
                  await props.onAddEdge()
                  setAddEdgeModalOpen(false)
                }}
              >
                {t('graph.add_edge_submit', '添加')}
              </Button>
            </View>
          </View>
        </FloatingModal>
      ) : null}
    </ScrollView>
  )
}
