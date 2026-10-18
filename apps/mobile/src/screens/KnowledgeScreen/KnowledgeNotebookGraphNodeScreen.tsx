import React, { useEffect } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { KeyboardAwareScrollView, scrollIndicatorStyle, useNativeTheme } from '@baishou/ui/native'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { KnowledgeNotebookGraphDetailCard } from './KnowledgeNotebookGraphDetailCard'
import { KnowledgeNotebookGraphNodeExtras } from './KnowledgeNotebookGraphNodeExtras'
import { knowledgeNotebookGraphNodeHref } from './knowledge-notebook-graph.util'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import { useKnowledgeNotebookGraphNode } from './useKnowledgeNotebookGraphNode'

export function KnowledgeNotebookGraphNodeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, tokens, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const params = useLocalSearchParams<{ notebookId?: string; nodeId?: string }>()
  const notebookId = decodeURIComponent(String(params.notebookId ?? '').trim())
  const nodeId = decodeURIComponent(String(params.nodeId ?? '').trim())
  const page = useKnowledgeNotebookGraphNode({ notebookId, nodeId })

  useEffect(() => {
    if (!page.loading && page.missing && !page.error) router.back()
  }, [page.loading, page.missing, page.error, router])

  const nodes = page.node ? [page.node, ...page.partners] : page.partners

  return (
    <StackScreenLayout
      title={page.node?.name || t('knowledge.graph_node_page', '节点详情')}
      {...chrome}
      onBack={() => router.back()}
      contentStyle={{ flex: 1, backgroundColor: colors.bgApp }}
    >
      {page.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : page.node ? (
        <KeyboardAwareScrollView
          keyboardShouldPersistTaps="handled"
          indicatorStyle={scrollIndicatorStyle(isDark)}
          contentContainerStyle={{
            padding: tokens.spacing.md,
            paddingBottom: tokens.spacing.xl * 2
          }}
        >
          <View style={{ gap: tokens.spacing.sm }}>
            {page.error ? (
              <Text
                style={{
                  color: colors.error,
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {page.error}
              </Text>
            ) : null}
            <KnowledgeNotebookGraphDetailCard
              selectedId={page.node.id}
              selectedNode={page.node}
              reviewBusy={page.reviewBusy}
              mergeSearchQuery={page.mergeSearchQuery}
              mergeSearchMode={page.mergeSearchMode}
              mergeHits={page.mergeHits}
              mergeLoserIds={page.mergeLoserIds}
              mergeSearched={page.mergeSearched}
              onReviewNode={page.reviewNode}
              onMergeSearchQueryChange={page.setMergeSearchQuery}
              onMergeSearchModeChange={page.setMergeSearchMode}
              onSearchMerge={page.searchMergeNodes}
              onToggleMergeLoser={page.toggleMergeLoser}
              onMergeSearched={page.mergeSearchedNodes}
            />
            <KnowledgeNotebookGraphNodeExtras
              selectedId={page.node.id}
              nodes={nodes}
              relatedEdges={page.relatedEdges}
              fragments={page.fragments}
              fragmentsLoading={page.fragmentsLoading}
              reviewBusy={page.reviewBusy}
              onLocateNode={(id) => router.push(knowledgeNotebookGraphNodeHref(notebookId, id))}
              onReviewEdge={page.reviewEdge}
            />
          </View>
        </KeyboardAwareScrollView>
      ) : (
        <View style={{ padding: tokens.spacing.md }}>
          <Text
            style={{
              color: page.error ? colors.error : colors.textSecondary,
              fontSize: mobileTypography.secondary.fontSize
            }}
          >
            {page.error || t('common.loading', '加载中…')}
          </Text>
        </View>
      )}
    </StackScreenLayout>
  )
}
