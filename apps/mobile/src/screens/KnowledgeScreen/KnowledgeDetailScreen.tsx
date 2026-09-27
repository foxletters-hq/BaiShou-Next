import React, { useState } from 'react'
import { View, Text, ActivityIndicator, ScrollView } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { getNotebookCardAppearance } from '@baishou/shared'
import { settingsTypography } from '@baishou/ui/theme/tokens'
import { Button, Modal, useNativeTheme, useNativeToast } from '@baishou/ui/native'
import { StackScreenLayout } from '../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../components/stackScreenChrome'
import { shareLocalFile } from '@/src/utils/share-local-file.util'
import { createMobileFileSystem } from '@/src/services/create-mobile-file-system'
import { KnowledgeDetailCoverSection } from './KnowledgeDetailCoverSection'
import { KnowledgeDetailExtractSection } from './KnowledgeDetailExtractSection'
import { KnowledgeDetailImportSection } from './KnowledgeDetailImportSection'
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
import { knowledgeDetailStyles as styles } from './knowledge-detail.styles'
import { useKnowledgeDetail } from './useKnowledgeDetail'

export function KnowledgeDetailScreen() {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const insets = useSafeAreaInsets()
  const router = useRouter()
  const chrome = getStackScreenChrome(colors)
  const toast = useNativeToast()
  const params = useLocalSearchParams<{ notebookId?: string }>()
  const notebookId = decodeURIComponent(String(params.notebookId ?? '').trim())
  const detail = useKnowledgeDetail(notebookId)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const appearance = getNotebookCardAppearance(notebookId, {
    coverTone: detail.coverTone,
    coverIcon: detail.coverIcon
  })

  return (
    <StackScreenLayout
      title={detail.name || t('knowledge.title', '知识库')}
      {...chrome}
      onBack={() => router.back()}
      contentStyle={{ flex: 1, backgroundColor: colors.bgApp }}
    >
      {!detail.dbReady || !notebookId ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: insets.bottom + tokens.spacing.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <KnowledgeDetailJobBanner
            pendingJobs={detail.stats?.pendingJobs ?? 0}
            graphProgress={detail.graphProgress}
            ingestingCount={detail.ingestingCount}
            graphJobItems={detail.graphJobItems}
            ocrProgressBySource={detail.ocrProgressBySource}
          />
          <KnowledgeNotebookStatusStrip
            embeddingLabel={detail.embeddingModelLabel}
            graphLabel={detail.graphModelLabel}
            visionLabel={detail.visionModelId}
            extractEngineLabel={detail.extractEngineLabel}
            sourceCount={detail.sources.length}
            embeddingConfigured={Boolean(detail.embeddingModelLabel)}
            graphConfigured={Boolean(detail.graphModelLabel)}
            visionConfigured={Boolean(detail.visionModelId)}
            onPickEmbedding={detail.pickEmbeddingModel}
            onPickGraph={detail.pickGraphModel}
            onPickVision={detail.pickVisionModel}
          />
          <KnowledgeDetailCoverSection
            name={detail.name}
            coverTone={detail.coverTone}
            coverIcon={detail.coverIcon}
            coverImage={detail.coverImage}
            coverUri={detail.coverUri}
            appearance={appearance}
            stats={detail.stats}
            description={detail.description}
            busy={detail.busy}
            modelMismatch={detail.modelMismatch}
            onSaveCover={(patch) => void detail.saveCover(patch)}
            onPickCoverImage={() => void detail.pickCoverImage()}
            onRename={() => void detail.renameNotebook()}
            onEditDescription={() => void detail.editDescription()}
            onRebuildIndex={() => void detail.rebuildIndex()}
            onDelete={() => setDeleteOpen(true)}
          />
          <KnowledgeDetailImportSection
            busy={detail.busy}
            showImport={detail.showImport}
            pasteTitle={detail.pasteTitle}
            pasteText={detail.pasteText}
            urlValue={detail.urlValue}
            onShowImport={detail.setShowImport}
            onPasteTitle={detail.setPasteTitle}
            onPasteText={detail.setPasteText}
            onUrlValue={detail.setUrlValue}
            importProcessMode={detail.importProcessMode}
            onImportProcessMode={detail.setImportProcessMode}
            embeddingModelLabel={detail.embeddingModelLabel}
            graphModelLabel={detail.graphModelLabel}
            extractEngineLabel={detail.extractEngineLabel}
            onImportText={detail.onImportText}
            onImportUrl={detail.onImportUrl}
            onImportFile={detail.onImportFile}
          />
          <KnowledgeDetailExtractSection
            busy={detail.busy}
            engine={detail.engine}
            ocrLanguage={detail.ocrLanguage}
            ocrConcurrency={detail.ocrConcurrency}
            ocrUseCustom={detail.ocrUseCustom}
            onEngineChange={detail.setEngine}
            onOcrLanguageChange={detail.setOcrLanguage}
            onOcrCustomChange={detail.setOcrUseCustom}
            onOcrConcurrencyChange={detail.setOcrConcurrency}
            onSave={detail.saveExtractConfig}
            onRecoverStale={detail.recoverStale}
            onProbe={detail.probeExtract}
            sources={detail.sources}
            probeSourceId={detail.probeSourceId}
            onProbeSourceChange={detail.setProbeSourceId}
            onPickVision={detail.pickVisionModel}
            onPickEmbedding={detail.pickEmbeddingModel}
            onPickGraphModel={detail.pickGraphModel}
            ocrCapReason={detail.ocrCapReason}
            visionCapReason={detail.visionCapReason}
          />
          <KnowledgeDetailSourcesSection
            sources={detail.sources}
            busy={detail.busy}
            ocrProgressBySource={detail.ocrProgressBySource}
            graphJobStatusBySource={Object.fromEntries(
              (detail.graphJobItems || []).map((item) => [item.sourceId, item.status])
            )}
            uploadingSources={detail.uploadingSources}
            onDismissUploading={detail.dismissUploading}
            onRetrySource={detail.retrySource}
            onReprocessGraph={detail.reprocessSourceGraph}
            onReprocessVector={detail.reprocessSourceVector}
            onEmbedSource={detail.embedSource}
            onCancelExtract={detail.cancelExtract}
            onOcrMissing={detail.ocrMissing}
            onPreviewExtracted={detail.previewExtracted}
            onPreviewOriginal={detail.previewOriginal}
            onDeleteSource={detail.onDeleteSource}
          />
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
          <KnowledgeNotebookGraphSection
            nodes={detail.graphNodes}
            edges={detail.graphEdges}
            pendingNodes={detail.pendingNodes}
            pendingEdges={detail.pendingEdges}
            similarPairs={detail.similarPairs}
            searchQuery={detail.graphSearchQuery}
            onSearchQueryChange={detail.setGraphSearchQuery}
            onSearch={detail.searchGraph}
            searchMode={detail.graphSearchMode}
            onSearchModeChange={detail.setGraphSearchMode}
            searchHits={detail.graphSearchHits}
            focusDepth={detail.graphFocusDepth}
            onFocusDepthChange={detail.setGraphFocusDepth}
            selectedId={detail.selectedGraphId}
            highlightIds={detail.graphHighlightIds}
            locateIds={detail.graphLocateIds}
            locateSeq={detail.graphLocateSeq}
            onSelectNode={detail.setSelectedGraphId}
            onClearSelection={() => detail.setSelectedGraphId(null)}
            tab={detail.graphTab}
            onTabChange={detail.setGraphTab}
            graphProgress={detail.graphProgress}
            busy={detail.busy}
            reviewBusy={detail.reviewBusy}
            onReviewNode={detail.reviewNode}
            onReviewEdge={detail.reviewEdge}
            onReviewAll={detail.reviewAllPending}
            onMergeSimilar={detail.mergeSimilar}
            onDismissSimilar={detail.dismissSimilar}
            onLocateNode={detail.locateGraphNode}
            onPreviewFragments={detail.previewGraphFragments}
            viewMaxNodes={detail.viewMaxNodes}
            onViewMaxNodesChange={detail.persistViewMaxNodes}
            mergeSearchQuery={detail.mergeSearchQuery}
            onMergeSearchQueryChange={detail.setMergeSearchQuery}
            onSearchMerge={detail.searchMergeNodes}
            mergeHits={detail.mergeHits}
            mergeLoserIds={detail.mergeLoserIds}
            onToggleMergeLoser={detail.toggleMergeLoser}
            onMergeSearched={detail.mergeSearchedNodes}
            pendingSelection={detail.pendingSelection}
            onTogglePending={detail.togglePendingSelection}
            onToggleSelectAllPending={() =>
              detail.toggleSelectAllPending(detail.pendingNodes, detail.pendingEdges)
            }
            onReviewSelected={detail.reviewSelectedPending}
          />
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
            onRebuildGraph={detail.rebuildNotebookGraph}
            onManageAction={detail.setManageAction}
            onToggleVector={() => detail.setManageVector((v) => !v)}
            onToggleGraph={() => detail.setManageGraph((v) => !v)}
            onClearPhrase={detail.setClearPhrase}
            onConfirmManage={detail.confirmManage}
          />
          <Text
            style={{
              color: colors.textSecondary,
              fontSize: settingsTypography.desc.fontSize,
              fontWeight: settingsTypography.desc.fontWeight,
              paddingHorizontal: tokens.spacing.lg,
              marginTop: tokens.spacing.md
            }}
          >
            {t('knowledge.mount_hint', '资料嵌入完成后，可以在软件内和 AI 对话时挂载。')}
          </Text>
          {detail.error ? (
            <Text
              style={{
                color: colors.error,
                marginTop: tokens.spacing.sm,
                paddingHorizontal: tokens.spacing.lg,
                fontSize: settingsTypography.desc.fontSize
              }}
            >
              {detail.error}
            </Text>
          ) : null}
        </ScrollView>
      )}
      <Modal
        visible={Boolean(detail.extractedPreview)}
        title={detail.extractedPreview?.title || t('knowledge.extracted_preview', '抽出正文')}
        onClose={detail.closeExtractedPreview}
      >
        <ScrollView style={{ maxHeight: tokens.spacing.xl * 10 }}>
          {detail.extractedPreview?.pages && detail.extractedPreview.pages.length > 0 ? (
            detail.extractedPreview.pages.map((page) => (
              <View key={page.page} style={{ marginBottom: tokens.spacing.md }}>
                <Text
                  style={{
                    color: colors.textPrimary,
                    fontSize: settingsTypography.row.fontSize,
                    marginBottom: tokens.spacing.xs
                  }}
                >
                  {t('knowledge.extract_probe_page', '第 {{page}} 页', { page: page.page })}
                </Text>
                <Text style={{ color: colors.textSecondary }}>
                  {page.text.trim() ||
                    t('knowledge.extract_probe_empty_page', '几乎没有识别出文字')}
                </Text>
              </View>
            ))
          ) : (
            <Text style={{ color: colors.textPrimary }}>{detail.extractedPreview?.text}</Text>
          )}
        </ScrollView>
        <View style={{ flexDirection: 'row', marginTop: tokens.spacing.md }}>
          <Button onPress={detail.closeExtractedPreview}>{t('common.got_it', '知道了')}</Button>
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
        visionConfigured={Boolean(detail.extractHintPrompt?.visionConfigured)}
        visionModelId={detail.extractHintPrompt?.visionModelId}
        busy={detail.busy}
        onCancel={() => detail.settleExtractHint('cancel')}
        onChoose={(choice) => detail.settleExtractHint(choice)}
        onOpenVisionSettings={() => void detail.pickVisionModel()}
      />
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
    </StackScreenLayout>
  )
}
