import React, { useCallback } from 'react'
import { View, LayoutAnimation } from 'react-native'
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
  searchMode = 'semantic',
  onChange,
  onBatchEmbed,
  onAddManualMemory,
  onClearAll,
  onSearch,
  onDeleteEntry,
  onEditEntry,
  onNavigateToConfig,
  onConfigureModel,
  onDetectDimension,
  onTriggerMigration,
  onPageChange
}) => {
  const ragOn = config.ragEnabled

  const handleConfigChange = useCallback(
    (next: RagConfig) => {
      if (next.ragEnabled !== config.ragEnabled) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
      }
      onChange(next)
    },
    [config.ragEnabled, onChange]
  )

  return (
    <View style={styles.root}>
      <SettingsGroupCard>
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

          <RagMemoryStatsSection
            stats={stats}
            embeddingModelId={embeddingModelId}
            isBusy={ragState.isRunning}
            onConfigureModel={onConfigureModel ?? onNavigateToConfig}
            onDetectDimension={onDetectDimension}
          />

          <RagMemoryAlerts
            ragState={ragState}
            hasMismatchModel={hasMismatchModel}
            onTriggerMigration={onTriggerMigration}
          />

          <SettingsCardDivider />

          <RagMemoryRetrievalSection config={config} onChange={handleConfigChange} />

          <SettingsCardDivider />

          <RagMemoryActionsSection
            ragState={ragState}
            onBatchEmbed={onBatchEmbed}
            onAddManualMemory={onAddManualMemory}
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
            onSearch={onSearch}
          />
        ) : null}

        <SettingsGroupCard style={{ marginBottom: 0, marginTop: onSearch ? 16 : 0 }}>
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
        </SettingsGroupCard>
      </View>

      <View style={styles.bottomSpacer} />
    </View>
  )
}
