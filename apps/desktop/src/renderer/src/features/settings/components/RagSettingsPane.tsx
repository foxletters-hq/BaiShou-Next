import React from 'react'
import { useTranslation } from 'react-i18next'
import { RagMemoryView, useDialog, useToast } from '@baishou/ui'
import { getDefaultRagConfig } from '@baishou/store'
import { useRagSettings } from '../hooks/useRagSettings'
import { useRagStatsPrefetch } from '../hooks/useRagStatsPrefetch'
import { useSettingsScopeNavigation } from '../hooks/useSettingsScopeNavigation'
import { MemoryReadinessBar } from '../../memory/MemoryReadinessBar'
import { useMemoryReadiness } from '../../memory/useMemoryReadiness'

export const RagSettingsPane: React.FC<{
  settings: any
  showReadinessBar?: boolean
  embedded?: boolean
}> = ({ settings, showReadinessBar = true, embedded = false }) => {
  useRagStatsPrefetch()
  const settingsNav = useSettingsScopeNavigation()
  const { t } = useTranslation()
  const { confirm, prompt, alert } = useDialog()
  const toast = useToast()

  const {
    ragStats,
    ragEntries,
    ragTotalCount,
    currentPage,
    pageSize,
    isProcessing,
    activeRagState,
    hasMismatchModel,
    sourceKind,
    isSearching,
    handleDetectDimension,
    handleClearDimension,
    handleBatchEmbed,
    handlePauseBatchEmbed,
    handleResumeBatchEmbed,
    handleCancelBatchEmbed,
    handleAddManualMemory,
    handleTriggerMigration,
    handleCancelMigration,
    handleRestoreMigration,
    handleResumeMigration,
    handleClearAll,
    handleSearch,
    handleSourceKindChange,
    handlePageChange,
    handleDeleteEntry,
    handleEditEntry,
    handleExportEmbeddings,
    handleManageBackups,
    migrationState
  } = useRagSettings({ settings, t, toast, confirm, prompt, alert })

  const ragConfig = settings.ragConfig ?? getDefaultRagConfig()
  const readiness = useMemoryReadiness()
  return (
    <div className="settings-pane settings-pane-full">
      <RagMemoryView
        embedded={embedded}
        extraStatsChips={
          !embedded && showReadinessBar ? (
            <MemoryReadinessBar
              wrap
              rows={readiness.rows}
              omit={['embedding', 'extract', 'graph']}
              showLabel={false}
              onConfigureEmbedding={() => settingsNav.goAiModels()}
              onStartIndex={() => void handleBatchEmbed()}
              pendingEmbedParts={readiness.pendingEmbedParts}
              indexing={readiness.indexing}
            />
          ) : undefined
        }
        config={ragConfig}
        stats={ragStats}
        ragState={
          activeRagState.isRunning
            ? activeRagState
            : isProcessing && activeRagState.type === 'batchEmbed'
              ? { ...activeRagState, isRunning: true }
              : { isRunning: isProcessing, type: 'idle', progress: 0, total: 0, statusText: '' }
        }
        hasMismatchModel={hasMismatchModel}
        migrationState={migrationState}
        embeddingModelId={settings.globalModels?.globalEmbeddingModelId}
        entries={ragEntries}
        totalCount={ragTotalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        onChange={(config) => settings.setRagConfig(config)}
        onNavigateToConfig={() => settingsNav.goAiModels()}
        onPageChange={handlePageChange}
        onDetectDimension={handleDetectDimension}
        onClearDimension={handleClearDimension}
        onBatchEmbed={handleBatchEmbed}
        onPauseBatchEmbed={handlePauseBatchEmbed}
        onResumeBatchEmbed={handleResumeBatchEmbed}
        onCancelBatchEmbed={handleCancelBatchEmbed}
        onAddManualMemory={handleAddManualMemory}
        onTriggerMigration={handleTriggerMigration}
        onCancelMigration={handleCancelMigration}
        onRestoreMigration={handleRestoreMigration}
        onResumeMigration={handleResumeMigration}
        onClearAll={handleClearAll}
        onSearch={handleSearch}
        isSearching={isSearching}
        sourceKind={sourceKind}
        onSourceKindChange={handleSourceKindChange}
        onDeleteEntry={handleDeleteEntry}
        onEditEntry={handleEditEntry}
        onExportEmbeddings={handleExportEmbeddings}
        onManageBackups={handleManageBackups}
        migrationCancelBusy={
          isProcessing && activeRagState.isRunning && activeRagState.type === 'migration'
        }
        graphExtract={readiness.graphExtracting}
        graphExtractWaiting={
          readiness.organizePipeline === 'embed' || readiness.organizePipeline === 'graph'
        }
        pendingGraphCount={readiness.pendingGraphCount}
      />
    </div>
  )
}
