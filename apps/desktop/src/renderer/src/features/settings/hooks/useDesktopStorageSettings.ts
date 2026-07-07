import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDialog, useToast } from '@baishou/ui'
import {
  getStorageApi,
  mapValidationError,
  waitMs,
  OVERLAY_DISMISS_MS,
  type StorageBusyState,
  type StorageTargetValidation
} from './desktop-storage-settings.api'
import { useDesktopStorageExternalPaths } from './useDesktopStorageExternalPaths'

export function useDesktopStorageSettings() {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [storageRootPath, setStorageRootPath] = useState('...')
  const [sqliteSizeStats, setSqliteSizeStats] = useState('0 MB')
  const [vectorDbStats, setVectorDbStats] = useState('0 MB')
  const [mediaCacheStats, setMediaCacheStats] = useState('0 MB')
  const [externalJournalsPath, setExternalJournalsPath] = useState<string | null>(null)
  const [externalJournalsDefaultPath, setExternalJournalsDefaultPath] = useState('')
  const [externalJournalsFileCount, setExternalJournalsFileCount] = useState<number | undefined>(
    undefined
  )
  const [externalJournalsPathAvailable, setExternalJournalsPathAvailable] = useState(true)
  const [externalSummariesPath, setExternalSummariesPath] = useState<string | null>(null)
  const [externalSummariesDefaultPath, setExternalSummariesDefaultPath] = useState('')
  const [externalSummariesFileCount, setExternalSummariesFileCount] = useState<number | undefined>(
    undefined
  )
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
  const [storageBusy, setStorageBusy] = useState<StorageBusyState>('idle')
  const [migrationProgress, setMigrationProgress] = useState('')
  const suppressExternalPathRefreshRef = useRef(false)

  const refreshStorageInfo = useCallback(async (options?: { includeFileCounts?: boolean }) => {
    const includeFileCounts = options?.includeFileCounts === true
    try {
      const stats = await getStorageApi()?.getStats?.()
      if (stats?.storageRootPath) {
        setStorageRootPath(stats.storageRootPath)
      }
      if (stats?.sqliteSizeStats) {
        setSqliteSizeStats(stats.sqliteSizeStats)
      }
      if (stats?.vectorDbStats) {
        setVectorDbStats(stats.vectorDbStats)
      }
      if (stats?.mediaCacheStats) {
        setMediaCacheStats(stats.mediaCacheStats)
      }
      const journalsInfo = await getStorageApi()?.getExternalJournalsInfo?.({
        includeFileCounts
      })
      if (journalsInfo) {
        setExternalJournalsPath(journalsInfo.path)
        setExternalJournalsDefaultPath(journalsInfo.defaultPath)
        if (includeFileCounts) {
          setExternalJournalsFileCount(journalsInfo.journalFileCount)
        }
        setExternalJournalsPathAvailable(journalsInfo.pathAvailableOnDevice ?? true)
      }
      const summariesInfo = await getStorageApi()?.getExternalSummariesInfo?.({
        includeFileCounts
      })
      if (summariesInfo) {
        setExternalSummariesPath(summariesInfo.path)
        setExternalSummariesDefaultPath(summariesInfo.defaultPath)
        if (includeFileCounts) {
          setExternalSummariesFileCount(summariesInfo.summaryFileCount)
          setExternalSummariesFileCounts(summariesInfo.summaryFileCounts)
        }
        setExternalSummariesPathAvailable(summariesInfo.pathAvailableOnDevice ?? true)
      }
    } catch (e) {
      console.warn('Load storage root failed', e)
    }
  }, [])

  useEffect(() => {
    const runLight = () => {
      void refreshStorageInfo({ includeFileCounts: false })
    }

    let heavyTimer: number | undefined
    const scheduleHeavy = () => {
      heavyTimer = window.setTimeout(() => {
        void refreshStorageInfo({ includeFileCounts: true })
      }, 800)
    }

    if (typeof requestIdleCallback === 'function') {
      const idleId = requestIdleCallback(
        () => {
          runLight()
          scheduleHeavy()
        },
        { timeout: 2500 }
      )
      return () => {
        cancelIdleCallback(idleId)
        if (heavyTimer) window.clearTimeout(heavyTimer)
      }
    }

    const lightTimer = window.setTimeout(() => {
      runLight()
      scheduleHeavy()
    }, 400)
    return () => {
      window.clearTimeout(lightTimer)
      if (heavyTimer) window.clearTimeout(heavyTimer)
    }
  }, [refreshStorageInfo])

  useEffect(() => {
    const api = getStorageApi()
    const unsubs: Array<() => void> = []
    if (api?.onMigrationProgress) {
      unsubs.push(
        api.onMigrationProgress((payload) => {
          setMigrationProgress(payload.name)
        })
      )
    }
    if (api?.onRootChanged) {
      unsubs.push(
        api.onRootChanged(() => {
          void refreshStorageInfo({ includeFileCounts: true })
        })
      )
    }
    if (api?.onJournalsPathChanged) {
      unsubs.push(
        api.onJournalsPathChanged(() => {
          if (suppressExternalPathRefreshRef.current) return
          void refreshStorageInfo({ includeFileCounts: true })
        })
      )
    }
    if (api?.onSummariesPathChanged) {
      unsubs.push(
        api.onSummariesPathChanged(() => {
          if (suppressExternalPathRefreshRef.current) return
          void refreshStorageInfo({ includeFileCounts: true })
        })
      )
    }
    return () => {
      unsubs.forEach((u) => u())
    }
  }, [refreshStorageInfo])

  const pickDirectory = useCallback(async (): Promise<string | null> => {
    const path = await getStorageApi()?.pickDirectory?.()
    return path ?? null
  }, [])

  const validateTarget = useCallback(
    async (targetPath: string): Promise<StorageTargetValidation | null> => {
      return (await getStorageApi()?.validateTargetDirectory?.(targetPath)) ?? null
    },
    []
  )

  const switchToDirectory = useCallback(
    async (targetPath: string): Promise<boolean> => {
      setStorageBusy('switching')
      try {
        await getStorageApi()?.changeDirectory?.(targetPath)
        await (window as any).api?.vault?.waitForResync?.()
        await refreshStorageInfo({ includeFileCounts: true })
        return true
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
    [refreshStorageInfo, t, toast]
  )

  const applyChangeDirectory = useCallback(
    async (targetPath: string) => {
      const validation = await validateTarget(targetPath)
      if (!validation) {
        toast.showError(t('storage.service_unavailable', '路径服务未就绪'))
        return
      }
      if (validation.valid === false) {
        toast.showWarning(mapValidationError(t, validation.code))
        return
      }

      if (!validation.hasData) {
        const proceed = await dialog.confirm(
          t('storage.change_directory_empty_warning'),
          t('storage.change_directory', '更换目录')
        )
        if (!proceed) return
      }

      const confirmed = await dialog.confirm(
        t('storage.change_directory_confirm'),
        t('storage.change_directory_confirm_action', '更换并重新加载')
      )
      if (!confirmed) return

      const ok = await switchToDirectory(targetPath)
      if (ok) {
        toast.showSuccess(t('storage.change_directory_success', '已更换数据目录并重新加载'))
      }
    },
    [dialog, switchToDirectory, t, toast, validateTarget]
  )

  const applyMigrateDirectory = useCallback(
    async (targetPath: string) => {
      const validation = await validateTarget(targetPath)
      if (!validation) {
        toast.showError(t('storage.service_unavailable', '路径服务未就绪'))
        return
      }
      if (validation.valid === false) {
        toast.showWarning(mapValidationError(t, validation.code))
        return
      }

      if (validation.hasData) {
        const proceed = await dialog.confirm(
          t('storage.migrate_target_not_empty'),
          t('storage.migrate_directory', '迁移数据目录')
        )
        if (!proceed) return
      }

      const confirmed = await dialog.confirm(
        t('storage.migrate_confirm'),
        t('storage.migrate_directory', '迁移数据目录')
      )
      if (!confirmed) return

      setStorageBusy('migrating')
      setMigrationProgress('')
      try {
        await getStorageApi()?.migrateDirectory?.(targetPath)
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

      const switchNow = await dialog.confirm(
        t('storage.migrate_switch_prompt'),
        t('storage.migrate_complete', '迁移完成')
      )

      if (switchNow) {
        const ok = await switchToDirectory(targetPath)
        if (ok) {
          toast.showSuccess(t('storage.migrate_switched', '已切换到新目录并重新加载'))
        }
      } else {
        toast.showWarning(t('storage.migrate_kept_source', '原目录数据已保留，未切换根目录'))
      }
    },
    [dialog, switchToDirectory, t, toast, validateTarget]
  )

  const openDirectoryPicker = useCallback(
    async (purpose: 'change' | 'migrate') => {
      const targetPath = await pickDirectory()
      if (!targetPath) return
      if (purpose === 'change') {
        await applyChangeDirectory(targetPath)
      } else {
        await applyMigrateDirectory(targetPath)
      }
    },
    [applyChangeDirectory, applyMigrateDirectory, pickDirectory]
  )

  const handleChangeDirectory = useCallback(async () => {
    await openDirectoryPicker('change')
  }, [openDirectoryPicker])

  const handleMigrateDirectory = useCallback(async () => {
    await openDirectoryPicker('migrate')
  }, [openDirectoryPicker])

  const {
    handleChangeExternalJournalsDirectory,
    handleClearExternalJournalsDirectory,
    handleChangeExternalSummariesDirectory,
    handleClearExternalSummariesDirectory
  } = useDesktopStorageExternalPaths({
    t,
    dialog,
    toast,
    refreshStorageInfo,
    setStorageBusy,
    suppressExternalPathRefreshRef,
    setExternalJournalsPath,
    setExternalJournalsPathAvailable,
    setExternalJournalsFileCount,
    setExternalSummariesPath,
    setExternalSummariesPathAvailable,
    setExternalSummariesFileCount,
    setExternalSummariesFileCounts
  })

  const overlayVisible = storageBusy !== 'idle'
  const overlayMessage =
    storageBusy === 'switching'
      ? t('storage.switching_directory', '正在更换目录...')
      : storageBusy === 'external-journals'
        ? t('storage.external_journals_applying', '正在切换外部日记目录...')
        : storageBusy === 'external-summaries'
          ? t('storage.external_summaries_applying', '正在切换外部总结目录...')
          : t('storage.migrating_data', '正在迁移数据...')
  const overlayHint =
    storageBusy === 'switching'
      ? t('storage.switching_directory_hint', '请勿关闭应用')
      : storageBusy === 'external-journals' || storageBusy === 'external-summaries'
        ? t('storage.external_path_applying_hint', '正在扫描所选目录并重建索引，请勿关闭应用')
        : migrationProgress
          ? t('storage.migrating_item', {
              name: migrationProgress,
              defaultValue: `正在复制：${migrationProgress}`
            })
          : t('storage.migrating_data_hint', '请勿关闭应用，原目录数据不会被删除')

  return {
    storageRootPath,
    sqliteSizeStats,
    vectorDbStats,
    mediaCacheStats,
    externalJournalsPath,
    externalJournalsDefaultPath,
    externalJournalsFileCount,
    externalJournalsPathAvailable,
    externalSummariesPath,
    externalSummariesDefaultPath,
    externalSummariesFileCount,
    externalSummariesFileCounts,
    externalSummariesPathAvailable,
    storageBusy,
    overlayVisible,
    overlayMessage,
    overlayHint,
    handleChangeDirectory,
    handleMigrateDirectory,
    handleChangeExternalJournalsDirectory,
    handleClearExternalJournalsDirectory,
    handleChangeExternalSummariesDirectory,
    handleClearExternalSummariesDirectory,
    refreshStorageInfo
  }
}
