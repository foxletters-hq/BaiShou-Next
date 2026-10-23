import React from 'react'
import { Pressable, Text, TouchableOpacity, View } from 'react-native'
import { X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { translateGraphEdgeType } from '@baishou/shared'
import { Button, FloatingModal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import { styles } from './GraphScreen.styles'
import type { GraphDetailEdgeItem, GraphScreenDetailPaneProps } from './graph-screen-detail.types'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

type EdgeSectionProps = Pick<
  GraphScreenDetailPaneProps,
  | 'selectedNode'
  | 'detailEdges'
  | 'busy'
  | 'onSelectNode'
  | 'onOpenSource'
  | 'onReviewEdge'
  | 'onDeleteEdge'
> & {
  /** 打开「添加关系」弹层，弹层本身由详情面板统一编排 */
  onOpenAddEdge: () => void
}

/** 节点详情中的相关关系列表与单条关系详情弹层 */
export function GraphScreenDetailEdgeSection(props: EdgeSectionProps) {
  const { t } = useTranslation()
  const tr = (key: string, defaultValue?: string) => t(key, defaultValue ?? '')
  const { colors } = useNativeTheme()
  const { selectedNode } = props
  const [reviewingEdgeId, setReviewingEdgeId] = React.useState<string | null>(null)
  const [selectedEdgeDetail, setSelectedEdgeDetail] = React.useState<GraphDetailEdgeItem | null>(
    null
  )

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

  return (
    <>
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
          <Button size="sm" variant="outlined" onPress={props.onOpenAddEdge}>
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
    </>
  )
}
