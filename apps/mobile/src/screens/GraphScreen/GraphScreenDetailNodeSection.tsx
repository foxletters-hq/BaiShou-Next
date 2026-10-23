import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { listAmbiguousSourceRefs, translateGraphNodeType } from '@baishou/shared'
import { Button, Input, useNativeTheme } from '@baishou/ui/native'
import {
  canApproveGraphNode,
  graphSuspectReviewCopy,
  parseGraphNodePropsJson,
  readGraphNodeSuspectReason
} from '@/src/services/graph-name-candidates.util'
import { GraphDiscriminatorLabel, GraphNodeSameNameList } from './GraphNodeSameNameList'
import { styles } from './GraphScreen.styles'
import type { GraphScreenDetailPaneProps } from './graph-screen-detail.types'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

type NodeSectionProps = Pick<
  GraphScreenDetailPaneProps,
  | 'selectedNode'
  | 'editName'
  | 'onEditNameChange'
  | 'editNameConflict'
  | 'sameNameEntities'
  | 'editSummary'
  | 'onEditSummaryChange'
  | 'editAliases'
  | 'onEditAliasesChange'
  | 'busy'
  | 'onSaveNodeEdit'
  | 'onReviewNode'
  | 'onDeleteSelected'
  | 'onOpenSplit'
  | 'onRevertSplit'
  | 'onSelectNode'
  | 'onMergeIntoExisting'
>

/** 节点详情：名称 / 摘要 / 别名编辑、同名冲突提示、待确认审核与节点操作 */
export function GraphScreenDetailNodeSection(props: NodeSectionProps) {
  const { t } = useTranslation()
  const tr = (key: string, defaultValue?: string) => t(key, defaultValue ?? '')
  const { colors } = useNativeTheme()
  const { selectedNode } = props
  const [reviewingNodeStatus, setReviewingNodeStatus] = React.useState<
    'approved' | 'rejected' | null
  >(null)

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
    <>
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
    </>
  )
}
