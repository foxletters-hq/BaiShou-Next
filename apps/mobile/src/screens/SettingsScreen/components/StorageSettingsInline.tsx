import React from 'react'
import { Platform } from 'react-native'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { StorageSettingsCard, RestoreBlockingOverlay } from '@baishou/ui/native'
import { useStorageSettings } from '../../../hooks/useStorageSettings'
import { useMobileExternalVaultPaths } from '../../../hooks/useMobileExternalVaultPaths'
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
  const router = useRouter()
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
    externalJournalsPath,
    externalJournalsDefaultPath,
    externalJournalsFileCount,
    externalSummariesPath,
    externalSummariesDefaultPath,
    externalSummariesFileCount,
    externalPathsBusy,
    externalPickerVisible,
    externalPickerInitialPath,
    closeExternalDirectoryPicker,
    handleExternalDirectorySelected,
    handleChangeExternalJournalsDirectory,
    handleClearExternalJournalsDirectory,
    handleChangeExternalSummariesDirectory,
    handleClearExternalSummariesDirectory,
    showExternalPathActions
  } = useMobileExternalVaultPaths()

  const { showMigrateFromFlutterLegacy } = useFlutterLegacyMigrationSettings()

  const overlayVisible = storageBusy !== 'idle' || externalPathsBusy
  const overlayMessage =
    storageBusy === 'switching'
      ? t('storage.switching_directory', '正在更换目录...')
      : t('storage.migrating_data', '正在迁移数据...')
  const overlayHint =
    storageBusy === 'switching'
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
          showMigrateFromFlutterLegacy
            ? () => router.push('/settings/version-migration')
            : undefined
        }
        migrateFromFlutterLegacyLabel={t(
          'version_migration.storage_entry_action',
          '按板块从旧版迁移数据'
        )}
        allFilesAccessGranted={allFilesAccessGranted}
        onRequestAllFilesAccess={
          Platform.OS === 'android' ? handleRequestAllFilesAccess : undefined
        }
        externalJournalsPath={externalJournalsPath}
        externalJournalsDefaultPath={externalJournalsDefaultPath}
        externalJournalsFileCount={externalJournalsFileCount}
        externalSummariesPath={externalSummariesPath}
        externalSummariesDefaultPath={externalSummariesDefaultPath}
        externalSummariesFileCount={externalSummariesFileCount}
        onChangeExternalJournalsDirectory={
          showExternalPathActions ? handleChangeExternalJournalsDirectory : undefined
        }
        onClearExternalJournalsDirectory={
          showExternalPathActions ? handleClearExternalJournalsDirectory : undefined
        }
        onChangeExternalSummariesDirectory={
          showExternalPathActions ? handleChangeExternalSummariesDirectory : undefined
        }
        onClearExternalSummariesDirectory={
          showExternalPathActions ? handleClearExternalSummariesDirectory : undefined
        }
      />
      <DirectoryPickerModal
        visible={pickerVisible}
        fileSystem={fileSystem}
        initialPath={storageRootPath}
        onClose={closeDirectoryPicker}
        onSelect={(path) => handleDirectorySelected(path)}
      />
      <DirectoryPickerModal
        visible={externalPickerVisible}
        fileSystem={fileSystem}
        initialPath={externalPickerInitialPath}
        onClose={closeExternalDirectoryPicker}
        onSelect={(path) => handleExternalDirectorySelected(path)}
      />
    </>
  )
}
