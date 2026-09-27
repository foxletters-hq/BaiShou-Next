import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { graphPendingItemKey } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Card, Checkbox, useNativeTheme } from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

export function KnowledgeNotebookGraphPendingTab(props: {
  nodes: KnowledgeGraphNodeRow[]
  pendingNodes: KnowledgeGraphNodeRow[]
  pendingEdges: KnowledgeGraphEdgeRow[]
  pendingSelection: Set<string>
  reviewBusy: boolean
  onTogglePending: (kind: 'node' | 'edge', id: string) => void
  onToggleSelectAll: () => void
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void
  onReviewEdge: (edgeId: string, status: 'approved' | 'rejected') => void
  onReviewAll: (status: 'approved' | 'rejected') => void
  onReviewSelected: (status: 'approved' | 'rejected') => void
  onLocateNode: (nodeId: string) => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const pendingCount = props.pendingNodes.length + props.pendingEdges.length
  const pendingKeys = [
    ...props.pendingNodes.map((node) => graphPendingItemKey('node', node.id)),
    ...props.pendingEdges.map((edge) => graphPendingItemKey('edge', edge.id))
  ]
  const allSelected =
    pendingKeys.length > 0 && pendingKeys.every((key) => props.pendingSelection.has(key))

  if (pendingCount === 0) {
    return (
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: settingsTypography.desc.fontSize
        }}
      >
        {t('graph.no_pending', '暂无待确认内容')}
      </Text>
    )
  }

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
        <Checkbox selected={allSelected} onPress={props.onToggleSelectAll} />
        <Text style={{ color: colors.textPrimary, flex: 1 }}>{t('graph.select_all', '全选')}</Text>
      </View>
      <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
        <Button isDisabled={props.reviewBusy} onPress={() => void props.onReviewAll('approved')}>
          {t('graph.approve_all', '全部通过')}
        </Button>
        <Button
          isDisabled={props.reviewBusy}
          destructive
          onPress={() => void props.onReviewAll('rejected')}
        >
          {t('graph.reject_all', '全部拒绝')}
        </Button>
        <Button
          isDisabled={props.reviewBusy || props.pendingSelection.size === 0}
          onPress={() => void props.onReviewSelected('approved')}
        >
          {t('graph.approve_selected', '通过所选')}
        </Button>
        <Button
          isDisabled={props.reviewBusy || props.pendingSelection.size === 0}
          destructive
          onPress={() => void props.onReviewSelected('rejected')}
        >
          {t('graph.reject_selected', '拒绝所选')}
        </Button>
      </View>
      {props.pendingNodes.map((node) => (
        <Card key={node.id}>
          <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.sm }}>
            <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
              <Checkbox
                selected={props.pendingSelection.has(graphPendingItemKey('node', node.id))}
                onPress={() => props.onTogglePending('node', node.id)}
              />
              <Text
                style={{
                  color: colors.textPrimary,
                  fontSize: settingsTypography.row.fontSize,
                  fontWeight: settingsTypography.row.fontWeight,
                  flex: 1
                }}
              >
                {t('graph.pending_node', '节点')} · {node.name}
              </Text>
            </View>
            <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
              <Button
                variant="outlined"
                isDisabled={props.reviewBusy}
                onPress={() => props.onLocateNode(node.id)}
              >
                {t('graph.view_on_canvas', '在画布查看')}
              </Button>
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
              <View style={[styles.rowGap, { gap: tokens.spacing.sm }]}>
                <Checkbox
                  selected={props.pendingSelection.has(graphPendingItemKey('edge', edge.id))}
                  onPress={() => props.onTogglePending('edge', edge.id)}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: settingsTypography.row.fontSize,
                    fontWeight: settingsTypography.row.fontWeight,
                    flex: 1
                  }}
                >
                  {t('graph.pending_edge', '关系')} · {from} —{edge.edgeType}→ {to}
                </Text>
              </View>
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
                  variant="outlined"
                  isDisabled={props.reviewBusy}
                  onPress={() => props.onLocateNode(edge.fromId)}
                >
                  {t('graph.view_on_canvas', '在画布查看')}
                </Button>
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
  )
}
