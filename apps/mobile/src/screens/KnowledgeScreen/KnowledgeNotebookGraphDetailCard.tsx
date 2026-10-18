import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { translateGraphNodeType } from '@baishou/shared'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Card,
  Checkbox,
  CompactSearchBar,
  SegmentedContent,
  SegmentedControl,
  modalActionsStyle,
  useNativeTheme
} from '@baishou/ui/native'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import type { KnowledgeGraphNodeRow } from './knowledge-detail.types'

export function KnowledgeNotebookGraphDetailCard(props: {
  selectedId: string
  selectedNode?: KnowledgeGraphNodeRow
  reviewBusy: boolean
  mergeSearchQuery: string
  mergeSearchMode: 'text' | 'semantic'
  mergeHits: Array<{ id: string; name: string; nodeType?: string }>
  mergeLoserIds: Set<string>
  mergeSearched: boolean
  onReviewNode: (nodeId: string, status: 'approved' | 'rejected') => void
  onMergeSearchQueryChange: (value: string) => void
  onMergeSearchModeChange: (mode: 'text' | 'semantic') => void
  onSearchMerge: (overrideQuery?: string, overrideMode?: 'text' | 'semantic') => void
  onToggleMergeLoser: (id: string) => void
  onMergeSearched: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { selectedNode } = props

  return (
    <Card>
      <View style={{ padding: tokens.spacing.sm, gap: tokens.spacing.sm, minWidth: 0 }}>
        {selectedNode?.nodeType ? (
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {t('graph.label_type', '类型')} · {translateGraphNodeType(t, selectedNode.nodeType)}
          </Text>
        ) : null}
        <Text
          style={{
            color: colors.textSecondary,
            fontSize: mobileTypography.secondary.fontSize
          }}
        >
          {selectedNode?.summary ||
            t('graph.node_detail_empty', '点选节点后可以在这里看名称和摘要')}
        </Text>
        {selectedNode?.reviewStatus === 'pending' ? (
          <View style={modalActionsStyle}>
            <Button
              size="sm"
              isDisabled={props.reviewBusy}
              onPress={() => void props.onReviewNode(selectedNode.id, 'approved')}
            >
              {t('graph.approve', '通过')}
            </Button>
            <Button
              size="sm"
              destructive
              isDisabled={props.reviewBusy}
              onPress={() => void props.onReviewNode(selectedNode.id, 'rejected')}
            >
              {t('graph.reject', '拒绝')}
            </Button>
          </View>
        ) : null}
        <View style={{ gap: tokens.spacing.sm, width: '100%', minWidth: 0, overflow: 'hidden' }}>
          <CompactSearchBar
            value={props.mergeSearchQuery}
            onChangeText={(text) => {
              props.onMergeSearchQueryChange(text)
              if (props.mergeSearchMode === 'semantic') props.onSearchMerge(text)
            }}
            onSubmitEditing={() => void props.onSearchMerge()}
            onClear={() => {
              props.onMergeSearchQueryChange('')
              props.onSearchMerge('')
            }}
            placeholder={t('graph.merge_search_placeholder', '搜索要合并的节点')}
            style={{ minWidth: 0, width: '100%', flexGrow: 0 }}
          />
          <SegmentedControl
            size="small"
            value={props.mergeSearchMode}
            onChange={(value) => {
              const nextMode = value as 'text' | 'semantic'
              props.onMergeSearchModeChange(nextMode)
              if (props.mergeSearchQuery.trim()) {
                props.onSearchMerge(undefined, nextMode)
              }
            }}
            options={[
              { value: 'semantic', label: t('settings.rag_search_semantic', '语义搜索') },
              { value: 'text', label: t('settings.rag_search_text', '文本搜索') }
            ]}
          />
          <SegmentedContent value={props.mergeSearchMode}>
            {props.mergeSearched && props.mergeHits.length === 0 ? (
              <Text
                style={{
                  color: colors.textSecondary,
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {props.mergeSearchMode === 'semantic'
                  ? t(
                      'graph.search_semantic_empty',
                      '没有语义相近的节点。没做向量的节点不会出现在语义搜索里。'
                    )
                  : t('graph.search_no_hits', '没有找到匹配的节点')}
              </Text>
            ) : null}
            {props.mergeHits.map((hit) => (
              <View
                key={hit.id}
                style={[styles.checkRow, { gap: tokens.spacing.sm, width: '100%', minWidth: 0 }]}
              >
                <Checkbox
                  selected={props.mergeLoserIds.has(hit.id)}
                  onPress={() => props.onToggleMergeLoser(hit.id)}
                />
                <Text
                  style={{
                    color: colors.textPrimary,
                    flex: 1,
                    minWidth: 0,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                  numberOfLines={2}
                >
                  {hit.name}
                  {hit.nodeType ? ` · ${translateGraphNodeType(t, hit.nodeType)}` : ''}
                </Text>
              </View>
            ))}
            {props.mergeLoserIds.size > 0 ? (
              <View style={modalActionsStyle}>
                <Button
                  size="sm"
                  isDisabled={props.reviewBusy || !props.selectedId}
                  onPress={() => void props.onMergeSearched()}
                >
                  {t('graph.merge_selected', '合并所选')}
                </Button>
              </View>
            ) : null}
          </SegmentedContent>
        </View>
      </View>
    </Card>
  )
}
