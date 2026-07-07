import React from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { RagMemoryView, ModelSwitcher } from '@baishou/ui/native'
import { TextPromptModal } from '../TextPromptModal'
import { useRagMemorySection } from './useRagMemorySection'

export function RAGMemorySectionView() {
  const { t } = useTranslation()
  const router = useRouter()
  const vm = useRagMemorySection()
  const {
    config,
    stats,
    ragState,
    hasMismatchModel,
    embeddingModelId,
    entries,
    totalCount,
    currentPage,
    pageSize,
    searchQuery,
    searchMode,
    semanticAvailable,
    handleSemanticUnavailable,
    saveConfig,
    handleDetectDimension,
    handleBatchEmbed,
    handleTriggerMigration,
    handleCancelRagOperation,
    ragCancelBusy,
    handleAddManualMemory,
    handleClearAll,
    handleSearch,
    handleDeleteEntry,
    handleEditEntry,
    openModelSwitcher,
    handlePageChange,
    androidRenderStage,
    storageIndexing,
    showModelSwitcher,
    setShowModelSwitcher,
    embeddingProviders,
    embeddingProviderId,
    handleSelectEmbeddingModel,
    promptMode,
    setPromptMode,
    promptDefault,
    onPromptConfirm,
    editEntryRef
  } = vm

  return (
    <>
      {Platform.OS === 'android' && (androidRenderStage < 1 || storageIndexing) ? (
        <View style={{ paddingVertical: 24, alignItems: 'center' }}>
          <ActivityIndicator size="small" />
        </View>
      ) : (
        <RagMemoryView
          config={config}
          stats={stats}
          ragState={ragState}
          hasMismatchModel={hasMismatchModel}
          embeddingModelId={embeddingModelId}
          entries={entries}
          totalCount={totalCount}
          currentPage={currentPage}
          pageSize={pageSize}
          searchQuery={searchQuery}
          searchMode={searchMode}
          semanticAvailable={semanticAvailable}
          onSemanticUnavailable={() => void handleSemanticUnavailable()}
          onChange={saveConfig}
          onDetectDimension={handleDetectDimension}
          onBatchEmbed={handleBatchEmbed}
          onTriggerMigration={handleTriggerMigration}
          onCancelMigration={handleCancelRagOperation}
          migrationCancelBusy={ragCancelBusy}
          onAddManualMemory={handleAddManualMemory}
          onClearAll={handleClearAll}
          onSearch={androidRenderStage >= 2 ? handleSearch : undefined}
          onDeleteEntry={handleDeleteEntry}
          onEditEntry={handleEditEntry}
          onConfigureModel={openModelSwitcher}
          onPageChange={handlePageChange}
        />
      )}

      <ModelSwitcher
        isOpen={showModelSwitcher}
        onClose={() => setShowModelSwitcher(false)}
        providers={embeddingProviders}
        currentProviderId={embeddingProviderId}
        currentModelId={embeddingModelId}
        onSelect={handleSelectEmbeddingModel}
        onManageProviders={() => router.push('/settings/ai-services')}
      />

      <TextPromptModal
        visible={promptMode === 'manual'}
        title={t('settings.rag_add_manual')}
        placeholder={t('settings.rag_edit_manual')}
        multiline
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPromptMode(null)}
        onConfirm={onPromptConfirm}
      />

      <TextPromptModal
        visible={promptMode === 'edit'}
        title={t('settings.rag_edit_manual')}
        defaultValue={promptDefault}
        multiline
        confirmLabel={t('common.save')}
        cancelLabel={t('common.cancel')}
        onCancel={() => {
          setPromptMode(null)
          editEntryRef.current = null
        }}
        onConfirm={onPromptConfirm}
      />

      <TextPromptModal
        visible={promptMode === 'clear'}
        title={t('settings.rag_clear_all')}
        message={t('settings.rag_clear_all_confirm')}
        placeholder={t('settings.rag_clear_all_confirm_phrase')}
        defaultValue={promptDefault}
        confirmLabel={t('common.confirm')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setPromptMode(null)}
        onConfirm={onPromptConfirm}
      />
    </>
  )
}
