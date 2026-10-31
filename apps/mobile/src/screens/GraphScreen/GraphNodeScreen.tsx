import React, { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useNativeTheme } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { graphSuspectReviewCopy } from '@/src/services/graph-name-candidates.util'
import { useGraphScreenModel } from './useGraphScreenModel'
import { GraphScreenDetailPane } from './GraphScreenDetailPane'
import { GraphScreenOverlays } from './GraphScreenOverlays'
import { graphNodeHref } from './graph-screen-view.util'

export function GraphNodeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const { colors, tokens } = useNativeTheme()
  const chrome = getStackScreenChrome(colors)
  const insets = useSafeAreaInsets()
  const params = useLocalSearchParams<{ nodeId?: string }>()
  const nodeId = decodeURIComponent(String(params.nodeId ?? '').trim())
  const m = useGraphScreenModel()
  const { search, detail, review, data, extract } = m
  const { onSelectNode } = search
  const [loading, setLoading] = useState(true)
  const loadedOnceRef = useRef(false)
  const loadedTargetKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!nodeId || !m.dbReady) return
    const targetKey = `${m.vaultId}:${nodeId}`
    if (loadedTargetKeyRef.current === targetKey) return
    loadedTargetKeyRef.current = targetKey
    loadedOnceRef.current = false
    let cancelled = false
    setLoading(true)
    void onSelectNode(nodeId)
      .then(() => {
        if (!cancelled) {
          loadedOnceRef.current = true
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          loadedOnceRef.current = true
          setLoading(false)
        }
      })
    return () => {
      cancelled = true
      if (!loadedOnceRef.current) {
        loadedTargetKeyRef.current = null
      }
    }
  }, [nodeId, m.dbReady, m.vaultId, onSelectNode])

  useEffect(() => {
    if (loadedOnceRef.current && !loading && !search.selectedNode) {
      router.back()
    }
  }, [loading, search.selectedNode, router])

  const title = search.selectedNode?.name || t('knowledge.graph_node_page', '节点详情')

  return (
    <StackScreenLayout
      title={title}
      {...chrome}
      onBack={() => router.back()}
      contentStyle={{ flex: 1, backgroundColor: colors.bgApp }}
    >
      {loading || !search.selectedNode ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <GraphScreenDetailPane
          fullPage
          style={{ flex: 1, maxHeight: undefined }}
          contentContainerStyle={{
            paddingBottom: insets.bottom + tokens.spacing.xl * 2
          }}
          selectedNode={search.selectedNode}
          editName={detail.editName}
          onEditNameChange={detail.setEditName}
          editNameConflict={detail.editNameConflict}
          sameNameEntities={detail.sameNameEntities}
          editSummary={detail.editSummary}
          onEditSummaryChange={detail.setEditSummary}
          editAliases={detail.editAliases}
          onEditAliasesChange={detail.setEditAliases}
          busy={m.busy}
          onSaveNodeEdit={() => void detail.saveNodeEdit()}
          onReviewNode={(targetNodeId, status) => review.reviewNode(targetNodeId, status)}
          onDeleteSelected={detail.deleteSelected}
          onOpenSplit={() => detail.setSplitOpen(true)}
          onRevertSplit={(discriminator) => void detail.revertSplit(discriminator)}
          onSelectNode={(id) => {
            router.push(graphNodeHref(id))
          }}
          onMergeIntoExisting={(survivorId, survivorName, loserId, loserName) =>
            review.setMergeConfirm({
              survivorId,
              survivorName,
              losers: [{ id: loserId, name: loserName }]
            })
          }
          detailEdges={m.detailEdges}
          onOpenSource={(ref, excerpt) => void m.openSource(ref, excerpt)}
          onReviewEdge={(edgeId, status, endpoints) => review.reviewEdge(edgeId, status, endpoints)}
          onDeleteEdge={detail.deleteEdge}
          addEdgeQuery={detail.addEdgeQuery}
          onAddEdgeQueryChange={detail.setAddEdgeQuery}
          onSearchAddEdgeTarget={(query, mode) => void detail.searchAddEdgeTarget(query, mode)}
          addEdgeSearchMode={detail.addEdgeSearchMode}
          onAddEdgeSearchModeChange={detail.setAddEdgeSearchMode}
          addEdgeSearching={detail.addEdgeSearching}
          addEdgeType={detail.addEdgeType}
          onAddEdgeTypeChange={detail.setAddEdgeType}
          addEdgeToId={detail.addEdgeToId}
          onAddEdgeToIdChange={detail.setAddEdgeToId}
          onAddEdge={() => void detail.addEdge()}
          addEdgeHits={detail.addEdgeHits}
        />
      )}
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
        detailEdges={m.detailEdges}
        findNode={review.findGraphNode}
        onCloseCreate={() => detail.setCreateOpen(false)}
        onCreated={(id) => {
          detail.setCreateOpen(false)
          void data.refresh().then(() => {
            void search.onSelectNode(id)
          })
        }}
        onOpenExisting={(id) => {
          detail.setCreateOpen(false)
          router.push(graphNodeHref(id))
        }}
        onCloseSplit={() => detail.setSplitOpen(false)}
        onSplit={(id) => {
          detail.setSplitOpen(false)
          void data.refresh().then(() => search.onSelectNode(id))
        }}
        onApprove={() => {
          const targetNodeId = search.selectedNode?.id
          if (!targetNodeId) return
          const copy = graphSuspectReviewCopy(search.selectedNode)
          void review.reviewNode(targetNodeId, 'approved').then(() => {
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
