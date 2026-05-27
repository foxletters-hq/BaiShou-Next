import React from 'react'
import type { RagMemoryViewProps } from './rag-memory.types'
import { useRagMemoryView, getRagBusyFlags } from './useRagMemoryView'
import { formatRagDate } from './rag-memory.utils'
import { RagMemoryHeader } from './RagMemoryHeader'
import { RagMemoryDisabledAlert } from './RagMemoryDisabledAlert'
import { RagMemoryStatsChips } from './RagMemoryStatsChips'
import { RagMemoryConfigBlock } from './RagMemoryConfigBlock'
import { RagMemoryAlerts } from './RagMemoryAlerts'
import { RagMemoryActionButtons } from './RagMemoryActionButtons'
import { RagMemorySearchBar } from './RagMemorySearchBar'
import { RagMemoryEntriesList } from './RagMemoryEntriesList'
import styles from './RagMemoryView.module.css'

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
  currentPage: propCurrentPage,
  pageSize: propPageSize,
  onChange,
  onBatchEmbed,
  onAddManualMemory,
  onClearAll,
  onSearch,
  onDeleteEntry,
  onEditEntry,
  onNavigateToConfig,
  onDetectDimension,
  onPageChange
}) => {
  const view = useRagMemoryView({
    totalCount,
    entriesLength: entries.length,
    propCurrentPage,
    propPageSize,
    onSearch,
    onPageChange
  })
  const { isBusy, isBatchEmbedding } = getRagBusyFlags(ragState)

  return (
    <div className={styles.page}>
      <RagMemoryHeader config={config} stats={stats} onChange={onChange} onClearAll={onClearAll} />

      <div className={styles.scrollArea}>
        <RagMemoryDisabledAlert ragEnabled={config.ragEnabled} />

        <RagMemoryStatsChips
          stats={stats}
          embeddingModelId={embeddingModelId}
          isBusy={isBusy}
          onNavigateToConfig={onNavigateToConfig}
          onDetectDimension={onDetectDimension}
        />

        <RagMemoryConfigBlock config={config} onChange={onChange} />

        <RagMemoryAlerts ragState={ragState} hasMismatchModel={hasMismatchModel} />

        <RagMemoryActionButtons
          ragState={ragState}
          isBusy={isBusy}
          isBatchEmbedding={isBatchEmbedding}
          onBatchEmbed={onBatchEmbed}
          onAddManualMemory={onAddManualMemory}
        />

        <RagMemorySearchBar
          searchQuery={view.searchQuery}
          searchMode={view.searchMode}
          onSearch={view.handleSearch}
          onClearSearch={view.handleClearSearch}
          onToggleSearchMode={view.toggleSearchMode}
        />

        <RagMemoryEntriesList
          entries={entries}
          searchQuery={view.searchQuery}
          activeMenuId={view.activeMenuId}
          setActiveMenuId={view.setActiveMenuId}
          formatDate={formatRagDate}
          showPagination={view.showPagination}
          effectiveTotal={view.effectiveTotal}
          pageSize={view.pageSize}
          currentPage={view.currentPage}
          totalPages={view.totalPages}
          onEditEntry={onEditEntry}
          onDeleteEntry={onDeleteEntry}
          onPageChange={view.handlePageChange}
          onPageSizeChange={view.handlePageSizeChange}
        />
      </div>
    </div>
  )
}
