import React from 'react'
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator } from 'react-native'
import { useNativeTheme } from '../theme'
import type { CloudSyncPanelProps } from './cloud-sync-panel.types'
import { useCloudSyncPanel } from './useCloudSyncPanel'
import { cloudSyncPanelStyles as styles } from './cloud-sync-panel.styles'
import {
  CloudSyncTargetSelector,
  CloudSyncConfigFields,
  CloudSyncMaxBackupField
} from './CloudSyncConfigFields'
import { CloudSyncRecordList } from './CloudSyncRecordList'

export type {
  CloudSyncConfig,
  CloudSyncPanelProps,
  CloudSyncRecord
} from './cloud-sync-panel.types'

export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = ({
  config,
  onSaveConfig,
  onSyncNow,
  records,
  isLoading = false
}) => {
  const { colors, tokens } = useNativeTheme()
  const panel = useCloudSyncPanel({ config, onSaveConfig, onSyncNow })

  return (
    <ScrollView
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle,
          borderRadius: tokens.radius.md
        }
      ]}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>☁️ 云同步配置</Text>

      <CloudSyncTargetSelector
        selectedTarget={panel.selectedTarget}
        onSelectTarget={panel.setSelectedTarget}
      />

      <CloudSyncConfigFields
        selectedTarget={panel.selectedTarget}
        localConfig={panel.localConfig}
        onUpdateField={panel.updateField}
      />

      <CloudSyncMaxBackupField
        localConfig={panel.localConfig}
        onUpdateField={panel.updateField}
      />

      <TouchableOpacity
        style={[
          styles.saveButton,
          {
            backgroundColor: colors.primary,
            borderRadius: tokens.radius.sm
          }
        ]}
        onPress={panel.handleSave}
        activeOpacity={0.7}
      >
        <Text style={[styles.saveButtonText, { color: colors.textOnPrimary }]}>保存配置</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[
          styles.syncButton,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderSubtle,
            borderRadius: tokens.radius.sm
          }
        ]}
        onPress={panel.handleSync}
        disabled={panel.syncing || isLoading}
        activeOpacity={0.7}
      >
        {panel.syncing || isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.syncButtonText, { color: colors.primary }]}>🚀 立即同步</Text>
        )}
      </TouchableOpacity>

      {records && <CloudSyncRecordList records={records} />}
    </ScrollView>
  )
}
