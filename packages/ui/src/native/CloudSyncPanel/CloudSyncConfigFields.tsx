import React from 'react'
import { View, Text, TouchableOpacity, TextInput } from 'react-native'
import { useNativeTheme } from '../theme'
import type { CloudSyncConfig } from './cloud-sync-panel.types'
import { CLOUD_SYNC_TARGETS } from './cloud-sync-panel.utils'
import { cloudSyncPanelStyles as styles } from './cloud-sync-panel.styles'

interface CloudSyncTargetSelectorProps {
  selectedTarget: string
  onSelectTarget: (target: string) => void
}

export const CloudSyncTargetSelector: React.FC<CloudSyncTargetSelectorProps> = ({
  selectedTarget,
  onSelectTarget
}) => {
  const { colors, tokens } = useNativeTheme()

  return (
    <View style={styles.targetRow}>
      {CLOUD_SYNC_TARGETS.map((opt) => {
        const isSelected = selectedTarget === opt.key
        return (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.targetChip,
              {
                backgroundColor: isSelected ? colors.primary : colors.bgSurfaceNormal,
                borderColor: isSelected ? colors.primary : colors.borderSubtle,
                borderRadius: tokens.radius.sm
              }
            ]}
            onPress={() => onSelectTarget(opt.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.targetChipText,
                { color: isSelected ? colors.textOnPrimary : colors.textSecondary }
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )
}

interface CloudSyncConfigFieldsProps {
  selectedTarget: string
  localConfig: CloudSyncConfig
  onUpdateField: (field: keyof CloudSyncConfig, value: string | number) => void
}

export const CloudSyncConfigFields: React.FC<CloudSyncConfigFieldsProps> = ({
  selectedTarget,
  localConfig,
  onUpdateField
}) => {
  const { colors, tokens } = useNativeTheme()

  const renderField = (
    label: string,
    field: keyof CloudSyncConfig,
    placeholder: string,
    secureTextEntry = false
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.bgSurfaceNormal,
            color: colors.textPrimary,
            borderColor: colors.borderSubtle,
            borderRadius: tokens.radius.sm
          }
        ]}
        value={String(localConfig[field])}
        onChangeText={(v) =>
          onUpdateField(field, field === 'maxBackupCount' ? Math.max(1, Number(v) || 1) : v)
        }
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={field === 'maxBackupCount' ? 'numeric' : 'default'}
        autoCapitalize="none"
      />
    </View>
  )

  if (selectedTarget === 'webdav') {
    return (
      <View style={styles.configSection}>
        {renderField('WebDAV URL', 'webdavUrl', 'https://example.com/dav')}
        {renderField('用户名', 'webdavUsername', 'username')}
        {renderField('密码', 'webdavPassword', 'password', true)}
        {renderField('路径', 'webdavPath', '/baishou')}
      </View>
    )
  }

  if (selectedTarget === 's3') {
    return (
      <View style={styles.configSection}>
        {renderField('Endpoint', 's3Endpoint', 'https://s3.amazonaws.com')}
        {renderField('Region', 's3Region', 'us-east-1')}
        {renderField('Bucket', 's3Bucket', 'my-bucket')}
        {renderField('路径', 's3Path', 'baishou/')}
        {renderField('Access Key', 's3AccessKey', 'AKID...')}
        {renderField('Secret Key', 's3SecretKey', 'secret', true)}
      </View>
    )
  }

  if (selectedTarget === 'local') {
    return (
      <Text style={[styles.hintText, { color: colors.textTertiary }]}>
        本地模式将备份保存在设备本地存储中
      </Text>
    )
  }

  return null
}

export const CloudSyncMaxBackupField: React.FC<{
  localConfig: CloudSyncConfig
  onUpdateField: (field: keyof CloudSyncConfig, value: string | number) => void
}> = ({ localConfig, onUpdateField }) => {
  const { colors, tokens } = useNativeTheme()

  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>最大备份数</Text>
      <TextInput
        style={[
          styles.fieldInput,
          {
            backgroundColor: colors.bgSurfaceNormal,
            color: colors.textPrimary,
            borderColor: colors.borderSubtle,
            borderRadius: tokens.radius.sm
          }
        ]}
        value={String(localConfig.maxBackupCount)}
        onChangeText={(v) =>
          onUpdateField('maxBackupCount', Math.max(1, Number(v) || 1))
        }
        placeholder="10"
        placeholderTextColor={colors.textTertiary}
        keyboardType="numeric"
        autoCapitalize="none"
      />
    </View>
  )
}
