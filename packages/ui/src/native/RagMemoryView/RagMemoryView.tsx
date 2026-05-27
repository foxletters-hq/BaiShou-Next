import React from 'react'
import { ScrollView, View } from 'react-native'
import type { RagMemoryViewProps } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'
import { RagMemoryOverviewSection } from './RagMemoryOverviewSection'
import { RagMemoryRetrievalSection } from './RagMemoryRetrievalSection'
import { RagMemoryActionsSection } from './RagMemoryActionsSection'
import { RagMemorySearchSection } from './RagMemorySearchSection'
import { RagMemoryEntriesSection } from './RagMemoryEntryCard'

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
  onChange,
  onClearDimension,
  onBatchEmbed,
  onClearAll,
  onDetectDimension,
  onSearch,
  onDeleteEntry
}) => {
  return (
    <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
      <RagMemoryOverviewSection
        config={config}
        stats={stats}
        hasMismatchModel={hasMismatchModel}
        embeddingModelId={embeddingModelId}
        onChange={onChange}
      />

      <RagMemoryRetrievalSection config={config} onChange={onChange} />

      <RagMemoryActionsSection
        ragState={ragState}
        onBatchEmbed={onBatchEmbed}
        onClearAll={onClearAll}
        onClearDimension={onClearDimension}
        onDetectDimension={onDetectDimension}
      />

      {onSearch && <RagMemorySearchSection onSearch={onSearch} />}

      <RagMemoryEntriesSection entries={entries} onDeleteEntry={onDeleteEntry} />

      <View style={styles.bottomSpacer} />
    </ScrollView>
  )
}
