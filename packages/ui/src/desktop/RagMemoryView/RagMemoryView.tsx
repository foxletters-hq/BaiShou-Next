import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import type { RagMemoryViewProps } from './rag-memory.types'
import { useRagMemoryView, getRagBusyFlags } from './useRagMemoryView'
import { formatRagEntryDate } from './rag-memory.utils'
import { RagClearMemoryModal } from './RagClearMemoryModal'
import { RagMemoryStatusStrip } from './RagMemoryStatusStrip'
import { RagMemoryToolbar } from './RagMemoryToolbar'
import { RagMemoryDisabledAlert } from './RagMemoryDisabledAlert'
import { RagMemoryAlerts } from './RagMemoryAlerts'
import { RagMemoryEntriesList } from './RagMemoryEntriesList'
import { RagMemoryPaginationBar } from './RagMemoryPaginationBar'
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
  onAddManualMemory,
  onClearAll,
  onTriggerMigration,
  onCancelMigration,
  onPauseBatchEmbed,
  onResumeBatchEmbed,
  onCancelBatchEmbed,
  onRestoreMigration,
  onResumeMigration,
  migrationState,
  migrationCancelBusy,
  onSearch,
  isSearching = false,
  sourceKind = 'all',
  onSourceKindChange,
  onDeleteEntry,
  onEditEntry,
  onNavigateToConfig,
  onDetectDimension,
  onPageChange,
  graphExtract = null,
  graphExtractWaiting = false,
  pendingGraphCount = 0
}) => {
  const { t } = useTranslation()
  const [clearOpen, setClearOpen] = useState(false)
  const view = useRagMemoryView({
    totalCount,
    entriesLength: entries.length,
    propCurrentPage,
    propPageSize,
    onSearch,
    onPageChange
  })
  const { isBusy } = getRagBusyFlags(ragState)

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
        isBusy={isBusy}
        searchQuery={view.searchQuery}
        searchMode={view.searchMode}
        sourceKind={sourceKind}
        onChange={onChange}
        onSearch={view.handleSearch}
        onClearSearch={view.handleClearSearch}
        onToggleSearchMode={view.toggleSearchMode}
        onSourceKindChange={onSourceKindChange ?? (() => undefined)}
        onAddManualMemory={onAddManualMemory}
        onOpenClear={() => setClearOpen(true)}
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
          onPauseBatchEmbed={onPauseBatchEmbed}
          onResumeBatchEmbed={onResumeBatchEmbed}
          onCancelBatchEmbed={onCancelBatchEmbed}
          onRestoreMigration={onRestoreMigration}
          onResumeMigration={onResumeMigration}
          graphExtract={graphExtract}
          graphExtractWaiting={graphExtractWaiting}
          pendingGraphCount={pendingGraphCount}
        />
      </div>

      <div className={styles.listScroll} aria-busy={isSearching}>
        {isSearching ? (
          <div className={styles.searchingState} role="status" aria-live="polite">
            <Loader2 className={styles.searchingSpinner} size={24} aria-hidden />
            <span>{t('settings.rag_searching', '正在搜索…')}</span>
          </div>
        ) : (
          <RagMemoryEntriesList
            entries={entries}
            searchQuery={view.searchQuery}
            sourceKind={sourceKind}
            activeMenuId={view.activeMenuId}
            setActiveMenuId={view.setActiveMenuId}
            formatDate={formatRagEntryDate}
            onEditEntry={onEditEntry}
            onDeleteEntry={onDeleteEntry}
          />
        )}
      </div>

      {!isSearching && view.showPagination ? (
        <RagMemoryPaginationBar
          effectiveTotal={view.effectiveTotal}
          pageSize={view.pageSize}
          currentPage={view.currentPage}
          totalPages={view.totalPages}
          onPageChange={view.handlePageChange}
          onPageSizeChange={view.handlePageSizeChange}
        />
      ) : null}

      <RagClearMemoryModal
        open={clearOpen}
        busy={isBusy}
        onClose={() => setClearOpen(false)}
        onConfirm={async (kinds) => {
          await onClearAll?.(kinds)
          setClearOpen(false)
        }}
      />
    </div>
  )
}
