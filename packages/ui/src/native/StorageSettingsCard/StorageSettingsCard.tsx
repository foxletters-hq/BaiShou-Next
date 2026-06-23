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
  externalJournalsPath?: string | null
  externalJournalsDefaultPath?: string
  externalJournalsFileCount?: number
  externalSummariesPath?: string | null
  externalSummariesDefaultPath?: string
  externalSummariesFileCount?: number
  onChangeDirectory?: () => void | Promise<void>
  changeDirectoryLabel?: string
  onMigrateDirectory?: () => void | Promise<void>
  migrateDirectoryLabel?: string
  onChangeExternalJournalsDirectory?: () => void | Promise<void>
  onClearExternalJournalsDirectory?: () => void | Promise<void>
  onChangeExternalSummariesDirectory?: () => void | Promise<void>
  onClearExternalSummariesDirectory?: () => void | Promise<void>
  onMigrateFromFlutterLegacy?: () => void | Promise<void>
  migrateFromFlutterLegacyLabel?: string
  allFilesAccessGranted?: boolean
  onRequestAllFilesAccess?: () => void | Promise<void>
  embedded?: boolean
  isLast?: boolean
}

export const StorageSettingsCard: React.FC<NativeStorageSettingsCardProps> = ({
  storageRootPath = '...',
  externalJournalsPath = null,
  externalJournalsDefaultPath,
  externalJournalsFileCount,
  externalSummariesPath = null,
  externalSummariesDefaultPath,
  externalSummariesFileCount,
  onChangeDirectory,
  changeDirectoryLabel,
  onMigrateDirectory,
  migrateDirectoryLabel,
  onChangeExternalJournalsDirectory,
  onClearExternalJournalsDirectory,
  onChangeExternalSummariesDirectory,
  onClearExternalSummariesDirectory,
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

      {(onChangeExternalJournalsDirectory || onClearExternalJournalsDirectory) && (
        <View style={styles.sectionBlock}>
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
            {t('storage.external_journals_title', '外部日记目录')}
          </Text>
          <Text style={[styles.mono, { color: colors.textSecondary }]} selectable>
            {externalJournalsPath ||
              externalJournalsDefaultPath ||
              t('storage.external_journals_default', '使用工作区内 Journals')}
          </Text>
          {typeof externalJournalsFileCount === 'number' ? (
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              {t('storage.external_journals_scan_count', {
                count: externalJournalsFileCount,
                defaultValue: `已识别 {{count}} 篇日记 Markdown`
              })}
            </Text>
          ) : null}
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {t(
              'storage.external_journals_hint',
              '可将 Obsidian 等外部日记文件夹指向此处；增量同步会一并纳入。'
            )}
          </Text>
          <View style={styles.actions}>
            {onChangeExternalJournalsDirectory ? (
              <Button
                variant="outline"
                className="w-full"
                style={{ backgroundColor: colors.bgSurface }}
                onPress={() => void onChangeExternalJournalsDirectory()}
              >
                {t('storage.external_journals_pick', '选择日记目录')}
              </Button>
            ) : null}
            {externalJournalsPath && onClearExternalJournalsDirectory ? (
              <Button
                variant="outline"
                className="w-full"
                style={{ backgroundColor: colors.bgSurface }}
                onPress={() => void onClearExternalJournalsDirectory()}
              >
                {t('storage.external_journals_clear', '恢复默认目录')}
              </Button>
            ) : null}
          </View>
        </View>
      )}

      {(onChangeExternalSummariesDirectory || onClearExternalSummariesDirectory) && (
        <View style={styles.sectionBlock}>
          <Text style={[hubStyles.rowTitle, { color: colors.textPrimary }]}>
            {t('storage.external_summaries_title', '外部总结目录')}
          </Text>
          <Text style={[styles.mono, { color: colors.textSecondary }]} selectable>
            {externalSummariesPath ||
              externalSummariesDefaultPath ||
              t('storage.external_summaries_default', '使用工作区内 Archives')}
          </Text>
          {typeof externalSummariesFileCount === 'number' ? (
            <Text style={[styles.hint, { color: colors.textTertiary }]}>
              {t('storage.external_summaries_scan_count', {
                count: externalSummariesFileCount,
                defaultValue: `已识别 {{count}} 篇总结 Markdown`
              })}
            </Text>
          ) : null}
          <Text style={[styles.hint, { color: colors.textTertiary }]}>
            {t(
              'storage.external_summaries_hint',
              '可将外部总结文件夹指向此处；需包含 Weekly/Monthly/Quarterly/Yearly 子目录。'
            )}
          </Text>
          <View style={styles.actions}>
            {onChangeExternalSummariesDirectory ? (
              <Button
                variant="outline"
                className="w-full"
                style={{ backgroundColor: colors.bgSurface }}
                onPress={() => void onChangeExternalSummariesDirectory()}
              >
                {t('storage.external_summaries_pick', '选择总结目录')}
              </Button>
            ) : null}
            {externalSummariesPath && onClearExternalSummariesDirectory ? (
              <Button
                variant="outline"
                className="w-full"
                style={{ backgroundColor: colors.bgSurface }}
                onPress={() => void onClearExternalSummariesDirectory()}
              >
                {t('storage.external_summaries_clear', '恢复默认目录')}
              </Button>
            ) : null}
          </View>
        </View>
      )}
    </SettingsExpansionTile>
  )
}

const styles = StyleSheet.create({
  rootBlock: {
    gap: 4
  },
  sectionBlock: {
    gap: 4,
    marginTop: 12
  },
  mono: {
    fontSize: 13,
    fontFamily: 'monospace',
    lineHeight: 18
  },
  hint: {
    fontSize: 12,
    lineHeight: 17
  },
  actions: {
    marginTop: 8,
    gap: 8
  }
})
