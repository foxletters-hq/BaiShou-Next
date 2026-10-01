import React from 'react'
import { ActivityIndicator, Platform, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  RagMemoryView,
  ModelSwitcher,
  SettingsCardDivider,
  SettingsGroupCard,
  useNativeTheme
} from '@baishou/ui/native'
import { MemoryClearKindsModal } from './MemoryClearKindsModal'
import { useMobileSuspectCount } from '@/src/hooks/useMobileSuspectCount'
import { requestGraphPendingFocus } from '../../../GraphScreen/graph-pending-focus'
import { useRagMemorySection } from './useRagMemorySection'

export function RAGMemorySectionView({
  hideStats = false,
  cardLead
}: {
  hideStats?: boolean
  cardLead?: React.ReactNode
}) {
  const { tokens } = useNativeTheme()
  const router = useRouter()
  const vm = useRagMemorySection()
  const { suspectCount } = useMobileSuspectCount()
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
    sourceKind,
    isSearching,
    semanticAvailable,
    handleSemanticUnavailable,
    saveConfig,
    handleDetectDimension,
    handleBatchEmbed,
    handlePauseBatchEmbed,
    handleResumeBatchEmbed,
    handleTriggerMigration,
    handleCancelRagOperation,
    ragCancelBusy,
    handleAddManualMemory,
    handleClearAll,
    confirmClearKinds,
    handleSearch,
    handleSourceKindChange,
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
    setPromptMode
  } = vm

  return (
    <>
      {Platform.OS === 'android' && (androidRenderStage < 1 || storageIndexing) ? (
        cardLead ? (
          <SettingsGroupCard>
            {cardLead}
            <SettingsCardDivider />
            <View style={{ paddingVertical: tokens.spacing.lg, alignItems: 'center' }}>
              <ActivityIndicator size="small" />
            </View>
          </SettingsGroupCard>
        ) : (
          <View style={{ paddingVertical: tokens.spacing.lg, alignItems: 'center' }}>
            <ActivityIndicator size="small" />
          </View>
        )
      ) : (
        <RagMemoryView
          hideStats={hideStats}
          cardLead={cardLead}
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
          sourceKind={sourceKind}
          isSearching={isSearching}
          onSourceKindChange={handleSourceKindChange}
          semanticAvailable={semanticAvailable}
          onSemanticUnavailable={() => void handleSemanticUnavailable()}
          onChange={saveConfig}
          onDetectDimension={handleDetectDimension}
          onBatchEmbed={handleBatchEmbed}
          onPauseBatchEmbed={handlePauseBatchEmbed}
          onResumeBatchEmbed={handleResumeBatchEmbed}
          onCancelBatchEmbed={handleCancelRagOperation}
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
          suspectCount={suspectCount}
          onReviewSuspects={() => {
            requestGraphPendingFocus()
            router.push('/graph')
          }}
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

      <MemoryClearKindsModal
        visible={promptMode === 'clear'}
        onCancel={() => setPromptMode(null)}
        onConfirm={(kinds, phrase) => {
          void confirmClearKinds(kinds, phrase)
        }}
      />
    </>
  )
}
