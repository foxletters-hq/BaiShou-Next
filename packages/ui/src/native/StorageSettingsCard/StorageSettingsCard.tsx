import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { StoragePermissionPrompt } from '../StoragePermissionPrompt/StoragePermissionPrompt'

export interface NativeStorageSettingsCardProps {
  storageRootPath?: string
  onChangeDirectory?: () => void | Promise<void>
  changeDirectoryLabel?: string
  onMigrateDirectory?: () => void | Promise<void>
  migrateDirectoryLabel?: string
  allFilesAccessGranted?: boolean
  onRequestAllFilesAccess?: () => void | Promise<void>
  embedded?: boolean
  isLast?: boolean
}

export const StorageSettingsCard: React.FC<NativeStorageSettingsCardProps> = ({
  storageRootPath = '...',
  onChangeDirectory,
  changeDirectoryLabel,
  onMigrateDirectory,
  migrateDirectoryLabel,
  allFilesAccessGranted,
  onRequestAllFilesAccess,
  embedded = false,
  isLast = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <SettingsExpansionTile
      embedded={embedded}
      isLast={isLast}
      title={t('settings.storage_manager', '存储管理')}
      subtitle={t('settings.storage_root_desc', '白守所有 Vault 数据的物理存放位置')}
    >
      {onRequestAllFilesAccess && allFilesAccessGranted === false ? (
        <StoragePermissionPrompt onRequest={onRequestAllFilesAccess} mode="required" />
      ) : null}

      <View style={styles.rootBlock}>
        <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
          {t('settings.storage_root', '数据根目录')}
        </Text>
        <Text style={[styles.mono, { color: colors.textSecondary }]} selectable>
          {storageRootPath}
        </Text>
      </View>

      {onChangeDirectory ? (
        <Pressable
          onPress={() => void onChangeDirectory()}
          style={({ pressed }) => [
            styles.actionBtn,
            {
              borderColor: colors.primary,
              backgroundColor: colors.primaryContainer,
              opacity: pressed ? 0.7 : 1
            }
          ]}
        >
          <Text style={{ color: colors.onPrimaryContainer, fontWeight: '600', fontSize: 14 }}>
            {changeDirectoryLabel ?? t('storage.change_directory', '更换目录')}
          </Text>
        </Pressable>
      ) : null}

      {onMigrateDirectory ? (
        <Pressable
          onPress={() => void onMigrateDirectory()}
          style={({ pressed }) => [
            styles.actionBtn,
            styles.actionBtnSecondary,
            {
              borderColor: colors.borderSubtle,
              backgroundColor: colors.bgSurface,
              opacity: pressed ? 0.7 : 1
            }
          ]}
        >
          <Text style={{ color: colors.primary, fontWeight: '600', fontSize: 14 }}>
            {migrateDirectoryLabel ?? t('storage.migrate_directory', '迁移数据目录')}
          </Text>
        </Pressable>
      ) : null}
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  rootBlock: {
    gap: 4
  },
  mono: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18
  },
  actionBtn: {
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center'
  },
  actionBtnSecondary: {
    marginTop: 8
  }
})
