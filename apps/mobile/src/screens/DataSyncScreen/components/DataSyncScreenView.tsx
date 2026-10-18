import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { Archive, RefreshCw } from 'lucide-react-native'
import {
  scrollIndicatorStyle,
  KeyboardAwareScrollView,
  RestoreBlockingOverlay,
  BackupScopeList,
  SegmentedContent,
  SegmentedControl,
  SettingsHelpIconButton
} from '@baishou/ui/native'
import {
  resolveArchiveImportStageDetail,
  resolveArchiveImportStageHint,
  resolveArchiveImportStageMessage
} from '../../../services/archive-guards.util'
import { DataSyncSnapshotPanel } from '../../DataSyncSnapshotPanel'
import { StackScreenLayout } from '../../../components/StackScreenLayout'
import { getStackScreenChrome } from '../../../components/stackScreenChrome'
import { DataSyncCountModal } from '../../DataSyncCountModal'
import { DataSyncConfigSheet } from '../../DataSyncConfigSheet'
import { ArchiveLocalBackupSection } from '../ArchiveLocalBackupSection'
import { dataSyncScreenStyles as styles } from '../data-sync-screen.styles'
import { CloudBackupRecordsPanel } from './CloudBackupRecordsPanel'
import { DataSyncCloudStatCards } from './DataSyncCloudStatCards'
import { DataSyncBackupHeader } from './DataSyncBackupHeader'
import type { useDataSyncCloud } from '../hooks/useDataSyncCloud'
import type { useNativeTheme } from '@baishou/ui/native'
import { mobileTypography, sharedTokens } from '@baishou/ui/theme/tokens'

type Props = ReturnType<typeof useDataSyncCloud> & {
  colors: ReturnType<typeof useNativeTheme>['colors']
  tokens: ReturnType<typeof useNativeTheme>['tokens']
  maxModalWidth: number
  isDark: boolean
  insets: import('react-native-safe-area-context').EdgeInsets
}

export function DataSyncScreenView(all: Props) {
  const {
    t,
    colors,
    tokens,
    maxModalWidth,
    isDark,
    insets,
    syncConfig,
    configDraft,
    setConfigDraft,
    showConfigForm,
    setShowConfigForm,
    showPasswordInConfig,
    setShowPasswordInConfig,
    handleSaveConfig,
    isRestoring,
    isArchiveImporting,
    archiveImportMessage,
    cloudRestoreProgress,
    archiveImportHint,
    archiveImportDetail,
    archiveImportPercent,
    archiveImportSucceeded,
    backupTab,
    setBackupTab,
    totalSizeString,
    cloudRecords,
    recordsLoading,
    recordsFetchError,
    recordsRefreshing,
    handleRefreshRecords,
    openSettings,
    fetchCloudRecords,
    isMultiSelectMode,
    selectedRecords,
    setSelectedRecords,
    toggleRecordSelection,
    renamingRecord,
    newRecordName,
    setNewRecordName,
    setRenamingRecord,
    handleRenameRecord,
    handleRestoreRecord,
    handleDeleteCloudRecord,
    handleBatchDeleteRecords,
    setIsMultiSelectMode,
    openCountModal,
    maxCountLabel,
    handleSyncNow,
    isSyncing,
    showHelp,
    handleArchiveExport,
    handleArchiveImport,
    showCountModal,
    tempCount,
    setTempCount,
    confirmCountModal,
    setShowCountModal,
    noLimitLabel
  } = all

  const headerProps = {
    backupTab,
    colors,
    t,
    isMultiSelectMode,
    selectedRecords,
    setSelectedRecords,
    cloudRecords,
    recordsLoading,
    handleBatchDeleteRecords,
    setIsMultiSelectMode,
    openSettings,
    openCountModal,
    maxCountLabel,
    handleSyncNow,
    isSyncing,
    syncConfig
  }

  const recordsPanelProps = {
    colors,
    t,
    syncConfig,
    recordsLoading,
    cloudRecords,
    recordsFetchError,
    recordsRefreshing,
    handleRefreshRecords,
    openSettings,
    fetchCloudRecords,
    isMultiSelectMode,
    selectedRecords,
    setSelectedRecords,
    toggleRecordSelection,
    renamingRecord,
    newRecordName,
    setNewRecordName,
    setRenamingRecord,
    handleRenameRecord,
    handleRestoreRecord,
    handleDeleteCloudRecord
  }

  if (showConfigForm) {
    return (
      <DataSyncConfigSheet
        visible
        config={configDraft}
        showPassword={showPasswordInConfig}
        colors={colors}
        tokens={tokens}
        onChange={setConfigDraft}
        onTogglePassword={() => setShowPasswordInConfig((v) => !v)}
        onSave={() => void handleSaveConfig()}
        onClose={() => setShowConfigForm(false)}
      />
    )
  }

  return (
    <>
      <RestoreBlockingOverlay
        visible={isRestoring || isArchiveImporting}
        message={
          isArchiveImporting
            ? archiveImportMessage
            : cloudRestoreProgress
              ? resolveArchiveImportStageMessage(cloudRestoreProgress)
              : undefined
        }
        hint={
          isArchiveImporting
            ? archiveImportHint
            : cloudRestoreProgress
              ? resolveArchiveImportStageHint(cloudRestoreProgress)
              : undefined
        }
        detail={
          isArchiveImporting
            ? archiveImportDetail
            : cloudRestoreProgress
              ? resolveArchiveImportStageDetail(cloudRestoreProgress)
              : undefined
        }
        progress={isArchiveImporting ? archiveImportPercent : cloudRestoreProgress?.percent}
        succeeded={
          isArchiveImporting ? archiveImportSucceeded : cloudRestoreProgress?.stage === 'succeeded'
        }
      />
      <StackScreenLayout
        title={t('data_sync.title')}
        {...getStackScreenChrome(colors)}
        contentStyle={styles.container}
      >
        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 16) + 24 }
          ]}
          indicatorStyle={scrollIndicatorStyle(isDark)}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          <View style={styles.topSwitcherContainer}>
            <SegmentedControl
              size="small"
              value={backupTab}
              onChange={setBackupTab}
              options={[
                { value: 'cloud', label: t('data_sync.cloud_backups_tab') },
                { value: 'snapshot', label: t('data_sync.local_snapshots_tab') },
                { value: 'local', label: t('data_sync.local_backup_tab', '本地备份') }
              ]}
            />
          </View>

          <SegmentedContent value={backupTab}>
            {backupTab === 'snapshot' && (
              <DataSyncSnapshotPanel
                onShowHelp={showHelp}
                headerRight={
                  <TouchableOpacity
                    style={[styles.headerActionBtn, { borderColor: colors.borderControl }]}
                    onPress={openCountModal}
                  >
                    <Archive size={14} color={colors.textSecondary} strokeWidth={2} />
                    <Text
                      style={{
                        color: colors.textSecondary,
                        fontSize: mobileTypography.caption.fontSize,
                        fontWeight: '600'
                      }}
                    >
                      {' '}
                      {maxCountLabel}
                    </Text>
                  </TouchableOpacity>
                }
              />
            )}

            {backupTab === 'cloud' && (
              <>
                <DataSyncCloudStatCards
                  colors={colors}
                  t={t}
                  syncConfig={syncConfig}
                  totalSizeString={totalSizeString}
                  cloudRecordCount={cloudRecords.length}
                />

                <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
                  <View style={styles.headerTitleRow}>
                    <View style={styles.headerTitleBlock}>
                      <Text style={[styles.headerTitleLabel, { color: colors.textPrimary }]}>
                        {t('data_sync.sync_records', '云端备份')}
                      </Text>
                      <SettingsHelpIconButton
                        onPress={showHelp}
                        accessibilityLabel={t('data_sync.cloud_backup_help', '云端备份说明')}
                      />
                      <View style={[styles.targetBadge, { borderColor: colors.primary }]}>
                        <Text
                          style={{
                            color: colors.primary,
                            fontSize: mobileTypography.caption.fontSize,
                            fontWeight: '600'
                          }}
                        >
                          {syncConfig.target.toUpperCase()}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => void fetchCloudRecords({ force: true })}
                        disabled={recordsLoading}
                        hitSlop={8}
                      >
                        <RefreshCw size={20} color={colors.textSecondary} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  <DataSyncBackupHeader {...headerProps} />

                  <View style={{ marginTop: sharedTokens.spacing.mdTight }}>
                    <CloudBackupRecordsPanel {...recordsPanelProps} embedded />
                  </View>
                </View>

                <View style={styles.backupScopeWrapper}>
                  <BackupScopeList />
                </View>
              </>
            )}

            {backupTab === 'local' && (
              <>
                <View
                  style={[
                    styles.section,
                    { backgroundColor: colors.bgSurface, padding: sharedTokens.spacing.md }
                  ]}
                >
                  <View style={styles.headerTitleRow}>
                    <View style={styles.headerTitleBlock}>
                      <Text style={[styles.headerTitleLabel, { color: colors.textPrimary }]}>
                        {t('settings.local_archive_backup', '本地全量备份')}
                      </Text>
                      <SettingsHelpIconButton
                        onPress={showHelp}
                        accessibilityLabel={t('settings.local_backup_help', '本地全量备份说明')}
                      />
                    </View>
                  </View>

                  <ArchiveLocalBackupSection
                    embedded
                    onExport={handleArchiveExport}
                    onImport={handleArchiveImport}
                  />
                </View>

                <View style={styles.backupScopeWrapper}>
                  <BackupScopeList />
                </View>
              </>
            )}
          </SegmentedContent>
        </KeyboardAwareScrollView>

        <DataSyncCountModal
          visible={showCountModal}
          activeTab={backupTab}
          tempCount={tempCount}
          noLimitLabel={noLimitLabel}
          colors={colors}
          maxModalWidth={maxModalWidth}
          onChangeCount={setTempCount}
          onConfirm={() => void confirmCountModal()}
          onClose={() => setShowCountModal(false)}
        />
      </StackScreenLayout>
    </>
  )
}
