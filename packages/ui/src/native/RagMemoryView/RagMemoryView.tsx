import React from 'react'
import { ScrollView, View } from 'react-native'
import type { RagMemoryViewProps } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'
import { RagMemoryHeaderSection } from './RagMemoryHeaderSection'
import { RagMemoryDisabledAlert } from './RagMemoryDisabledAlert'
import { RagMemoryStatsSection } from './RagMemoryStatsSection'
import { RagMemoryRetrievalSection } from './RagMemoryRetrievalSection'
import { RagMemoryActionsSection } from './RagMemoryActionsSection'
import { RagMemorySearchSection } from './RagMemorySearchSection'
import { RagMemoryEntriesSection } from './RagMemoryEntryCard'
import { RagMemoryAlerts } from './RagMemoryAlerts'

export type {
  RagConfig,
  RagStats,
  RagState,
  RagEntry,
  RagMemoryViewProps
} from './rag-memory.types'

export const RagMemoryView: React.FC<RagMemoryViewProps> = ({
  config,
  stats,
  ragState,
  hasMismatchModel,
  embeddingModelId,
  entries,
  totalCount,
  currentPage = 1,
  pageSize = 10,
  searchQuery = '',
  onChange,
  onBatchEmbed,
  onAddManualMemory,
  onClearAll,
  onSearch,
  onDeleteEntry,
  onEditEntry,
  onNavigateToConfig,
  onDetectDimension,
  onTriggerMigration,
  onPageChange
}) => {
  const isBusy = ragState.isRunning

  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <RagMemoryHeaderSection
        config={config}
        stats={stats}
        onChange={onChange}
        onClearAll={onClearAll}
      />

      <RagMemoryDisabledAlert ragEnabled={config.ragEnabled} />

      <RagMemoryStatsSection
        stats={stats}
        embeddingModelId={embeddingModelId}
        isBusy={isBusy}
        onNavigateToConfig={onNavigateToConfig}
        onDetectDimension={onDetectDimension}
      />

      <RagMemoryAlerts
        ragState={ragState}
        hasMismatchModel={hasMismatchModel}
        onTriggerMigration={onTriggerMigration}
      />

      <RagMemoryRetrievalSection config={config} onChange={onChange} />

      <RagMemoryActionsSection
        ragState={ragState}
        onBatchEmbed={onBatchEmbed}
        onAddManualMemory={onAddManualMemory}
      />

      {onSearch && <RagMemorySearchSection onSearch={onSearch} />}

      <RagMemoryEntriesSection
        entries={entries}
        searchQuery={searchQuery}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        onDeleteEntry={onDeleteEntry}
        onEditEntry={onEditEntry}
        onPageChange={onPageChange}
      />

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}
