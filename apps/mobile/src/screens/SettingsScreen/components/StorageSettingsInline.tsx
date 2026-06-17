import React from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { StorageSettingsCard, RestoreBlockingOverlay } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { useStorageSettings } from '../../../hooks/useStorageSettings'
import { useFlutterLegacyMigrationSettings } from '../../../hooks/useFlutterLegacyMigrationSettings'
import { DirectoryPickerModal } from '../../../components/DirectoryPickerModal'

interface StorageSettingsInlineProps {
  embedded?: boolean
  isLast?: boolean
}

export const StorageSettingsInline: React.FC<StorageSettingsInlineProps> = ({
  embedded = true,
  isLast = false
}) => {
  const { t } = useTranslation()
  const {
    storageRootPath,
    allFilesAccessGranted,
    pickerVisible,
    closeDirectoryPicker,
    storageBusy,
    migrationProgress,
    handleRequestAllFilesAccess,
    handleChangeDirectory,
    handleMigrateDirectory,
    handleDirectorySelected,
    showDirectoryActions,
    fileSystem
  } = useStorageSettings()

  const {
    showMigrateFromFlutterLegacy,
    showDeleteMigratedLegacySource,
    handleMigrateFromFlutterLegacy,
    handleDeleteMigratedLegacySource
  } = useFlutterLegacyMigrationSettings()

  const { flutterLegacyMigrationBusy, flutterLegacyMigrationProgress } = useBaishou()

  const overlayVisible = storageBusy !== 'idle' || flutterLegacyMigrationBusy
  const overlayMessage = flutterLegacyMigrationBusy
    ? t('storage.flutter_legacy_migrating', '正在从旧版目录复制数据…')
    : storageBusy === 'switching'
      ? t('storage.switching_directory', '正在更换目录...')
      : t('storage.migrating_data', '正在迁移数据...')
  const overlayHint = flutterLegacyMigrationBusy
    ? flutterLegacyMigrationProgress
      ? t('storage.migrating_item', {
          name: flutterLegacyMigrationProgress,
          defaultValue: `正在复制：${flutterLegacyMigrationProgress}`
        })
      : t('storage.flutter_legacy_migrating_hint', '请勿关闭应用，原目录数据不会被删除')
    : storageBusy === 'switching'
      ? t('storage.switching_directory_hint', '请勿关闭应用')
      : migrationProgress
        ? t('storage.migrating_item', {
            name: migrationProgress,
            defaultValue: `正在复制：${migrationProgress}`
          })
        : t('storage.migrating_data_hint', '请勿关闭应用，原目录数据不会被删除')

  return (
    <>
      <RestoreBlockingOverlay
        visible={overlayVisible}
        message={overlayMessage}
        hint={overlayHint}
      />
      <StorageSettingsCard
        embedded={embedded}
        isLast={isLast}
        storageRootPath={storageRootPath || t('storage.default_path', '应用沙盒')}
        onChangeDirectory={showDirectoryActions ? handleChangeDirectory : undefined}
        changeDirectoryLabel={t('storage.change_directory', '更换目录')}
        onMigrateDirectory={showDirectoryActions ? handleMigrateDirectory : undefined}
        migrateDirectoryLabel={t('storage.migrate_directory', '迁移数据目录')}
        onMigrateFromFlutterLegacy={
          showMigrateFromFlutterLegacy ? handleMigrateFromFlutterLegacy : undefined
        }
        onDeleteMigratedLegacySource={
          showDeleteMigratedLegacySource ? handleDeleteMigratedLegacySource : undefined
        }
        allFilesAccessGranted={allFilesAccessGranted}
        onRequestAllFilesAccess={
          Platform.OS === 'android' ? handleRequestAllFilesAccess : undefined
        }
      />
      <DirectoryPickerModal
        visible={pickerVisible}
        fileSystem={fileSystem}
        initialPath={storageRootPath}
        onClose={closeDirectoryPicker}
        onSelect={(path) => handleDirectorySelected(path)}
      />
    </>
  )
}
