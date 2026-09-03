import React from 'react'
import type { RagMemoryViewProps } from './rag-memory.types'
import { useRagMemoryView, getRagBusyFlags } from './useRagMemoryView'
import { formatRagEntryDate } from './rag-memory.utils'
import { RagMemoryStatusStrip } from './RagMemoryStatusStrip'
import { RagMemoryToolbar } from './RagMemoryToolbar'
import { RagMemoryDisabledAlert } from './RagMemoryDisabledAlert'
import { RagMemoryAlerts } from './RagMemoryAlerts'
import { RagMemoryDiaryEmbedHint } from './RagMemoryDiaryEmbedHint'
import { RagMemoryEntriesList } from './RagMemoryEntriesList'
import { RagMemoryPaginationBar } from './RagMemoryPaginationBar'
import { RagMemoryConsistencySection } from './RagMemoryConsistencySection'
import styles from './RagMemoryView.module.css'

export type {
  RagConfig,
  RagStats,
  RagState,
  RagEntry,
  RagMemoryViewProps
} from './rag-memory.types'

export const RagMemoryView: React.FC<RagMemoryViewProps> = ({
  embedded = false,
  extraStatsChips,
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
  onTriggerMigration,
  onCancelMigration,
  onRestoreMigration,
  onResumeMigration,
  migrationState,
  migrationCancelBusy,
  onSearch,
  onDeleteEntry,
  onEditEntry,
  onNavigateToConfig,
  onDetectDimension,
  onPageChange,
  onOpenSourceSession,
  onCheckConsistency,
  onRepairConsistency
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
    <div className={`${styles.page}${embedded ? ` ${styles.pageEmbedded}` : ''}`}>
      <RagMemoryStatusStrip
        config={config}
        stats={stats}
        embeddingModelId={embeddingModelId}
        isBusy={isBusy}
        extraChips={extraStatsChips}
        onChange={onChange}
        onNavigateToConfig={onNavigateToConfig}
        onDetectDimension={onDetectDimension}
      />

      <RagMemoryToolbar
        config={config}
        stats={stats}
        ragState={ragState}
        isBusy={isBusy}
        isBatchEmbedding={isBatchEmbedding}
        searchQuery={view.searchQuery}
        searchMode={view.searchMode}
        onChange={onChange}
        onSearch={view.handleSearch}
        onClearSearch={view.handleClearSearch}
        onToggleSearchMode={view.toggleSearchMode}
        onBatchEmbed={onBatchEmbed}
        onAddManualMemory={onAddManualMemory}
        onClearAll={onClearAll}
      />

      <div className={styles.alertsSlot}>
        <RagMemoryDisabledAlert ragEnabled={config.ragEnabled} />
        <RagMemoryAlerts
          ragState={ragState}
          hasMismatchModel={hasMismatchModel}
          migrationState={migrationState}
          migrationCancelBusy={migrationCancelBusy}
          onTriggerMigration={onTriggerMigration}
          onCancelMigration={onCancelMigration}
          onRestoreMigration={onRestoreMigration}
          onResumeMigration={onResumeMigration}
        />
        <RagMemoryDiaryEmbedHint
          failedAt={config.lastDiaryEmbedFailureAt}
          failedMessage={config.lastDiaryEmbedFailureMessage}
          onBatchEmbed={onBatchEmbed}
        />
      </div>

      <div className={styles.listScroll}>
        <RagMemoryEntriesList
          entries={entries}
          searchQuery={view.searchQuery}
          activeMenuId={view.activeMenuId}
          setActiveMenuId={view.setActiveMenuId}
          formatDate={formatRagEntryDate}
          onEditEntry={onEditEntry}
          onDeleteEntry={onDeleteEntry}
          onOpenSourceSession={onOpenSourceSession}
        />

        <RagMemoryConsistencySection
          onCheckConsistency={onCheckConsistency}
          onRepairConsistency={onRepairConsistency}
        />
      </div>

      {view.showPagination ? (
        <RagMemoryPaginationBar
          effectiveTotal={view.effectiveTotal}
          pageSize={view.pageSize}
          currentPage={view.currentPage}
          totalPages={view.totalPages}
          onPageChange={view.handlePageChange}
          onPageSizeChange={view.handlePageSizeChange}
        />
      ) : null}
    </div>
  )
}
