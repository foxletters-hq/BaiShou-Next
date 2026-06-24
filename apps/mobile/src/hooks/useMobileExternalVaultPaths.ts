import { useCallback, useEffect, useState } from 'react'
import { Platform } from 'react-native'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useNativeToast, useDialog } from '@baishou/ui/native'
import { useBaishou } from '../providers/BaishouProvider'
import { MobileStoragePathService } from '../services/path.service'
import {
  applyExternalJournalsDirectoryWithResync,
  applyExternalSummariesDirectoryWithResync,
  ExternalPathResyncFailedError,
  getExternalJournalsDirectoryInfo,
  getExternalSummariesDirectoryInfo
} from '../services/mobile-external-vault-paths.service'
import {
  hasStoragePermission,
  requestStoragePermission
} from '../services/storage-permission.service'
import { pickUserDirectory } from '../services/pick-directory.service'

export type ExternalVaultPathPickerTarget = 'journals' | 'summaries'

function displayPath(uri: string): string {
  return uri.replace(/^file:\/\//, '')
}

function mapExternalPathError(
  t: (key: string, options?: Record<string, unknown>) => string,
  code: string,
  kind: ExternalVaultPathPickerTarget
): string {
  switch (code) {
    case 'NOT_DIRECTORY':
      return t(`storage.external_${kind}_not_directory`)
    case 'NOT_ACCESSIBLE':
      return t(`storage.external_${kind}_not_accessible`)
    case 'NOT_WRITABLE':
      return t(`storage.external_${kind}_not_writable`)
    default:
      return code
  }
}

export function useMobileExternalVaultPaths() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const { services, dbReady, resyncAfterMigration } = useBaishou()

  const [externalJournalsPath, setExternalJournalsPath] = useState<string | null>(null)
  const [externalJournalsDefaultPath, setExternalJournalsDefaultPath] = useState('')
  const [externalJournalsFileCount, setExternalJournalsFileCount] = useState(0)
  const [externalJournalsPathAvailable, setExternalJournalsPathAvailable] = useState(true)
  const [externalSummariesPath, setExternalSummariesPath] = useState<string | null>(null)
  const [externalSummariesDefaultPath, setExternalSummariesDefaultPath] = useState('')
  const [externalSummariesFileCount, setExternalSummariesFileCount] = useState(0)
  const [externalSummariesFileCounts, setExternalSummariesFileCounts] = useState<
    | {
        weekly: number
        monthly: number
        quarterly: number
        yearly: number
      }
    | undefined
  >(undefined)
  const [externalSummariesPathAvailable, setExternalSummariesPathAvailable] = useState(true)
  const [pickerVisible, setPickerVisible] = useState(false)
  const [pickerTarget, setPickerTarget] = useState<ExternalVaultPathPickerTarget | null>(null)
  const [busy, setBusy] = useState(false)

  const refreshExternalPathsInfo = useCallback(async () => {
    if (!services?.pathService || !services.fileSystem) return
    const pathService = services.pathService as MobileStoragePathService
    try {
      const [journals, summaries] = await Promise.all([
        getExternalJournalsDirectoryInfo(pathService, services.fileSystem),
        getExternalSummariesDirectoryInfo(pathService, services.fileSystem)
      ])
      setExternalJournalsPath(journals.path)
      setExternalJournalsDefaultPath(displayPath(journals.defaultPath))
      setExternalJournalsFileCount(journals.journalFileCount)
      setExternalJournalsPathAvailable(journals.pathAvailableOnDevice)
      setExternalSummariesPath(summaries.path)
      setExternalSummariesDefaultPath(displayPath(summaries.defaultPath))
      setExternalSummariesFileCount(summaries.summaryFileCount)
      setExternalSummariesFileCounts(summaries.summaryFileCounts)
      setExternalSummariesPathAvailable(summaries.pathAvailableOnDevice)
    } catch (e) {
      console.warn('[useMobileExternalVaultPaths] refresh failed', e)
    }
  }, [services])

  useEffect(() => {
    if (!dbReady || !services) return
    void refreshExternalPathsInfo()
  }, [dbReady, services, refreshExternalPathsInfo])

  useFocusEffect(
    useCallback(() => {
      void refreshExternalPathsInfo()
    }, [refreshExternalPathsInfo])
  )

  const ensureAndroidPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true
    if (await hasStoragePermission()) return true
    await requestStoragePermission()
    toast.showWarning(t('storage.all_files_access_settings_hint'))
    return false
  }, [t, toast])

  const ensureServicesReady = useCallback(async (): Promise<boolean> => {
    if (!services?.pathService || !services.fileSystem) {
      toast.showError(t('storage.service_unavailable', '路径服务未就绪'))
      return false
    }
    return ensureAndroidPermission()
  }, [ensureAndroidPermission, services, t, toast])

  const closeDirectoryPicker = useCallback(() => {
    setPickerVisible(false)
    setPickerTarget(null)
  }, [])

  const applyPickedPath = useCallback(
    async (target: ExternalVaultPathPickerTarget, targetPath: string) => {
      if (!services?.pathService || !services.fileSystem) return
      const pathService = services.pathService as MobileStoragePathService

      const confirmKey =
        target === 'journals'
          ? 'storage.external_journals_confirm'
          : 'storage.external_summaries_confirm'
      const confirmTitle =
        target === 'journals'
          ? t('storage.external_journals_pick', '选择日记目录')
          : t('storage.external_summaries_pick', '选择总结目录')
      const confirmed = await dialog.confirm(t(confirmKey), {
        title: confirmTitle,
        confirmText: t('common.confirm', '确定')
      })
      if (!confirmed) return

      setBusy(true)
      try {
        const count =
          target === 'journals'
            ? await applyExternalJournalsDirectoryWithResync(
                pathService,
                services.fileSystem,
                targetPath,
                resyncAfterMigration
              )
            : await applyExternalSummariesDirectoryWithResync(
                pathService,
                services.fileSystem,
                targetPath,
                resyncAfterMigration
              )

        await refreshExternalPathsInfo()

        const successKey =
          target === 'journals'
            ? 'storage.external_journals_applied'
            : 'storage.external_summaries_applied'
        toast.showSuccess(
          t(successKey, {
            count,
            defaultValue:
              target === 'journals'
                ? `已切换外部日记目录，识别到 ${count} 篇日记`
                : `已切换外部总结目录，识别到 ${count} 篇总结`
          })
        )
      } catch (e: unknown) {
        if (e instanceof ExternalPathResyncFailedError) {
          await refreshExternalPathsInfo()
          toast.showError(
            e.rolledBack
              ? t('storage.external_path_resync_failed_rolled_back', {
                  error: e.message,
                  defaultValue: `同步失败，已恢复先前配置：${e.message}`
                })
              : t('storage.external_path_resync_failed', {
                  error: e.message,
                  defaultValue: `同步失败且未能恢复先前配置：${e.message}`
                })
          )
          return
        }
        const code = e instanceof Error ? e.message : String(e)
        toast.showError(mapExternalPathError(t, code, target))
      } finally {
        setBusy(false)
      }
    },
    [dialog, refreshExternalPathsInfo, resyncAfterMigration, services, t, toast]
  )

  const clearExternalPath = useCallback(
    async (target: ExternalVaultPathPickerTarget) => {
      if (!services?.pathService || !services.fileSystem) return

      const confirmKey =
        target === 'journals'
          ? 'storage.external_journals_clear_confirm'
          : 'storage.external_summaries_clear_confirm'
      const confirmed = await dialog.confirm(t(confirmKey), {
        title:
          target === 'journals'
            ? t('storage.external_journals_clear', '恢复默认目录')
            : t('storage.external_summaries_clear', '恢复默认目录'),
        confirmText: t('common.confirm', '确定')
      })
      if (!confirmed) return

      setBusy(true)
      const pathService = services.pathService as MobileStoragePathService

      try {
        if (target === 'journals') {
          await applyExternalJournalsDirectoryWithResync(
            pathService,
            services.fileSystem,
            null,
            resyncAfterMigration
          )
        } else {
          await applyExternalSummariesDirectoryWithResync(
            pathService,
            services.fileSystem,
            null,
            resyncAfterMigration
          )
        }

        await refreshExternalPathsInfo()
        toast.showSuccess(
          t(
            target === 'journals'
              ? 'storage.external_journals_cleared'
              : 'storage.external_summaries_cleared'
          )
        )
      } catch (e: unknown) {
        if (e instanceof ExternalPathResyncFailedError) {
          await refreshExternalPathsInfo()
          toast.showError(
            e.rolledBack
              ? t('storage.external_path_resync_failed_rolled_back', {
                  error: e.message,
                  defaultValue: `同步失败，已恢复先前配置：${e.message}`
                })
              : t('storage.external_path_resync_failed', {
                  error: e.message,
                  defaultValue: `同步失败且未能恢复先前配置：${e.message}`
                })
          )
          return
        }
        const message = e instanceof Error ? e.message : String(e)
        toast.showError(
          t(`storage.external_${target}_clear_failed`, {
            error: message,
            defaultValue: `恢复失败：${message}`
          })
        )
      } finally {
        setBusy(false)
      }
    },
    [dialog, refreshExternalPathsInfo, resyncAfterMigration, services, t, toast]
  )

  const handleDirectorySelected = useCallback(
    (targetPath: string) => {
      const target = pickerTarget
      closeDirectoryPicker()
      if (!target) return
      void applyPickedPath(target, targetPath)
    },
    [applyPickedPath, closeDirectoryPicker, pickerTarget]
  )

  const openDirectoryPicker = useCallback(
    async (target: ExternalVaultPathPickerTarget) => {
      if (!(await ensureServicesReady())) return

      const nativePick = await pickUserDirectory()
      if (nativePick.status === 'selected') {
        void applyPickedPath(target, nativePick.path)
        return
      }
      if (nativePick.status === 'canceled') return

      setPickerTarget(target)
      setPickerVisible(true)
    },
    [applyPickedPath, ensureServicesReady]
  )

  const handleChangeExternalJournalsDirectory = useCallback(async () => {
    await openDirectoryPicker('journals')
  }, [openDirectoryPicker])

  const handleChangeExternalSummariesDirectory = useCallback(async () => {
    await openDirectoryPicker('summaries')
  }, [openDirectoryPicker])

  const handleClearExternalJournalsDirectory = useCallback(async () => {
    await clearExternalPath('journals')
  }, [clearExternalPath])

  const handleClearExternalSummariesDirectory = useCallback(async () => {
    await clearExternalPath('summaries')
  }, [clearExternalPath])

  const pickerInitialPath =
    pickerTarget === 'summaries'
      ? (externalSummariesPath ?? externalSummariesDefaultPath)
      : (externalJournalsPath ?? externalJournalsDefaultPath)

  return {
    externalJournalsPath: externalJournalsPath ? displayPath(externalJournalsPath) : null,
    externalJournalsDefaultPath,
    externalJournalsFileCount,
    externalJournalsPathAvailable,
    externalSummariesPath: externalSummariesPath ? displayPath(externalSummariesPath) : null,
    externalSummariesDefaultPath,
    externalSummariesFileCount,
    externalSummariesFileCounts,
    externalSummariesPathAvailable,
    externalPathsBusy: busy,
    externalPickerVisible: pickerVisible,
    externalPickerInitialPath: pickerInitialPath,
    closeExternalDirectoryPicker: closeDirectoryPicker,
    handleExternalDirectorySelected: handleDirectorySelected,
    handleChangeExternalJournalsDirectory,
    handleClearExternalJournalsDirectory,
    handleChangeExternalSummariesDirectory,
    handleClearExternalSummariesDirectory,
    showExternalPathActions: Platform.OS === 'android',
    fileSystem: services?.fileSystem ?? null
  }
}
