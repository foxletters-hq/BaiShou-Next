import React, { useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import {
  KeyboardAwareScrollView,
  SegmentedContent,
  SegmentedControl,
  scrollIndicatorStyle,
  useNativeTheme
} from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import { KnowledgeNotebookGraphPendingTab } from './KnowledgeNotebookGraphPendingTab'
import { KnowledgeNotebookGraphSimilarTab } from './KnowledgeNotebookGraphSimilarTab'
import { knowledgeNotebookGraphNodeHref } from './knowledge-notebook-graph.util'
import { useKnowledgeDetail } from './useKnowledgeDetail'

type ReviewTab = 'pending' | 'similar'

export function KnowledgeNotebookGraphReviewScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, tokens, isDark } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const params = useLocalSearchParams<{ notebookId?: string }>()
  const notebookId = decodeURIComponent(String(params.notebookId ?? '').trim())
  const detail = useKnowledgeDetail(notebookId)
  const [tab, setTab] = useState<ReviewTab>('pending')
  const pendingCount = detail.pendingNodes.length + detail.pendingEdges.length

  useEffect(() => {
    if (!notebookId) router.back()
  }, [notebookId, router])

  useEffect(() => {
    if (pendingCount === 0 && detail.similarPairs.length > 0) setTab('similar')
  }, [detail.similarPairs.length, pendingCount])

  const openNode = (id: string) => {
    router.push(knowledgeNotebookGraphNodeHref(notebookId, id))
  }

  return (
    <StackScreenLayout
      title={t('graph.node_review_title', '整理节点')}
      {...chrome}
      onBack={() => router.back()}
      contentStyle={{ flex: 1, backgroundColor: colors.bgApp }}
    >
      {!detail.dbReady || !detail.detailLoaded ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.md }}>
            <SegmentedControl
              value={tab}
              onChange={(value) => setTab(value as ReviewTab)}
              options={[
                {
                  value: 'pending',
                  label: t('graph.tab_pending_count', '待确认 ({{count}})', { count: pendingCount })
                },
                {
                  value: 'similar',
                  label: t('graph.tab_similar_count', '相似待合并 ({{count}})', {
                    count: detail.similarPairs.length
                  })
                }
              ]}
            />
          </View>
          <SegmentedContent value={tab} style={{ flex: 1, minHeight: 0 }}>
            {tab === 'pending' ? (
              // 待确认列表自带虚拟化滚动容器，不能再嵌进 ScrollView
              <KnowledgeNotebookGraphPendingTab
                nodes={detail.graphNodes}
                pendingNodes={detail.pendingNodes}
                pendingEdges={detail.pendingEdges}
                pendingSelection={detail.pendingSelection}
                reviewBusy={detail.reviewBusy}
                reviewingSelectedStatus={detail.reviewingSelectedStatus}
                onTogglePending={detail.togglePendingSelection}
                onToggleSelectAll={() =>
                  detail.toggleSelectAllPending(detail.pendingNodes, detail.pendingEdges)
                }
                onReviewNode={detail.reviewNode}
                onReviewEdge={detail.reviewEdge}
                onReviewSelected={detail.reviewSelectedPending}
                onLocateNode={openNode}
              />
            ) : (
              <KeyboardAwareScrollView
                keyboardShouldPersistTaps="handled"
                indicatorStyle={scrollIndicatorStyle(isDark)}
                contentContainerStyle={{
                  padding: tokens.spacing.md,
                  paddingBottom: tokens.spacing.xl * 2
                }}
              >
                <KnowledgeNotebookGraphSimilarTab
                  similarPairs={detail.similarPairs}
                  reviewBusy={detail.reviewBusy}
                  onLocateNode={openNode}
                  onMergeSimilar={detail.mergeSimilar}
                  onDismissSimilar={detail.dismissSimilar}
                />
              </KeyboardAwareScrollView>
            )}
          </SegmentedContent>
        </View>
      )}
    </StackScreenLayout>
  )
}
