import React, { useState } from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button } from '../Button'
import { useNativeTheme } from '../theme'
import { RagMemoryAlerts } from './RagMemoryAlerts'
import { RagMemoryEntriesSection } from './RagMemoryEntryCard'
import { RagMemorySearchSection } from './RagMemorySearchSection'
import { SegmentedContent } from '../SegmentedControl'
import { RagMemorySettingsModal } from './RagMemorySettingsModal'
import { ragMemoryStyles as styles } from './rag-memory.styles'
import type { RagMemoryViewProps } from './rag-memory.types'

export const RagMemoryCompactLayout: React.FC<RagMemoryViewProps> = ({
  config,
  stats,
  ragState,
  hasMismatchModel,
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
  onPauseBatchEmbed,
  onResumeBatchEmbed,
  onCancelBatchEmbed,
  onAddManualMemory,
  onClearAll,
  onSearch,
  onDeleteEntry,
  onEditEntry,
  onTriggerMigration,
  onCancelMigration,
  migrationCancelBusy,
  onPageChange,
  suspectCount = 0,
  onReviewSuspects,
  settingsLead
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const count =
    totalCount != null && !searchQuery.trim() && sourceKind === 'all'
      ? totalCount
      : stats.vaultTotalCount != null
        ? stats.vaultTotalCount
        : stats.diaryCountForVault != null
          ? stats.diaryCountForVault
          : stats.totalCount
  const dimLine =
    stats.currentDimension > 0
      ? t('settings.rag_meta_dimension', '{{dim}} 维', { dim: stats.currentDimension })
      : t('settings.rag_meta_dimension_unknown', '维度未检测')
  const metaLine = `${t('settings.rag_meta_entries', '{{count}} 条片段', { count })} · ${dimLine}`

  return (
    <View style={styles.root}>
      <View
        style={[styles.compactToolbar, { gap: tokens.spacing.sm, marginBottom: tokens.spacing.md }]}
      >
        <Text
          numberOfLines={1}
          style={[styles.compactMeta, { color: colors.textSecondary, flex: 1 }]}
        >
          {metaLine}
        </Text>
        <Button variant="outlined" size="sm" onPress={() => setSettingsOpen(true)}>
          {t('common.settings', '设置')}
        </Button>
        {onAddManualMemory ? (
          <Button
            variant="outlined"
            size="sm"
            isDisabled={ragState.isRunning}
            onPress={() => void onAddManualMemory()}
          >
            {t('settings.rag_add_manual', '添加片段')}
          </Button>
        ) : null}
      </View>

      {onSearch ? (
        <View style={{ marginBottom: tokens.spacing.md }}>
          <RagMemorySearchSection
            searchQuery={searchQuery}
            searchMode={searchMode}
            sourceKind={sourceKind}
            onSourceKindChange={onSourceKindChange}
            onSearch={onSearch}
            semanticAvailable={semanticAvailable}
            onSemanticUnavailable={onSemanticUnavailable}
          />
        </View>
      ) : null}

      <RagMemoryAlerts
        ragState={ragState}
        hasMismatchModel={hasMismatchModel}
        hideBatchProgress
        onTriggerMigration={onTriggerMigration}
        onCancelMigration={onCancelMigration}
        onPauseBatchEmbed={onPauseBatchEmbed}
        onResumeBatchEmbed={onResumeBatchEmbed}
        onCancelBatchEmbed={onCancelBatchEmbed}
        migrationCancelBusy={migrationCancelBusy}
        suspectCount={suspectCount}
        onReviewSuspects={onReviewSuspects}
      />

      <SegmentedContent value={searchMode}>
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
      </SegmentedContent>

      <RagMemorySettingsModal
        visible={settingsOpen}
        config={config}
        stats={stats}
        settingsLead={settingsLead}
        onChange={onChange}
        onClearAll={onClearAll}
        onClose={() => setSettingsOpen(false)}
      />

      <View style={styles.bottomSpacer} />
    </View>
  )
}
