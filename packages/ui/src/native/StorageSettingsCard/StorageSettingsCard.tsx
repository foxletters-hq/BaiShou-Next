import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { settingsHubListStyles as hubStyles } from '../settings/settings-hub.styles'
import { SettingsExpansionTile } from '../settings/SettingsExpansionTile'
import { StoragePermissionPrompt } from '../StoragePermissionPrompt/StoragePermissionPrompt'

export interface NativeStorageSettingsCardProps {
  storageRootPath?: string
  onChangeRoot?: () => Promise<void>
  changeRootLabel?: string
  allFilesAccessGranted?: boolean
  onRequestAllFilesAccess?: () => void | Promise<void>
  embedded?: boolean
  isLast?: boolean
}

export const StorageSettingsCard: React.FC<NativeStorageSettingsCardProps> = ({
  storageRootPath = '...',
  onChangeRoot,
  changeRootLabel,
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

      <View style={styles.rootRow}>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
            {t('settings.storage_root', '数据根目录')}
          </Text>
          <Text style={[styles.mono, { color: colors.textSecondary }]} selectable>
            {storageRootPath}
          </Text>
        </View>
        {onChangeRoot ? (
          <Pressable
            onPress={() => void onChangeRoot()}
            style={({ pressed }) => [
              styles.actionChip,
              { backgroundColor: colors.primaryContainer, opacity: pressed ? 0.7 : 1 }
            ]}
          >
            <Text style={{ color: colors.onPrimaryContainer, fontWeight: '600', fontSize: 13 }}>
              {changeRootLabel ?? t('settings.change_storage_root', '更换根目录')}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  rootRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12
  },
  mono: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexShrink: 0
  }
})
