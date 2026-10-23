import React, { useCallback, useEffect, useState } from 'react'
import { View, LayoutAnimation, Platform } from 'react-native'
import { runAfterIdle } from '@baishou/shared'
import type { RagConfig, RagMemoryViewProps } from './rag-memory.types'
import { ragMemoryStyles as styles } from './rag-memory.styles'
import { SettingsGroupCard } from '../settings/SettingsGroupCard'
import { SettingsCardDivider } from '../settings/SettingsCardDivider'
import { settingsCardStyles } from '../settings/settings-card.styles'
import { RagMemoryHeaderSection } from './RagMemoryHeaderSection'
import { RagMemoryDisabledAlert } from './RagMemoryDisabledAlert'
import { RagMemoryStatsSection } from './RagMemoryStatsSection'
import { RagMemoryRetrievalSection } from './RagMemoryRetrievalSection'
import { RagMemoryActionsSection } from './RagMemoryActionsSection'
import { RagMemorySearchSection } from './RagMemorySearchSection'
import { RagMemoryEntriesSection } from './RagMemoryEntryCard'
import { SegmentedContent } from '../SegmentedControl'
import { RagMemoryAlerts } from './RagMemoryAlerts'
import { RagMemoryCompactLayout } from './RagMemoryCompactLayout'

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
  searchMode = 'semantic',
  isSearching = false,
  sourceKind = 'all',
  onSourceKindChange,
  semanticAvailable = true,
  onSemanticUnavailable,
  onChange,
  onBatchEmbed,
  onPauseBatchEmbed,
  onResumeBatchEmbed,
  onCancelBatchEmbed,
  onAddManualMemory,
  onClearAll,
  onSearch,
  onDeleteEntry,
  onEditEntry,
  onNavigateToConfig,
  onConfigureModel,
  onDetectDimension,
  onTriggerMigration,
  onCancelMigration,
  migrationCancelBusy,
  onPageChange,
  suspectCount = 0,
  onReviewSuspects,
  hideStats = false,
  cardLead,
  compactChrome = false,
  settingsLead
}) => {
  const ragOn = config.ragEnabled
  const [showRetrievalSection, setShowRetrievalSection] = useState(Platform.OS !== 'android')

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const task = runAfterIdle(() => {
      setShowRetrievalSection(true)
    })
    return () => task.cancel()
  }, [])

  const handleConfigChange = useCallback(
    (next: RagConfig) => {
      if (next.ragEnabled !== config.ragEnabled && Platform.OS !== 'android') {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
      onChange(next)
    },
    [config.ragEnabled, onChange]
  )

  if (compactChrome) {
    return (
      <RagMemoryCompactLayout
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
        isSearching={isSearching}
        sourceKind={sourceKind}
        onSourceKindChange={onSourceKindChange}
        semanticAvailable={semanticAvailable}
        onSemanticUnavailable={onSemanticUnavailable}
        onChange={handleConfigChange}
        onBatchEmbed={onBatchEmbed}
        onPauseBatchEmbed={onPauseBatchEmbed}
        onResumeBatchEmbed={onResumeBatchEmbed}
        onCancelBatchEmbed={onCancelBatchEmbed}
        onAddManualMemory={onAddManualMemory}
        onClearAll={onClearAll}
        onSearch={onSearch}
        onDeleteEntry={onDeleteEntry}
        onEditEntry={onEditEntry}
        onNavigateToConfig={onNavigateToConfig}
        onConfigureModel={onConfigureModel}
        onDetectDimension={onDetectDimension}
        onTriggerMigration={onTriggerMigration}
        onCancelMigration={onCancelMigration}
        migrationCancelBusy={migrationCancelBusy}
        onPageChange={onPageChange}
        suspectCount={suspectCount}
        onReviewSuspects={onReviewSuspects}
        hideStats={hideStats}
        settingsLead={settingsLead}
      />
    )
  }

  return (
    <View style={styles.root}>
      <SettingsGroupCard>
        {cardLead ? (
          <>
            {cardLead}
            <SettingsCardDivider />
          </>
        ) : null}
        <RagMemoryHeaderSection
          config={config}
          stats={stats}
          onChange={handleConfigChange}
          onClearAll={onClearAll}
        />

        <RagMemoryDisabledAlert ragEnabled={config.ragEnabled} />

        <View
          style={ragOn ? undefined : settingsCardStyles.collapsed}
          pointerEvents={ragOn ? 'auto' : 'none'}
        >
          <SettingsCardDivider />

          {hideStats ? null : (
            <RagMemoryStatsSection
              stats={stats}
              embeddingModelId={embeddingModelId}
              isBusy={ragState.isRunning}
              onConfigureModel={onConfigureModel ?? onNavigateToConfig}
              onDetectDimension={onDetectDimension}
            />
          )}

          <RagMemoryAlerts
            ragState={ragState}
            hasMismatchModel={hasMismatchModel}
            onTriggerMigration={onTriggerMigration}
            onCancelMigration={onCancelMigration}
            onPauseBatchEmbed={onPauseBatchEmbed}
            onResumeBatchEmbed={onResumeBatchEmbed}
            onCancelBatchEmbed={onCancelBatchEmbed}
            migrationCancelBusy={migrationCancelBusy}
            suspectCount={suspectCount}
            onReviewSuspects={onReviewSuspects}
          />

          {showRetrievalSection ? (
            <>
              <SettingsCardDivider />
              <RagMemoryRetrievalSection config={config} onChange={handleConfigChange} />
            </>
          ) : null}

          <SettingsCardDivider />

          <RagMemoryActionsSection
            ragState={ragState}
            onBatchEmbed={onBatchEmbed}
            onAddManualMemory={onAddManualMemory}
            suspectCount={suspectCount}
            onReviewSuspects={onReviewSuspects}
          />
        </View>
      </SettingsGroupCard>

      <View
        style={ragOn ? undefined : settingsCardStyles.collapsed}
        pointerEvents={ragOn ? 'auto' : 'none'}
      >
        {onSearch ? (
          <RagMemorySearchSection
            searchQuery={searchQuery}
            searchMode={searchMode}
            sourceKind={sourceKind}
            onSourceKindChange={onSourceKindChange}
            onSearch={onSearch}
            semanticAvailable={semanticAvailable}
            onSemanticUnavailable={onSemanticUnavailable}
          />
        ) : null}

        <SegmentedContent value={searchMode}>
          <SettingsGroupCard style={{ marginBottom: 0, marginTop: onSearch ? 16 : 0 }}>
            <RagMemoryEntriesSection
              entries={entries}
              searchQuery={searchQuery}
              searchMode={searchMode}
              sourceKind={sourceKind}
              isSearching={isSearching}
              totalCount={totalCount}
              currentPage={currentPage}
              pageSize={pageSize}
              onDeleteEntry={onDeleteEntry}
              onEditEntry={onEditEntry}
              onPageChange={onPageChange}
            />
          </SettingsGroupCard>
        </SegmentedContent>
      </View>

      <View style={styles.bottomSpacer} />
    </View>
  )
}
