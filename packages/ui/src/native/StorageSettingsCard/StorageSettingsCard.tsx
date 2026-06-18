import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { StoragePermissionPrompt } from '../StoragePermissionPrompt/StoragePermissionPrompt'
import { Button } from '../Button'

export interface NativeStorageSettingsCardProps {
  storageRootPath?: string
  onChangeDirectory?: () => void | Promise<void>
  changeDirectoryLabel?: string
  onMigrateDirectory?: () => void | Promise<void>
  migrateDirectoryLabel?: string
  onMigrateFromFlutterLegacy?: () => void | Promise<void>
  migrateFromFlutterLegacyLabel?: string
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
  onMigrateFromFlutterLegacy,
  migrateFromFlutterLegacyLabel,
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

      {onChangeDirectory || onMigrateDirectory || onMigrateFromFlutterLegacy ? (
        <View style={styles.actions}>
          {onMigrateFromFlutterLegacy ? (
            <Button
              variant="primary"
              className="w-full"
              onPress={() => void onMigrateFromFlutterLegacy()}
            >
              {migrateFromFlutterLegacyLabel ??
                t('storage.flutter_legacy_migration_settings_action', '从旧版白守迁移数据')}
            </Button>
          ) : null}
          {onMigrateDirectory ? (
            <Button variant="primary" className="w-full" onPress={() => void onMigrateDirectory()}>
              {migrateDirectoryLabel ?? t('storage.migrate_directory', '迁移数据目录')}
            </Button>
          ) : null}
          {onChangeDirectory ? (
            <Button
              variant="outline"
              className="w-full"
              style={{ backgroundColor: colors.bgSurface }}
              onPress={() => void onChangeDirectory()}
            >
              {changeDirectoryLabel ?? t('storage.change_directory', '更换目录')}
            </Button>
          ) : null}
        </View>
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
  actions: {
    marginTop: 12,
    gap: 8
  }
})
