import React from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator
} from 'react-native'
import { Archive, CloudOff, FileText, RefreshCw, Settings } from 'lucide-react-native'
import { Input } from '@baishou/ui/native'
import type { TFunction } from 'i18next'
import type { SyncConfig, SyncRecord } from '@baishou/core-mobile'
import { formatRecordSize } from '../data-sync-cloud.utils'
import { dataSyncScreenStyles as styles } from '../data-sync-screen.styles'

export type CloudBackupRecordsPanelProps = {
  colors: Record<string, string>
  t: TFunction
  syncConfig: SyncConfig
  recordsLoading: boolean
  cloudRecords: SyncRecord[]
  recordsFetchError: string | null
  recordsRefreshing: boolean
  handleRefreshRecords: () => Promise<void>
  openSettings: () => void
  fetchCloudRecords: (options?: { force?: boolean }) => Promise<void>
  isMultiSelectMode: boolean
  selectedRecords: Set<string>
  setSelectedRecords: React.Dispatch<React.SetStateAction<Set<string>>>
  toggleRecordSelection: (filename: string) => void
  renamingRecord: string | null
  newRecordName: string
  setNewRecordName: (value: string) => void
  setRenamingRecord: (value: string | null) => void
  handleRenameRecord: (oldName: string) => Promise<void>
  handleRestoreRecord: (filename: string) => Promise<void>
  handleDeleteCloudRecord: (filename: string) => Promise<void>
}

export function CloudBackupRecordsPanel(props: CloudBackupRecordsPanelProps) {
  const {
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
    toggleRecordSelection,
    renamingRecord,
    newRecordName,
    setNewRecordName,
    setRenamingRecord,
    handleRenameRecord,
    handleRestoreRecord,
    handleDeleteCloudRecord
  } = props

  return (
    <View style={[styles.section, { backgroundColor: colors.bgSurface }]}>
      {recordsLoading && cloudRecords.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary, marginTop: 12 }]}>
            {t('data_sync.loading_records', '正在连线获取云端记录...')}
          </Text>
        </View>
      ) : recordsFetchError ? (
        <View style={styles.emptyContainer}>
          <CloudOff size={48} color={colors.error} strokeWidth={2} style={{ opacity: 0.7 }} />
          <Text style={[styles.emptyText, { color: colors.textPrimary }]}>{recordsFetchError}</Text>
          <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
            {t('data_sync.cloud_fetch_fallback_hint', '请检查备份设置中的连接信息，或稍后重试。')}
          </Text>
          <TouchableOpacity
            style={[styles.retryBtn, { borderColor: colors.primary }]}
            onPress={() => void fetchCloudRecords({ force: true })}
            disabled={recordsLoading}
          >
            <RefreshCw size={16} color={colors.primary} strokeWidth={2} />
            <Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>
              {t('common.retry', '重试')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openSettings} style={styles.settingsLinkBtn}>
            <Settings size={16} color={colors.textSecondary} strokeWidth={2} />
            <Text style={{ color: colors.textSecondary, fontSize: 14, fontWeight: '600' }}>
              {t('data_sync.sync_settings_button', '备份设置')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : cloudRecords.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Archive size={48} color={colors.textTertiary} strokeWidth={2} style={{ opacity: 0.5 }} />
          {syncConfig.target === 'local' ? (
            <>
              <Text style={[styles.emptyText, { color: colors.textPrimary }]}>
                {t('data_sync.local_target_no_cloud_records')}
              </Text>
              <Text style={[styles.emptySubText, { color: colors.textSecondary }]}>
                {t('data_sync.local_target_no_cloud_records_desc')}
              </Text>
            </>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {t('data_sync.no_records_hint', '暂无备份记录')}
            </Text>
          )}
        </View>
      ) : (
        <ScrollView
          nestedScrollEnabled
          refreshControl={
            <RefreshControl
              refreshing={recordsRefreshing}
              onRefresh={handleRefreshRecords}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        >
          <View
            style={[
              styles.recordList,
              {
                backgroundColor: colors.bgSurface,
                borderColor: colors.borderSubtle
              }
            ]}
          >
            {cloudRecords.map((record, index) => (
              <View
                key={record.filename}
                style={[
                  styles.recordItem,
                  {
                    backgroundColor: colors.bgSurface,
                    borderBottomColor: colors.borderSubtle,
                    borderBottomWidth:
                      index < cloudRecords.length - 1 ? StyleSheet.hairlineWidth : 0
                  },
                  selectedRecords.has(record.filename) && {
                    borderColor: colors.primary,
                    borderWidth: 2
                  }
                ]}
              >
                {isMultiSelectMode && (
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      {
                        borderColor: colors.borderSubtle,
                        backgroundColor: selectedRecords.has(record.filename)
                          ? colors.primary
                          : 'transparent'
                      }
                    ]}
                    onPress={() => toggleRecordSelection(record.filename)}
                  >
                    {selectedRecords.has(record.filename) && (
                      <Text style={[styles.checkmark, { color: colors.textOnPrimary }]}>✓</Text>
                    )}
                  </TouchableOpacity>
                )}

                {renamingRecord === record.filename ? (
                  <View style={styles.renameContainer}>
                    <Input
                      value={newRecordName}
                      onChangeText={setNewRecordName}
                      placeholder={t('data_sync.new_name_placeholder')}
                      autoFocus
                    />
                    <TouchableOpacity
                      style={[styles.renameConfirm, { backgroundColor: colors.primary }]}
                      onPress={() => void handleRenameRecord(record.filename)}
                    >
                      <Text style={[styles.renameConfirmText, { color: colors.textOnPrimary }]}>
                        {t('common.confirm')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.renameCancel}
                      onPress={() => {
                        setRenamingRecord(null)
                        setNewRecordName('')
                      }}
                    >
                      <Text style={[styles.renameCancelText, { color: colors.textSecondary }]}>
                        {t('common.cancel')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    <FileText
                      size={22}
                      color={colors.primary}
                      strokeWidth={2}
                      style={{ marginRight: 10, opacity: 0.85 }}
                    />
                    <View style={styles.recordInfo}>
                      <Text
                        style={[styles.recordName, { color: colors.textPrimary }]}
                        numberOfLines={1}
                      >
                        {record.filename}
                        {!record.managed && (
                          <Text style={{ color: colors.primary, fontSize: 11 }}>
                            {' '}
                            {t('cloud.unmanaged_label', '手动')}
                          </Text>
                        )}
                      </Text>
                      <Text style={[styles.recordMeta, { color: colors.textSecondary }]}>
                        {new Date(record.lastModified).toLocaleString()} ·{' '}
                        {formatRecordSize(record.sizeInBytes)}
                      </Text>
                    </View>

                    {!isMultiSelectMode && (
                      <View style={styles.recordActions}>
                        <TouchableOpacity
                          style={[styles.recordAction, { backgroundColor: colors.primaryLight }]}
                          onPress={() => handleRestoreRecord(record.filename)}
                        >
                          <Text style={[styles.recordActionText, { color: colors.primary }]}>
                            {t('data_sync.restore')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.recordAction,
                            { backgroundColor: colors.secondaryContainer }
                          ]}
                          onPress={() => {
                            setRenamingRecord(record.filename)
                            setNewRecordName(record.filename)
                          }}
                        >
                          <Text
                            style={[
                              styles.recordActionText,
                              { color: colors.onSecondaryContainer }
                            ]}
                          >
                            {t('data_sync.rename')}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.recordAction, { backgroundColor: colors.errorContainer }]}
                          onPress={() => handleDeleteCloudRecord(record.filename)}
                        >
                          <Text style={[styles.recordActionText, { color: colors.error }]}>
                            {t('common.delete')}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </>
                )}
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
