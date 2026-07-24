import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { Archive, CheckSquare, CloudUpload, Settings, Trash2 } from 'lucide-react-native'
import type { TFunction } from 'i18next'
import type { SyncRecord } from '@baishou/core-mobile'
import { dataSyncScreenStyles as styles } from '../data-sync-screen.styles'

export type DataSyncBackupHeaderProps = {
  backupTab: 'cloud' | 'snapshot' | 'local'
  colors: Record<string, string>
  t: TFunction
  isMultiSelectMode: boolean
  selectedRecords: Set<string>
  setSelectedRecords: React.Dispatch<React.SetStateAction<Set<string>>>
  cloudRecords: SyncRecord[]
  recordsLoading: boolean
  handleBatchDeleteRecords: () => Promise<void>
  setIsMultiSelectMode: (value: boolean) => void
  openSettings: () => void
  openCountModal: () => void
  maxCountLabel: string
  handleSyncNow: () => Promise<void>
  isSyncing: boolean
  syncConfig: { target: string }
}

export function DataSyncBackupHeader(props: DataSyncBackupHeaderProps) {
  const {
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
  } = props

  if (backupTab === 'local') return null

  return (
    <View style={styles.headerActionsGroup}>
      {backupTab === 'cloud' && (
        <>
          {isMultiSelectMode ? (
            <>
              <TouchableOpacity
                style={[styles.headerActionBtn, { borderColor: colors.borderSubtle }]}
                onPress={() => {
                  if (selectedRecords.size === cloudRecords.length) setSelectedRecords(new Set())
                  else setSelectedRecords(new Set(cloudRecords.map((r) => r.filename)))
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                  {selectedRecords.size === cloudRecords.length
                    ? t('settings.attachment_deselect_all', '取消全选')
                    : t('settings.attachment_select_all', '全选')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setIsMultiSelectMode(false)
                  setSelectedRecords(new Set())
                }}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.headerActionBtn,
                  { backgroundColor: colors.error, borderColor: colors.error }
                ]}
                onPress={handleBatchDeleteRecords}
                disabled={selectedRecords.size === 0}
              >
                <Trash2 size={14} color={colors.textOnPrimary} strokeWidth={2} />
                <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontWeight: '600' }}>
                  {' '}
                  {t('common.delete')} ({selectedRecords.size})
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.headerActionBtn, { borderColor: colors.borderSubtle }]}
              onPress={() => {
                setIsMultiSelectMode(true)
                setSelectedRecords(new Set())
              }}
              disabled={cloudRecords.length === 0 || recordsLoading}
            >
              <CheckSquare size={14} color={colors.textSecondary} strokeWidth={2} />
              <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
                {' '}
                {t('data_sync.batch_manage', '批量管理')}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.headerActionBtn, { borderColor: colors.borderSubtle }]}
            onPress={openSettings}
          >
            <Settings size={14} color={colors.textSecondary} strokeWidth={2} />
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
              {' '}
              {t('data_sync.sync_settings_button', '备份设置')}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity
        style={[styles.headerActionBtn, { borderColor: colors.borderSubtle }]}
        onPress={openCountModal}
      >
        <Archive size={14} color={colors.textSecondary} strokeWidth={2} />
        <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>
          {' '}
          {maxCountLabel}
        </Text>
      </TouchableOpacity>

      {backupTab === 'cloud' && (
        <TouchableOpacity
          style={[
            styles.headerActionBtn,
            { backgroundColor: colors.primary, borderColor: colors.primary }
          ]}
          onPress={handleSyncNow}
          disabled={isSyncing || syncConfig.target === 'local'}
        >
          {isSyncing ? (
            <ActivityIndicator size="small" color={colors.textOnPrimary} />
          ) : (
            <CloudUpload size={14} color={colors.textOnPrimary} strokeWidth={2} />
          )}
          <Text style={{ color: colors.textOnPrimary, fontSize: 12, fontWeight: '600' }}>
            {' '}
            {isSyncing
              ? t('data_sync.syncing_status', '备份中...')
              : t('data_sync.sync_now_button', '立即备份')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}
