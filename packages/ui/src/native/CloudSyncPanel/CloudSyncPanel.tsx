import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ScrollView,
  StyleSheet,
  ActivityIndicator
} from 'react-native'
import { useNativeTheme } from '../theme'

export interface CloudSyncConfig {
  target: string
  maxBackupCount: number
  webdavUrl: string
  webdavUsername: string
  webdavPassword: string
  webdavPath: string
  s3Endpoint: string
  s3Region: string
  s3Bucket: string
  s3Path: string
  s3AccessKey: string
  s3SecretKey: string
}

export interface CloudSyncPanelProps {
  config: CloudSyncConfig
  onSaveConfig?: (config: any) => void
  onSyncNow?: () => Promise<void>
  records?: Array<{
    filename: string
    lastModified: string
    sizeInBytes: number
  }>
  isLoading?: boolean
}

const TARGET_OPTIONS: Array<{ key: string; label: string }> = [
  { key: 'local', label: '本地' },
  { key: 'webdav', label: 'WebDAV' },
  { key: 's3', label: 'S3' }
]

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export const CloudSyncPanel: React.FC<CloudSyncPanelProps> = ({
  config,
  onSaveConfig,
  onSyncNow,
  records,
  isLoading = false
}) => {
  const { colors, tokens } = useNativeTheme()
  const [selectedTarget, setSelectedTarget] = useState(config.target || 'local')
  const [localConfig, setLocalConfig] = useState<CloudSyncConfig>(config)
  const [syncing, setSyncing] = useState(false)

  const updateField = (field: keyof CloudSyncConfig, value: string | number) => {
    setLocalConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleSave = () => {
    if (onSaveConfig) {
      onSaveConfig({ ...localConfig, target: selectedTarget })
    }
  }

  const handleSync = async () => {
    if (!onSyncNow) return
    setSyncing(true)
    await onSyncNow()
    setSyncing(false)
  }

  const renderTargetSelector = () => (
    <View style={styles.targetRow}>
      {TARGET_OPTIONS.map((opt) => {
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
            onPress={() => setSelectedTarget(opt.key)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.targetChipText,
                {
                  color: isSelected ? colors.textOnPrimary : colors.textSecondary
                }
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        )
      })}
    </View>
  )

  const renderField = (
    label: string,
    field: keyof CloudSyncConfig,
    placeholder: string,
    secureTextEntry = false
  ) => (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
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
          updateField(
            field,
            field === 'maxBackupCount' ? Math.max(1, Number(v) || 1) : v
          )
        }
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        secureTextEntry={secureTextEntry}
        keyboardType={field === 'maxBackupCount' ? 'numeric' : 'default'}
        autoCapitalize="none"
      />
    </View>
  )

  const renderConfigFields = () => {
    if (selectedTarget === 'webdav') {
      return (
        <View>
          {renderField('WebDAV URL', 'webdavUrl', 'https://example.com/dav')}
          {renderField('用户名', 'webdavUsername', 'username')}
          {renderField('密码', 'webdavPassword', 'password', true)}
          {renderField('路径', 'webdavPath', '/baishou')}
        </View>
      )
    }

    if (selectedTarget === 's3') {
      return (
        <View>
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

  const renderRecord = ({
    item
  }: {
    item: { filename: string; lastModified: string; sizeInBytes: number }
  }) => (
    <View
      style={[
        styles.recordItem,
        { borderColor: colors.borderSubtle }
      ]}
    >
      <View style={styles.recordInfo}>
        <Text style={[styles.recordName, { color: colors.textPrimary }]}>
          {item.filename}
        </Text>
        <Text style={[styles.recordMeta, { color: colors.textTertiary }]}>
          {item.lastModified} · {formatSize(item.sizeInBytes)}
        </Text>
      </View>
    </View>
  )

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
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        ☁️ 云同步配置
      </Text>

      {renderTargetSelector()}

      <View style={styles.configSection}>{renderConfigFields()}</View>

      {renderField('最大备份数', 'maxBackupCount', '10')}

      <TouchableOpacity
        style={[
          styles.saveButton,
          {
            backgroundColor: colors.primary,
            borderRadius: tokens.radius.sm
          }
        ]}
        onPress={handleSave}
        activeOpacity={0.7}
      >
        <Text style={[styles.saveButtonText, { color: colors.textOnPrimary }]}>
          保存配置
        </Text>
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
        onPress={handleSync}
        disabled={syncing || isLoading}
        activeOpacity={0.7}
      >
        {syncing || isLoading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={[styles.syncButtonText, { color: colors.primary }]}>
            🚀 立即同步
          </Text>
        )}
      </TouchableOpacity>

      {records && records.length > 0 && (
        <View style={styles.recordsSection}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            云端记录 ({records.length})
          </Text>
          <FlatList
            data={records}
            keyExtractor={(item) => item.filename}
            renderItem={renderRecord}
            scrollEnabled={false}
          />
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    borderWidth: 1
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16
  },
  targetRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8
  },
  targetChip: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1
  },
  targetChipText: {
    fontSize: 14,
    fontWeight: '500'
  },
  configSection: {
    marginBottom: 8
  },
  fieldGroup: {
    marginBottom: 12
  },
  fieldLabel: {
    fontSize: 13,
    marginBottom: 4
  },
  fieldInput: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    fontSize: 14
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16
  },
  saveButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 12
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  syncButton: {
    flexDirection: 'row',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginBottom: 16
  },
  syncButtonText: {
    fontSize: 15,
    fontWeight: '600'
  },
  recordsSection: {
    marginTop: 4
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1
  },
  recordInfo: {
    flex: 1
  },
  recordName: {
    fontSize: 14
  },
  recordMeta: {
    fontSize: 11,
    marginTop: 2
  }
})
