import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { translateGraphEdgeType } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  MarkdownRenderer,
  modalActionsStyle,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeSourceFragment } from './knowledge-source-preview.util'
import { notebookGraphFragmentBody, notebookGraphPartnerId } from './knowledge-notebook-graph.util'
import type { KnowledgeGraphEdgeRow, KnowledgeGraphNodeRow } from './knowledge-detail.types'

export function KnowledgeNotebookGraphNodeExtras(props: {
  selectedId: string
  nodes: KnowledgeGraphNodeRow[]
  relatedEdges: KnowledgeGraphEdgeRow[]
  fragments: KnowledgeSourceFragment[]
  fragmentsLoading: boolean
  reviewBusy: boolean
  onLocateNode: (nodeId: string) => void
  onReviewEdge: (edgeId: string, status: 'approved' | 'rejected') => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [mentionsOpen, setMentionsOpen] = useState(false)
  const [relationsOpen, setRelationsOpen] = useState(false)
  const mentionCount = props.fragments.length
  const relationCount = props.relatedEdges.length

  return (
    <View style={{ gap: tokens.spacing.sm }}>
      <Card>
        <View style={{ gap: tokens.spacing.sm }}>
          <View
            style={[
              styles.sectionLabelRow,
              { gap: tokens.spacing.sm, justifyContent: 'space-between', minWidth: 0 }
            ]}
          >
            <Text
              style={{
                color: colors.textPrimary,
                flex: 1,
                minWidth: 0,
                fontSize: mobileTypography.primary.fontSize,
                fontWeight: mobileTypography.primary.fontWeight
              }}
              numberOfLines={1}
            >
              {t('graph.node_mentions', '提及到的片段 ({{count}})', { count: mentionCount })}
            </Text>
            {mentionCount > 0 && !props.fragmentsLoading ? (
              <Button size="sm" variant="outlined" onPress={() => setMentionsOpen((open) => !open)}>
                {mentionsOpen ? t('graph.fold', '收起') : t('graph.unfold', '展开')}
              </Button>
            ) : null}
          </View>
          {props.fragmentsLoading ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize
              }}
            >
              {t('common.loading', '加载中…')}
            </Text>
          ) : mentionCount === 0 ? (
            <Text
              style={{
                color: colors.textSecondary,
                fontSize: mobileTypography.secondary.fontSize
              }}
            >
              {t('graph.no_mentions', '暂无原文片段')}
            </Text>
          ) : null}
          {mentionsOpen
            ? props.fragments.map((item, index) => {
                const body = notebookGraphFragmentBody(item)
                return (
                  <Card key={item.id}>
                    <View style={{ gap: tokens.spacing.xs, minWidth: 0 }}>
                      <Text
                        style={{
                          color: colors.textPrimary,
                          fontSize: mobileTypography.primary.fontSize,
                          fontWeight: mobileTypography.primary.fontWeight
                        }}
                        numberOfLines={2}
                      >
                        {t('knowledge.graph_fragment_n', '片段 {{index}}', { index: index + 1 })}
                        {item.sourceTitle ? ` · ${item.sourceTitle}` : ''}
                      </Text>
                      {body ? (
                        <MarkdownRenderer content={body} variant="preview" />
                      ) : (
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: mobileTypography.secondary.fontSize
                          }}
                        >
                          {t('graph.source_unavailable', '没有可预览的原文')}
                        </Text>
                      )}
                    </View>
                  </Card>
                )
              })
            : null}
        </View>
      </Card>
      <Card>
        <View style={{ gap: tokens.spacing.sm }}>
          <View
            style={[
              styles.sectionLabelRow,
              { gap: tokens.spacing.sm, justifyContent: 'space-between', minWidth: 0 }
            ]}
          >
            <Text
              style={{
                color: colors.textPrimary,
                flex: 1,
                minWidth: 0,
                fontSize: mobileTypography.primary.fontSize,
                fontWeight: mobileTypography.primary.fontWeight
              }}
              numberOfLines={1}
            >
              {t('graph.node_relations', '相关关系 ({{count}})', { count: relationCount })}
            </Text>
            <Button
              size="sm"
              variant="outlined"
              isDisabled={relationCount === 0}
              onPress={() => setRelationsOpen((open) => !open)}
            >
              {relationsOpen ? t('graph.fold', '收起') : t('graph.unfold', '展开')}
            </Button>
          </View>
          {relationsOpen
            ? props.relatedEdges.map((edge) => {
                const otherId = notebookGraphPartnerId(edge, props.selectedId)
                const other = props.nodes.find((node) => node.id === otherId)?.name || otherId
                return (
                  <View key={edge.id} style={{ gap: tokens.spacing.xs, minWidth: 0 }}>
                    <Text
                      style={{
                        color: colors.textPrimary,
                        fontSize: mobileTypography.primary.fontSize
                      }}
                    >
                      {translateGraphEdgeType(t, edge.edgeType)} · {other}
                    </Text>
                    {edge.sourceExcerpt ? (
                      <Text
                        style={{
                          color: colors.textSecondary,
                          fontSize: mobileTypography.secondary.fontSize
                        }}
                        numberOfLines={3}
                      >
                        {edge.sourceExcerpt}
                      </Text>
                    ) : null}
                    <View style={modalActionsStyle}>
                      <Button
                        size="sm"
                        variant="outlined"
                        onPress={() => props.onLocateNode(otherId)}
                      >
                        {t('graph.view', '查看')}
                      </Button>
                      {edge.reviewStatus === 'pending' ? (
                        <>
                          <Button
                            size="sm"
                            isDisabled={props.reviewBusy}
                            onPress={() => void props.onReviewEdge(edge.id, 'approved')}
                          >
                            {t('graph.approve', '通过')}
                          </Button>
                          <Button
                            size="sm"
                            destructive
                            isDisabled={props.reviewBusy}
                            onPress={() => void props.onReviewEdge(edge.id, 'rejected')}
                          >
                            {t('graph.reject', '拒绝')}
                          </Button>
                        </>
                      ) : null}
                    </View>
                  </View>
                )
              })
            : null}
        </View>
      </Card>
    </View>
  )
}
