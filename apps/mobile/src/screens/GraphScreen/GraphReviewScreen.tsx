import React, { useEffect, useRef, useState } from 'react'
import { View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { SegmentedContent, SegmentedControl, useNativeTheme } from '@baishou/ui/native'
import { sharedTokens } from '@baishou/ui/theme/tokens'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { graphSuspectReviewCopy } from '@/src/services/graph-name-candidates.util'
import { useGraphScreenModel } from './useGraphScreenModel'
import { GraphScreenPendingTab } from './GraphScreenPendingTab'
import { GraphScreenSimilarTab } from './GraphScreenSimilarTab'
import { GraphScreenReextractTab } from './GraphScreenReextractTab'
import { GraphScreenOverlays } from './GraphScreenOverlays'
import { resolveGraphReviewOverlayTab } from './graph-screen-display.util'
import { graphNodeHref } from './graph-screen-view.util'

type ReviewTab = 'pending' | 'similar' | 'reextract'

export function GraphReviewScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { colors, tokens } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const m = useGraphScreenModel()
  const { search, review, data, detail, extract } = m
  const [tab, setTab] = useState<ReviewTab>('pending')
  const pendingCount = review.pendingItems.length
  const similarCount = data.similarPairs.length
  const reextractCount = data.pending.length
  const listPad = {
    padding: sharedTokens.spacing.md,
    paddingBottom: sharedTokens.spacing.md + insets.bottom + tokens.spacing.xl
  }

  const initialTabReady = useRef(false)
  useEffect(() => {
    if (initialTabReady.current) return
    if (pendingCount + similarCount + reextractCount === 0) return
    initialTabReady.current = true
    setTab(
      resolveGraphReviewOverlayTab({
        pendingCount,
        similarCount,
        reextractCount
      })
    )
  }, [pendingCount, similarCount, reextractCount])

  const openNode = (id: string) => {
    router.push(graphNodeHref(id))
  }

  return (
    <StackScreenLayout
      title={t('graph.node_review_title', '整理节点')}
      {...chrome}
      onBack={() => router.back()}
      contentStyle={{ flex: 1, backgroundColor: colors.bgApp }}
    >
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
                  count: similarCount
                })
              },
              {
                value: 'reextract',
                label: `${t('graph.tab_reextract', '待重抽')} (${reextractCount})`
              }
            ]}
          />
        </View>
        <SegmentedContent value={tab} style={{ flex: 1, minHeight: 0 }}>
          {tab === 'pending' ? (
            <GraphScreenPendingTab
              pendingItems={review.pendingItems}
              pendingSelected={review.pendingSelected}
              pendingSelectedCount={review.pendingSelectedCount}
              allPendingSelected={review.allPendingSelected}
              reviewingSelectedStatus={review.reviewingSelectedStatus}
              graphNodeNameById={m.graphNodeNameById}
              busy={m.busy}
              onToggleSelectAll={review.toggleSelectAllPending}
              onToggleItem={review.togglePendingItem}
              onApplyReviews={(opts) => void review.applyPendingReviews(opts)}
              onReviewNode={(nodeId, status) => void review.reviewNode(nodeId, status)}
              onReviewEdge={(edgeId, status, endpoints) =>
                void review.reviewEdge(edgeId, status, endpoints)
              }
              onLocateNode={(id) => openNode(id)}
              onViewNodeSource={(id, node) =>
                void m.openNodeSource(id, node as { propsJson?: string | null })
              }
              onLocateEdge={(edge) => {
                void search.locatePendingEdge(edge).then(() => {
                  openNode(edge.fromId)
                })
              }}
              onOpenSource={(ref, excerpt) => void m.openSource(ref, excerpt)}
              listPad={listPad}
            />
          ) : tab === 'similar' ? (
            <GraphScreenSimilarTab
              pairs={data.similarPairs}
              busy={m.busy}
              onMerge={(pair) =>
                review.mergeSimilarPair(pair.peerId, pair.nodeId, pair.peerName, pair.nodeName)
              }
              onMergeAll={() => void review.mergeAllSimilarPairs()}
              onKeepApart={(pair) => void review.dismissSimilarPair(pair.nodeId, pair.peerId)}
              onLocateNode={(id) => openNode(id)}
              listPad={listPad}
            />
          ) : (
            <GraphScreenReextractTab
              pending={data.pending}
              queueByPath={extract.queueByPath}
              busy={m.busy}
              onRunExtract={(filePaths) => void extract.runExtract(filePaths)}
              onCancelQueueItem={extract.cancelQueueItem}
              onOpenSource={(date) => void m.openSource(date)}
              listPad={listPad}
            />
          )}
        </SegmentedContent>
      </View>
      <GraphScreenOverlays
        queueModalOpen={extract.queueModalOpen}
        onCloseQueue={() => extract.setQueueModalOpen(false)}
        extractRunning={extract.extractRunning}
        extractQueue={extract.extractQueue}
        extractConcurrency={extract.extractConcurrency}
        onChangeConcurrency={extract.changeExtractConcurrency}
        onCancelQueueItem={extract.cancelQueueItem}
        onStopExtract={extract.stopExtract}
        sourcePreview={m.sourcePreview}
        onCloseSource={() => m.setSourcePreview(null)}
        createOpen={detail.createOpen}
        splitOpen={detail.splitOpen}
        mergeSearchOpen={review.mergeSearchOpen}
        mergeConfirm={review.mergeConfirm}
        busy={m.busy}
        services={m.services}
        vaultId={m.vaultId}
        vaultName={m.vaultName}
        selectedId={search.selectedId}
        selectedNode={search.selectedNode}
        sameNameEntities={detail.sameNameEntities}
        findNode={review.findGraphNode}
        onCloseCreate={() => detail.setCreateOpen(false)}
        onCreated={(id) => {
          detail.setCreateOpen(false)
          void data.refresh().then(() => {
            openNode(id)
          })
        }}
        onOpenExisting={(id) => {
          detail.setCreateOpen(false)
          openNode(id)
        }}
        onCloseSplit={() => detail.setSplitOpen(false)}
        onSplit={(id) => {
          detail.setSplitOpen(false)
          void data.refresh().then(() => search.onSelectNode(id))
        }}
        onApprove={() => {
          const nodeId = search.selectedNode?.id
          if (!nodeId) return
          const copy = graphSuspectReviewCopy(search.selectedNode)
          void review.reviewNode(nodeId, 'approved').then(() => {
            detail.setSplitOpen(false)
            m.toast.showSuccess(m.t(copy.doneKey, copy.doneDefault))
          })
        }}
        onCloseMergeSearch={() => review.setMergeSearchOpen(false)}
        onRequestMerge={review.setMergeConfirm}
        onCancelMerge={() => review.setMergeConfirm(null)}
        onConfirmMerge={() => void review.runConfirmedMerge()}
      />
    </StackScreenLayout>
  )
}
