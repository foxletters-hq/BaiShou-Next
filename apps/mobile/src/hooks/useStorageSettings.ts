import { useCallback, useEffect, useState } from 'react'
import { InteractionManager, Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import {
  EXTERNAL_STORAGE_ROOT,
  hasStoragePermission,
  isExternalStorageRequiredError,
  requestStoragePermission
} from '../services/storage-permission.service'
import { MobileStoragePathService } from '../services/path.service'
import {
  copyStorageRootContents,
  isPathInsideRoot,
  isSameStorageRoot,
  targetDirectoryHasData,
  validateStorageDirectoryWritable
} from '../services/storage-migration.service'
import { toFileUri } from '../services/android-external-fs'
import { pickUserDirectory } from '../services/pick-directory.service'

function displayPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
}

const OVERLAY_DISMISS_MS = 400
const MIGRATION_PROGRESS_THROTTLE_MS = 250

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export type StorageBusyState = 'idle' | 'migrating' | 'switching'
export type DirectoryPickerPurpose = 'change' | 'migrate'

export function useStorageSettings() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady, retryStorageSetup, runWithStorageQuiesced } = useBaishou()

  const [storageRootPath, setStorageRootPath] = useState('...')
  const [allFilesAccessGranted, setAllFilesAccessGranted] = useState<boolean | undefined>(
    Platform.OS === 'android' ? undefined : true
  )
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerPurpose, setPickerPurpose] = useState<DirectoryPickerPurpose | null>(null)
  const [storageBusy, setStorageBusy] = useState<StorageBusyState>('idle')
  const [migrationProgress, setMigrationProgress] = useState('')

  const refreshStorageInfo = useCallback(async () => {
    if (!services?.pathService) return
    try {
      const root = await services.pathService.getRootDirectory()
      setStorageRootPath(displayPath(root))

      if (Platform.OS === 'android') {
        const granted = await hasStoragePermission()
        setAllFilesAccessGranted(granted)
      }
    } catch (e) {
      if (isExternalStorageRequiredError(e)) {
        setStorageRootPath(displayPath(EXTERNAL_STORAGE_ROOT))
        setAllFilesAccessGranted(false)
        return
      }
      console.warn('Load storage root failed', e)
    }
  }, [services])

  useEffect(() => {
    if (!dbReady || !services) return
    void refreshStorageInfo()
  }, [dbReady, services, refreshStorageInfo])

  useFocusEffect(
    useCallback(() => {
      void refreshStorageInfo()
    }, [refreshStorageInfo])
  )

  const ensureStoragePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true
    if (await hasStoragePermission()) {
      setAllFilesAccessGranted(true)
      return true
    }
    await requestStoragePermission()
    toast.showWarning(t('storage.all_files_access_settings_hint'))
    return false
  }, [t, toast])

  const handleRequestAllFilesAccess = useCallback(async () => {
    const alreadyGranted = await hasStoragePermission()
    if (alreadyGranted) {
      setAllFilesAccessGranted(true)
      toast.showToast(t('common.permission.storage_granted', '权限已获得'), 'success')
      await refreshStorageInfo()
      return
    }
    await requestStoragePermission()
    toast.showWarning(t('storage.all_files_access_settings_hint'))
  }, [refreshStorageInfo, t, toast])

  const ensureServicesReady = useCallback(async (): Promise<boolean> => {
    if (!services?.pathService || !services.fileSystem) {
      toast.showError(t('storage.service_unavailable', '路径服务未就绪'))
      return false
    }
    if (Platform.OS === 'android' && !(await hasStoragePermission())) {
      const ok = await ensureStoragePermission()
      if (!ok) return false
    }
    return true
  }, [ensureStoragePermission, services, t, toast])

  const closeDirectoryPicker = useCallback(() => {
    setPickerVisible(false)
    setPickerPurpose(null)
  }, [])

  const validateTargetPath = useCallback(
    async (targetPath: string): Promise<string | null> => {
      if (!services?.pathService) return null

      const pathService = services.pathService as MobileStoragePathService
      let sourceRoot: string
      try {
        sourceRoot = await pathService.getRootDirectory()
      } catch {
        toast.showError(t('storage.service_unavailable', '路径服务未就绪'))
        return null
      }

      if (isSameStorageRoot(sourceRoot, targetPath)) {
        toast.showWarning(t('storage.migrate_same_path', '目标目录与当前数据根目录相同'))
        return null
      }
      if (isPathInsideRoot(targetPath, sourceRoot)) {
        toast.showWarning(t('storage.migrate_inside_source', '不能选择当前数据目录内的子文件夹'))
        return null
      }

      const writable = await validateStorageDirectoryWritable(services.fileSystem, targetPath)
      if (!writable) {
        toast.showError(
          t('storage.directory_not_writable', '无法写入所选目录，请检查权限或更换路径')
        )
        return null
      }

      return sourceRoot
    },
    [services, t, toast]
  )

  const switchToDirectory = useCallback(
    async (targetPath: string): Promise<boolean> => {
      if (!services?.pathService) return false

      const pathService = services.pathService as MobileStoragePathService
      setStorageBusy('switching')
      try {
        await pathService.updateRootDirectory(toFileUri(targetPath))
        const reloaded = await retryStorageSetup()
        if (reloaded) {
          await refreshStorageInfo()
          return true
        }
        toast.showWarning(
          t('storage.migrate_switch_failed', '目录已更新，但重新加载失败，请重启应用')
        )
        return false
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        toast.showError(
          t('storage.change_directory_failed', {
            error: message,
            defaultValue: `更换目录失败：${message}`
          })
        )
        return false
      } finally {
        setStorageBusy('idle')
      }
    },
    [refreshStorageInfo, retryStorageSetup, services, t, toast]
  )

  const applyChangeDirectory = useCallback(
    async (targetPath: string) => {
      if (!services?.fileSystem) return
      const sourceRoot = await validateTargetPath(targetPath)
      if (!sourceRoot) return

      const hasData = await targetDirectoryHasData(services.fileSystem, targetPath)
      if (!hasData) {
        const proceed = await dialog.confirm(t('storage.change_directory_empty_warning'), {
          title: t('storage.change_directory', '更换目录'),
          confirmText: t('common.confirm', '确定')
        })
        if (!proceed) return
      }

      const confirmed = await dialog.confirm(t('storage.change_directory_confirm'), {
        title: t('storage.change_directory', '更换目录'),
        confirmText: t('storage.change_directory_confirm_action', '更换并重新加载')
      })
      if (!confirmed) return

      const ok = await switchToDirectory(targetPath)
      if (ok) {
        toast.showSuccess(t('storage.change_directory_success', '已更换数据目录并重新加载'))
      }
    },
    [dialog, services, switchToDirectory, t, toast, validateTargetPath]
  )

  const applyMigrateDirectory = useCallback(
    async (targetPath: string) => {
      if (!services?.fileSystem) return
      const sourceRoot = await validateTargetPath(targetPath)
      if (!sourceRoot) return

      const hasData = await targetDirectoryHasData(services.fileSystem, targetPath)
      if (hasData) {
        const proceed = await dialog.confirm(t('storage.migrate_target_not_empty'), {
          title: t('storage.migrate_directory', '迁移数据目录'),
          confirmText: t('common.confirm', '确定'),
          destructive: true
        })
        if (!proceed) return
      }

      const confirmed = await dialog.confirm(t('storage.migrate_confirm'), {
        title: t('storage.migrate_directory', '迁移数据目录'),
        confirmText: t('common.confirm', '确定')
      })
      if (!confirmed) return

      setStorageBusy('migrating')
      setMigrationProgress('')
      let lastProgressAt = 0
      try {
        await runWithStorageQuiesced(() =>
          copyStorageRootContents(services.fileSystem, sourceRoot, targetPath, (itemName) => {
            const now = Date.now()
            if (now - lastProgressAt < MIGRATION_PROGRESS_THROTTLE_MS) return
            lastProgressAt = now
            setMigrationProgress(itemName)
          })
        )
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e)
        toast.showError(
          t('storage.migrate_failed', { error: message, defaultValue: `迁移失败：${message}` })
        )
        return
      } finally {
        setStorageBusy('idle')
        setMigrationProgress('')
      }

      await waitMs(OVERLAY_DISMISS_MS)
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve())
      })

      const switchNow = await dialog.confirm(t('storage.migrate_switch_prompt'), {
        title: t('storage.migrate_complete', '迁移完成'),
        confirmText: t('storage.migrate_switch_confirm', '切换并重新加载'),
        cancelText: t('storage.migrate_keep_current', '暂不切换')
      })

      if (switchNow) {
        const ok = await switchToDirectory(targetPath)
        if (ok) {
          toast.showSuccess(t('storage.migrate_switched', '已切换到新目录并重新加载'))
        }
      } else {
        toast.showInfo(t('storage.migrate_kept_source', '原目录数据已保留，未切换根目录'))
      }
    },
    [dialog, runWithStorageQuiesced, services, switchToDirectory, t, toast, validateTargetPath]
  )

  const handleDirectorySelected = useCallback(
    (targetPath: string) => {
      const purpose = pickerPurpose
      closeDirectoryPicker()
      if (purpose === 'change') {
        void applyChangeDirectory(targetPath)
      } else if (purpose === 'migrate') {
        void applyMigrateDirectory(targetPath)
      }
    },
    [applyChangeDirectory, applyMigrateDirectory, closeDirectoryPicker, pickerPurpose]
  )

  const openDirectoryPicker = useCallback(
    async (purpose: DirectoryPickerPurpose) => {
      if (!(await ensureServicesReady())) return

      const nativePick = await pickUserDirectory()
      if (nativePick.status === 'selected') {
        if (purpose === 'change') {
          void applyChangeDirectory(nativePick.path)
        } else {
          void applyMigrateDirectory(nativePick.path)
        }
        return
      }
      if (nativePick.status === 'canceled') return

      setPickerPurpose(purpose)
      setPickerVisible(true)
    },
    [applyChangeDirectory, applyMigrateDirectory, ensureServicesReady]
  )

  const handleChangeDirectory = useCallback(async () => {
    await openDirectoryPicker('change')
  }, [openDirectoryPicker])

  const handleMigrateDirectory = useCallback(async () => {
    await openDirectoryPicker('migrate')
  }, [openDirectoryPicker])

  return {
    storageRootPath,
    allFilesAccessGranted,
    pickerVisible,
    closeDirectoryPicker,
    storageBusy,
    migrationProgress,
    refreshStorageInfo,
    handleRequestAllFilesAccess,
    handleChangeDirectory,
    handleMigrateDirectory,
    handleDirectorySelected,
    showDirectoryActions: Platform.OS === 'android',
    fileSystem: services?.fileSystem ?? null
  }
}
