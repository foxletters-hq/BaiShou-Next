import React from 'react'
import { View } from 'react-native'
import {
  scrollIndicatorStyle,
  KeyboardAwareScrollView,
  RestoreBlockingOverlay,
  BackupScopeList
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
import { DataSyncBackupTabSection } from './DataSyncBackupTabSection'
import type { useDataSyncCloud } from '../hooks/useDataSyncCloud'
import type { useNativeTheme } from '@baishou/ui/native'

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
          {backupTab === 'cloud' && (
            <DataSyncCloudStatCards
              colors={colors}
              t={t}
              syncConfig={syncConfig}
              totalSizeString={totalSizeString}
              cloudRecordCount={cloudRecords.length}
            />
          )}

          <DataSyncBackupTabSection
            colors={colors}
            t={t}
            backupTab={backupTab}
            setBackupTab={setBackupTab}
            syncConfig={syncConfig}
            recordsLoading={recordsLoading}
            showHelp={showHelp}
            fetchCloudRecords={fetchCloudRecords}
            headerProps={headerProps}
          />

          {backupTab === 'snapshot' ? <DataSyncSnapshotPanel /> : null}

          {backupTab === 'local' && (
            <View style={[styles.section, { backgroundColor: colors.bgSurface, padding: 16 }]}>
              <ArchiveLocalBackupSection
                embedded
                onExport={handleArchiveExport}
                onImport={handleArchiveImport}
              />
            </View>
          )}

          {backupTab === 'cloud' && (
            <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
              <CloudBackupRecordsPanel {...recordsPanelProps} />
            </View>
          )}

          {(backupTab === 'cloud' || backupTab === 'local') && (
            <View style={styles.backupScopeWrapper}>
              <BackupScopeList />
            </View>
          )}
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
