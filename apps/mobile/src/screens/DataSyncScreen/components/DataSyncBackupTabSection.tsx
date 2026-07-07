import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { HelpCircle, RefreshCw } from 'lucide-react-native'
import type { TFunction } from 'i18next'
import type { SyncConfig } from '@baishou/core-mobile'
import { dataSyncScreenStyles as styles } from '../data-sync-screen.styles'
import { DataSyncBackupHeader } from './DataSyncBackupHeader'
import type { ComponentProps } from 'react'

type BackupTab = 'cloud' | 'snapshot' | 'local'

type Props = {
  colors: Record<string, string>
  t: TFunction
  backupTab: BackupTab
  setBackupTab: (tab: BackupTab) => void
  syncConfig: SyncConfig
  recordsLoading: boolean
  showHelp: () => void
  fetchCloudRecords: (options?: { force?: boolean }) => Promise<void>
  headerProps: ComponentProps<typeof DataSyncBackupHeader>
}

export function DataSyncBackupTabSection({
  colors,
  t,
  backupTab,
  setBackupTab,
  syncConfig,
  recordsLoading,
  showHelp,
  fetchCloudRecords,
  headerProps
}: Props) {
  return (
    <View style={[styles.section, { backgroundColor: colors.bgSurface, paddingVertical: 12 }]}>
      <View style={[styles.backupTabBar, { backgroundColor: colors.bgSurfaceHighest }]}>
        {(['cloud', 'snapshot', 'local'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.backupTab, backupTab === tab && { backgroundColor: colors.bgSurface }]}
            onPress={() => setBackupTab(tab)}
          >
            <Text
              style={{
                color: backupTab === tab ? colors.primary : colors.textSecondary,
                fontWeight: backupTab === tab ? '600' : '400',
                fontSize: tab === 'cloud' ? undefined : 13
              }}
            >
              {tab === 'cloud'
                ? t('data_sync.cloud_backups_tab')
                : tab === 'snapshot'
                  ? t('data_sync.local_snapshots_tab')
                  : t('data_sync.local_backup_tab', '本地备份')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.headerTitleRow}>
        <View style={styles.headerTitleBlock}>
          <Text style={[styles.headerTitleLabel, { color: colors.textPrimary }]}>
            {backupTab === 'snapshot'
              ? t('data_sync.local_snapshots', '本地快照')
              : backupTab === 'local'
                ? t('settings.local_archive_backup', '本地全量备份')
                : t('data_sync.sync_records', '云端备份')}
          </Text>
          <TouchableOpacity onPress={showHelp} hitSlop={8}>
            <HelpCircle size={18} color={colors.textSecondary} strokeWidth={2} />
          </TouchableOpacity>
          {backupTab === 'cloud' && (
            <View style={[styles.targetBadge, { borderColor: colors.primary }]}>
              <Text style={{ color: colors.primary, fontSize: 11, fontWeight: '700' }}>
                {syncConfig.target.toUpperCase()}
              </Text>
            </View>
          )}
          {backupTab === 'cloud' && (
            <TouchableOpacity
              onPress={() => void fetchCloudRecords({ force: true })}
              disabled={recordsLoading}
              hitSlop={8}
            >
              <RefreshCw size={20} color={colors.textSecondary} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <DataSyncBackupHeader {...headerProps} />
    </View>
  )
}
