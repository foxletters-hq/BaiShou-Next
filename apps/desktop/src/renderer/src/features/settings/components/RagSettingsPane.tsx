import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { RagMemoryView, useDialog, useToast } from '@baishou/ui'
import { useRagSettings } from '../hooks/useRagSettings'

export const RagSettingsPane: React.FC<{ settings: any }> = ({ settings }) => {
  const navigate = useNavigate()
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
    searchQuery,
    searchMode,
    setCurrentPage,
    setPageSize,
    loadRagData,
    handleDetectDimension,
    handleClearDimension,
    handleBatchEmbed,
    handleAddManualMemory,
    handleTriggerMigration,
    handleCancelMigration,
    handleRestoreMigration,
    handleResumeMigration,
    handleClearAll,
    handleSearch,
    handleDeleteEntry,
    handleEditEntry,
    handleExportEmbeddings,
    handleManageBackups,
    migrationState
  } = useRagSettings({ settings, t, toast, confirm, prompt, alert })

  if (!settings.ragConfig) return <div />
  return (
    <div className="settings-pane settings-pane-full">
      <RagMemoryView
        config={settings.ragConfig}
        stats={ragStats}
        ragState={
          activeRagState.isRunning
            ? activeRagState
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
        onNavigateToConfig={() => navigate('/settings/ai-models')}
        onPageChange={(page, size) => {
          setCurrentPage(page)
          setPageSize(size)
          loadRagData(searchQuery, searchMode, page, size)
        }}
        onDetectDimension={handleDetectDimension}
        onClearDimension={handleClearDimension}
        onBatchEmbed={handleBatchEmbed}
        onAddManualMemory={handleAddManualMemory}
        onTriggerMigration={handleTriggerMigration}
        onCancelMigration={handleCancelMigration}
        onRestoreMigration={handleRestoreMigration}
        onResumeMigration={handleResumeMigration}
        onClearAll={handleClearAll}
        onSearch={handleSearch}
        onDeleteEntry={handleDeleteEntry}
        onEditEntry={handleEditEntry}
        onExportEmbeddings={handleExportEmbeddings}
        onManageBackups={handleManageBackups}
      />
    </div>
  )
}
