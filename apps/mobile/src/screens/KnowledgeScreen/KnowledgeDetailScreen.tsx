import React, { useState } from 'react'
import { View, Text, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Trash2 } from 'lucide-react-native'
import { mobileTypography } from '@baishou/ui/theme/tokens'
import {
  Button,
  Modal,
  SegmentedContent,
  SegmentedControl,
  modalActionsStyle,
  useNativeTheme,
  useNativeToast
} from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { ModelSwitcher } from '../../components/ModelSwitcher'
import { shareLocalFile } from '@/src/utils/share-local-file.util'
import { createMobileFileSystem } from '@/src/services/create-mobile-file-system'
import { KnowledgeDetailExtractSection } from './KnowledgeDetailExtractSection'
import { KnowledgeDetailImportDialogs } from './KnowledgeDetailImportDialogs'
import { KnowledgeDetailManageSection } from './KnowledgeDetailManageSection'
import { KnowledgeDetailSourcesSection } from './KnowledgeDetailSourcesSection'
import { KnowledgeDetailVectorsSection } from './KnowledgeDetailVectorsSection'
import { KnowledgeNotebookGraphSection } from './KnowledgeNotebookGraphSection'
import { KnowledgeNotebookDeleteDialog } from './KnowledgeNotebookDeleteDialog'
import { KnowledgeExtractHintDialog } from './KnowledgeExtractHintDialog'
import { KnowledgeSourcePreviewModal } from './KnowledgeSourcePreviewModal'
import { KnowledgeDetailJobBanner } from './KnowledgeDetailJobBanner'
import { KnowledgeNotebookStatusStrip } from './KnowledgeNotebookStatusStrip'
import { KnowledgeHeavyConfirmDialog } from './KnowledgeHeavyConfirmDialog'
import { KnowledgeNotebookOrganizeFab } from './KnowledgeNotebookOrganizeFab'
import { resolveNotebookOrganizeFabState } from './knowledge-organize-fab.util'
import { knowledgeOrganizeBannerKind } from './knowledge-organize-banner.util'
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import { useKnowledgeDetail } from './useKnowledgeDetail'
import {
  knowledgeNotebookGraphNodeHref,
  knowledgeNotebookGraphReviewHref
} from './knowledge-notebook-graph.util'

export function KnowledgeDetailScreen() {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const toast = useNativeToast()
  const params = useLocalSearchParams<{ notebookId?: string }>()
  const notebookId = decodeURIComponent(String(params.notebookId ?? '').trim())
  const [activeTab, setActiveTab] = useState<'sources' | 'graph' | 'vectors'>('sources')
  const detail = useKnowledgeDetail(notebookId, activeTab)
  const organizeFab = resolveNotebookOrganizeFabState({
    sourcesReady: detail.stats !== null,
    busy: detail.busy,
    watching: detail.organizeWatching,
    ingestingCount: detail.ingestingCount,
    sources: detail.sources,
    graphJobItems: detail.graphJobItems,
    ingestJobItems: detail.organizeJobItems,
    ocrProgressBySource: detail.ocrProgressBySource
  })
  const organizeBannerKind = knowledgeOrganizeBannerKind({
    watching: detail.organizeWatching,
    ingestingCount: detail.ingestingCount,
    pendingJobs: detail.stats?.pendingJobs ?? 0,
    graphJobItems: detail.graphJobItems,
    ingestJobItems: detail.organizeJobItems,
    ocrProgressBySource: detail.ocrProgressBySource
  })
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)
  const [manageTab, setManageTab] = useState<'settings' | 'data'>('settings')
  const [graphViewMode, setGraphViewMode] = useState<'list' | 'graph'>('list')

  return (
    <StackScreenLayout
      title={detail.name || t('knowledge.title', '知识库')}
      {...chrome}
      onBack={() => router.back()}
      headerRight={{
        icon: Trash2,
        onPress: () => setDeleteOpen(true),
        disabled: detail.busy || !detail.detailLoaded,
        accessibilityLabel: t('knowledge.delete_notebook', '删除笔记本')
      }}
      contentStyle={{ flex: 1, backgroundColor: colors.bgApp }}
    >
      {!detail.dbReady || !notebookId || !detail.detailLoaded ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <ScrollView
            contentContainerStyle={{ paddingBottom: insets.bottom + tokens.spacing.xl * 3 }}
            keyboardShouldPersistTaps="always"
          >
            <View style={{ paddingTop: tokens.spacing.md, gap: tokens.spacing.md }}>
              <View style={{ paddingHorizontal: tokens.spacing.md, alignSelf: 'stretch' }}>
                <SegmentedControl
                  value={activeTab}
                  onChange={(value) => {
                    setActiveTab(value)
                    if (value !== 'graph') setGraphViewMode('list')
                  }}
                  accessibilityLabel={t('knowledge.notebook_tabs', '笔记本页面')}
                  options={[
                    { value: 'sources', label: t('knowledge.tab_sources', '资料') },
                    { value: 'graph', label: t('knowledge.tab_graph', '图数据') },
                    { value: 'vectors', label: t('knowledge.tab_vectors', '向量知识库') }
                  ]}
                />
              </View>
              <KnowledgeDetailJobBanner
                pendingJobs={detail.stats?.pendingJobs ?? 0}
                graphProgress={detail.graphProgress}
                ingestingCount={detail.ingestingCount}
                watching={detail.organizeWatching}
                knownTotal={detail.organizeKnownTotal}
                busy={detail.busy}
                sources={detail.sources.map((source) => ({
                  id: source.id,
                  title: source.title,
                  status: source.status,
                  errorMessage: source.errorMessage,
                  pageCount: source.pageCount
                }))}
                graphJobItems={detail.graphJobItems}
                ingestJobItems={detail.organizeJobItems}
                ocrProgressBySource={detail.ocrProgressBySource}
                onRetry={detail.startOrganize}
                onRestartSource={detail.restartOrganizeSource}
                onCancelSource={detail.cancelOrganizeSource}
              />
              {detail.modelMismatch ? (
                <View
                  style={{
                    marginHorizontal: tokens.spacing.md,
                    marginBottom: tokens.spacing.sm,
                    padding: tokens.spacing.sm,
                    gap: tokens.spacing.sm,
                    borderWidth: 1,
                    borderRadius: tokens.radius.xs,
                    borderColor: colors.error,
                    backgroundColor: colors.bgSurface
                  }}
                >
                  <Text
                    style={{
                      color: colors.error,
                      fontSize: mobileTypography.primary.fontSize,
                      fontWeight: mobileTypography.primary.fontWeight
                    }}
                  >
                    {t('knowledge.model_mismatch_title', '嵌入模型不一致')}
                  </Text>
                  <Text
                    style={{
                      color: colors.textSecondary,
                      fontSize: mobileTypography.secondary.fontSize
                    }}
                  >
                    {t(
                      'knowledge.model_mismatch_hard_block',
                      '提问已硬拦截。请重建索引后再问，否则答案会错得很像样。'
                    )}
                  </Text>
                  <Button
                    size="sm"
                    isDisabled={detail.busy}
                    onPress={() => void detail.rebuildIndex()}
                  >
                    {t('knowledge.rebuild_index', '重建索引')}
                  </Button>
                </View>
              ) : null}
            </View>
            <SegmentedContent value={activeTab}>
              {activeTab === 'sources' ? (
                <>
                  <KnowledgeNotebookStatusStrip
                    embeddingLabel={detail.embeddingModelLabel}
                    graphLabel={detail.graphModelLabel}
                    visionLabel={detail.visionModelId}
                    embeddingProviderId={detail.embeddingProviderId}
                    graphProviderId={detail.graphProviderId}
                    visionProviderId={detail.visionProviderId}
                    extractEngineLabel={detail.extractEngineLabel}
                    sourceCount={detail.sources.length}
                    embeddingConfigured={Boolean(detail.embeddingModelLabel)}
                    graphConfigured={Boolean(detail.graphModelLabel)}
                    visionConfigured={Boolean(detail.visionProviderId && detail.visionModelId)}
                    modelsLoading={!detail.modelsLoaded}
                    onPickEmbedding={detail.pickEmbeddingModel}
                    onPickGraph={detail.pickGraphModel}
                    onPickVision={detail.pickVisionModel}
                    onOpenManage={() => {
                      setManageTab('settings')
                      setManageOpen(true)
                    }}
                    onOpenSettings={() => {
                      setManageTab('settings')
                      setManageOpen(true)
                    }}
                    onOpenDataManage={() => {
                      setManageTab('data')
                      setManageOpen(true)
                    }}
                  />
                  <KnowledgeDetailSourcesSection
                    sources={detail.sources}
                    busy={detail.busy}
                    ocrProgressBySource={detail.ocrProgressBySource}
                    graphJobStatusBySource={Object.fromEntries(
                      (detail.graphJobItems || []).map((item) => [item.sourceId, item.status])
                    )}
                    watching={detail.organizeWatching}
                    uploadingSources={detail.uploadingSources}
                    onAddSource={detail.openAddSource}
                    onDismissUploading={detail.dismissUploading}
                    onRetrySource={detail.retrySource}
                    onRetryFailedGraph={detail.retryFailedGraph}
                    onReprocessGraph={detail.reprocessSourceGraph}
                    onReprocessVector={detail.reprocessSourceVector}
                    onEmbedSource={detail.embedSource}
                    onCancelExtract={detail.cancelExtract}
                    onPreviewExtracted={detail.previewExtracted}
                    onPreviewOriginal={detail.previewOriginal}
                    onDeleteSource={detail.onDeleteSource}
                  />
                </>
              ) : null}
              {activeTab === 'graph' ? (
                <KnowledgeNotebookGraphSection
                  nodes={detail.graphNodes}
                  edges={detail.graphEdges}
                  pagedNodes={detail.graphNodesPage}
                  nodeTotal={detail.graphNodeTotal}
                  nodeInventoryCount={detail.graphInventoryNodeCount}
                  edgeInventoryCount={detail.graphInventoryEdgeCount}
                  loading={detail.graphLoading}
                  pendingNodes={detail.pendingNodes}
                  pendingEdges={detail.pendingEdges}
                  similarPairs={detail.similarPairs}
                  searchQuery={detail.graphSearchQuery}
                  onSearchQueryChange={detail.setGraphSearchQuery}
                  onSearch={detail.searchGraph}
                  searchMode={detail.graphSearchMode}
                  onSearchModeChange={detail.setGraphSearchMode}
                  searchHits={detail.graphSearchHits}
                  nodePage={detail.graphNodePage}
                  nodePageSize={detail.graphNodePageSize}
                  onNodePageChange={detail.setGraphNodePage}
                  onNodePageSizeChange={detail.setGraphNodePageSize}
                  graphProgress={detail.graphProgress}
                  onOpenReview={() => router.push(knowledgeNotebookGraphReviewHref(notebookId))}
                  onOpenNode={(id) => router.push(knowledgeNotebookGraphNodeHref(notebookId, id))}
                  viewMode={graphViewMode}
                  onViewModeChange={setGraphViewMode}
                  viewMaxNodes={detail.viewMaxNodes}
                  onViewMaxNodesChange={(value) => void detail.persistViewMaxNodes(value)}
                />
              ) : null}
              {activeTab === 'vectors' ? (
                <KnowledgeDetailVectorsSection
                  query={detail.vectorQuery}
                  onQueryChange={detail.setVectorQuery}
                  searchMode={detail.vectorSearchMode}
                  onSearchModeChange={detail.setVectorSearchMode}
                  page={detail.vectorPage}
                  pageSize={detail.vectorPageSize}
                  onPageChange={detail.setVectorPage}
                  onPageSizeChange={detail.setVectorPageSize}
                  items={detail.vectorItems}
                  total={detail.vectorTotal}
                  loading={detail.vectorLoading}
                  sourceCount={detail.vectorSourceCount}
                  modelId={detail.vectorModelId || detail.embeddingModelLabel || null}
                  onOpenChunk={(item) =>
                    detail.openTextPreview(
                      item.sourceTitle || t('knowledge.fragment_preview_title', '原文片段'),
                      item.chunkText
                    )
                  }
                />
              ) : null}
            </SegmentedContent>
            {detail.error ? (
              <Text
                style={{
                  color: colors.error,
                  marginTop: tokens.spacing.sm,
                  paddingHorizontal: tokens.spacing.lg,
                  fontSize: mobileTypography.secondary.fontSize
                }}
              >
                {detail.error}
              </Text>
            ) : null}
          </ScrollView>
          {organizeBannerKind === 'idle' ? (
            <KnowledgeNotebookOrganizeFab
              disabled={organizeFab.kind !== 'pending'}
              kind={organizeFab.kind}
              pendingCount={organizeFab.pendingCount}
              bottom={insets.bottom + tokens.spacing.lg + tokens.spacing.md}
              onPress={() => {
                if (organizeFab.kind !== 'pending') return
                void detail.startOrganize()
              }}
            />
          ) : null}
        </View>
      )}
      <Modal
        visible={Boolean(detail.extractedPreview)}
        title={detail.extractedPreview?.title || t('knowledge.extracted_preview', '抽出正文')}
        onClose={detail.closeExtractedPreview}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          style={{ maxHeight: tokens.spacing.xl * 10 }}
          contentContainerStyle={{ paddingRight: tokens.spacing.mdTight }}
        >
          {detail.extractedPreview?.pages && detail.extractedPreview.pages.length > 0 ? (
            detail.extractedPreview.pages.map((page) => (
              <View key={page.page} style={{ marginBottom: tokens.spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: mobileTypography.primary.fontSize,
                    fontWeight: mobileTypography.primary.fontWeight,
                    marginBottom: tokens.spacing.xs
                  }}
                >
                  {t('knowledge.extract_probe_page', '第 {{page}} 页', { page: page.page })}
                </Text>
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: mobileTypography.secondary.fontSize
                  }}
                >
                  {page.text.trim() ||
                    t('knowledge.extract_probe_empty_page', '几乎没有识别出文字')}
                </Text>
              </View>
            ))
          ) : (
            <Text
              style={{
                color: colors.textPrimary,
                fontSize: mobileTypography.body.fontSize,
                lineHeight: mobileTypography.body.lineHeight
              }}
            >
              {detail.extractedPreview?.text}
            </Text>
          )}
        </ScrollView>
        <View style={modalActionsStyle}>
          <Button size="sm" onPress={detail.closeExtractedPreview}>
            {t('common.got_it', '知道了')}
          </Button>
        </View>
      </Modal>
      <KnowledgeSourcePreviewModal
        visible={Boolean(detail.sourcePreview)}
        title={detail.sourcePreview?.title || t('knowledge.source_preview', '原文预览')}
        loading={Boolean(detail.sourcePreview?.loading)}
        error={detail.sourcePreview?.error || null}
        payload={detail.sourcePreview?.payload || null}
        fragments={detail.graphFragments}
        onClose={detail.closeSourcePreview}
        onOpenFile={() => {
          const localUrl = detail.sourcePreview?.payload?.localUrl
          if (!localUrl) return
          void shareLocalFile(createMobileFileSystem(), localUrl).catch((e) => {
            toast.showError(String((e as Error)?.message || e))
          })
        }}
      />
      <KnowledgeHeavyConfirmDialog
        prompt={detail.heavyPrompt}
        busy={detail.busy}
        onCancel={() => detail.settleHeavyConfirm(false)}
        onConfirm={() => detail.settleHeavyConfirm(true)}
      />
      <KnowledgeExtractHintDialog
        visible={Boolean(detail.extractHintPrompt)}
        fileNames={detail.extractHintPrompt?.fileNames || []}
        reason={detail.extractHintPrompt?.reason || null}
        visionConfigured={Boolean(
          detail.extractHintPrompt?.visionConfigured ||
          (detail.visionProviderId && detail.visionModelId)
        )}
        visionModelId={detail.extractHintPrompt?.visionModelId || detail.visionModelId}
        busy={detail.busy}
        onCancel={() => detail.settleExtractHint('cancel')}
        onChoose={(choice) => detail.settleExtractHint(choice)}
        onOpenVisionSettings={detail.pickVisionModel}
      />
      <KnowledgeDetailImportDialogs
        busy={detail.busy}
        importMode={detail.importMode}
        engine={detail.engine}
        pasteTitle={detail.pasteTitle}
        pasteText={detail.pasteText}
        urlValue={detail.urlValue}
        importProcessPrompt={detail.importProcessPrompt}
        onCloseImport={() => detail.setImportMode(null)}
        onPickImportMode={(mode) => detail.setImportMode(mode)}
        onPasteTitleChange={detail.setPasteTitle}
        onPasteTextChange={detail.setPasteText}
        onUrlChange={detail.setUrlValue}
        onImportFile={detail.onImportFile}
        onImportText={detail.onImportText}
        onImportUrl={detail.onImportUrl}
        onSettleImportProcess={detail.settleImportProcess}
      />
      <Modal visible={manageOpen} onClose={detail.busy ? undefined : () => setManageOpen(false)}>
        <View style={{ marginBottom: tokens.spacing.md }}>
          <SegmentedControl
            value={manageTab}
            onChange={setManageTab}
            accessibilityLabel={t('knowledge.notebook_manage', '笔记本管理')}
            options={[
              { value: 'settings', label: t('knowledge.settings', '知识库设置') },
              { value: 'data', label: t('knowledge.data_manage', '数据管理') }
            ]}
          />
        </View>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingRight: tokens.spacing.mdTight }}
        >
          <SegmentedContent value={manageTab}>
            {manageTab === 'settings' ? (
              <KnowledgeDetailExtractSection
                busy={detail.busy}
                probing={detail.probing}
                onSave={() => {
                  void detail.saveExtractConfig().then((ok) => {
                    if (ok) setManageOpen(false)
                  })
                }}
                onProbe={detail.probeExtract}
                sources={detail.sources}
                probeSourceId={detail.probeSourceId}
                onProbeSourceChange={detail.setProbeSourceId}
                visionModelName={
                  detail.visionModelId
                    ? detail.visionModelId
                    : t('knowledge.follow_chat_model', '跟随对话模型')
                }
                onSelectVisionModel={detail.pickVisionModel}
                ocrConcurrency={detail.ocrConcurrency}
                onOcrConcurrencyChange={detail.setOcrConcurrency}
              />
            ) : (
              <KnowledgeDetailManageSection
                graphNodes={detail.graphNodes}
                graphEdges={detail.graphEdges}
                sourceCount={detail.sources.length}
                manageAction={detail.manageAction}
                manageVector={detail.manageVector}
                manageGraph={detail.manageGraph}
                clearPhrase={detail.clearPhrase}
                phrase={detail.phrase}
                canConfirm={detail.canConfirm}
                busy={detail.busy}
                onStartOrganize={detail.startOrganize}
                onManageAction={detail.setManageAction}
                onToggleVector={() => detail.setManageVector((v) => !v)}
                onToggleGraph={() => detail.setManageGraph((v) => !v)}
                onClearPhrase={detail.setClearPhrase}
                onConfirmManage={detail.confirmManage}
              />
            )}
          </SegmentedContent>
        </ScrollView>
      </Modal>
      <KnowledgeNotebookDeleteDialog
        visible={deleteOpen}
        notebookName={detail.name}
        busy={detail.busy}
        onCancel={() => {
          if (detail.busy) return
          setDeleteOpen(false)
        }}
        onConfirm={() => {
          void detail.deleteNotebook().then((ok) => {
            if (!ok) return
            setDeleteOpen(false)
            router.back()
          })
        }}
      />
      <ModelSwitcher
        isVisible={Boolean(detail.modelSwitcherSlot)}
        onClose={detail.closeModelSwitcher}
        onSelect={(providerId, modelId) => void detail.applyModelSwitcher(providerId, modelId)}
        currentProviderId={
          detail.modelSwitcherSlot === 'embedding'
            ? detail.embeddingProviderId
            : detail.modelSwitcherSlot === 'graph'
              ? detail.graphProviderId
              : detail.visionProviderId
        }
        currentModelId={
          detail.modelSwitcherSlot === 'embedding'
            ? detail.embeddingModelId || undefined
            : detail.modelSwitcherSlot === 'graph'
              ? detail.graphModelId || undefined
              : detail.visionModelId || undefined
        }
        filterMode={
          detail.modelSwitcherSlot === 'embedding'
            ? 'embedding'
            : detail.modelSwitcherSlot === 'vision'
              ? 'vision'
              : 'dialogue'
        }
      />
    </StackScreenLayout>
  )
}
