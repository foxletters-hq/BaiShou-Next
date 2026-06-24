import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useDialog, useToast } from '@baishou/ui'

type StorageBusyState =
  | 'idle'
  | 'migrating'
  | 'switching'
  | 'external-journals'
  | 'external-summaries'

type StorageTargetValidation =
  | { valid: true; sourceRoot: string; hasData: boolean }
  | { valid: false; code: string }

const OVERLAY_DISMISS_MS = 320

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function getStorageApi() {
  return (window as any).api?.storage as
    | {
        getStats?: () => Promise<{ storageRootPath?: string }>
        pickDirectory?: () => Promise<string | null>
        validateTargetDirectory?: (targetPath: string) => Promise<StorageTargetValidation>
        changeDirectory?: (targetPath: string) => Promise<{ ok: boolean }>
        migrateDirectory?: (targetPath: string) => Promise<{ ok: boolean }>
        onMigrationProgress?: (cb: (payload: { name: string }) => void) => () => void
        onRootChanged?: (cb: () => void) => () => void
        getExternalJournalsInfo?: () => Promise<{
          path: string | null
          defaultPath: string
          journalFileCount: number
          pathAvailableOnDevice?: boolean
        }>
        pickExternalJournalsDirectory?: () => Promise<string | null>
        setExternalJournalsDirectory?: (targetPath: string) => Promise<{
          ok: boolean
          journalFileCount?: number
        }>
        clearExternalJournalsDirectory?: () => Promise<{ ok: boolean }>
        onJournalsPathChanged?: (cb: () => void) => () => void
        getExternalSummariesInfo?: () => Promise<{
          path: string | null
          defaultPath: string
          summaryFileCount: number
          summaryFileCounts?: {
            weekly: number
            monthly: number
            quarterly: number
            yearly: number
          }
          pathAvailableOnDevice?: boolean
        }>
        pickExternalSummariesDirectory?: () => Promise<string | null>
        setExternalSummariesDirectory?: (targetPath: string) => Promise<{
          ok: boolean
          summaryFileCount?: number
          summaryFileCounts?: {
            weekly: number
            monthly: number
            quarterly: number
            yearly: number
          }
        }>
        clearExternalSummariesDirectory?: () => Promise<{ ok: boolean }>
        onSummariesPathChanged?: (cb: () => void) => () => void
      }
    | undefined
}

function mapValidationError(t: TFunction, code: string): string {
  switch (code) {
    case 'SAME_PATH':
      return t('storage.migrate_same_path', '目标目录与当前数据根目录相同')
    case 'INSIDE_SOURCE':
      return t('storage.migrate_inside_source', '不能选择当前数据目录内的子文件夹')
    case 'NOT_WRITABLE':
      return t('storage.directory_not_writable', '无法写入所选目录，请检查权限或更换路径')
    default:
      return t('storage.service_unavailable', '路径服务未就绪')
  }
}

export function useDesktopStorageSettings(onStatsRefresh?: () => Promise<void>) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useToast()
  const [storageRootPath, setStorageRootPath] = useState('...')
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

  const refreshStorageInfo = useCallback(async () => {
    try {
      const stats = await getStorageApi()?.getStats?.()
      if (stats?.storageRootPath) {
        setStorageRootPath(stats.storageRootPath)
      }
      const journalsInfo = await getStorageApi()?.getExternalJournalsInfo?.()
      if (journalsInfo) {
        setExternalJournalsPath(journalsInfo.path)
        setExternalJournalsDefaultPath(journalsInfo.defaultPath)
        setExternalJournalsFileCount(journalsInfo.journalFileCount)
        setExternalJournalsPathAvailable(journalsInfo.pathAvailableOnDevice ?? true)
      }
      const summariesInfo = await getStorageApi()?.getExternalSummariesInfo?.()
      if (summariesInfo) {
        setExternalSummariesPath(summariesInfo.path)
        setExternalSummariesDefaultPath(summariesInfo.defaultPath)
        setExternalSummariesFileCount(summariesInfo.summaryFileCount)
        setExternalSummariesFileCounts(summariesInfo.summaryFileCounts)
        setExternalSummariesPathAvailable(summariesInfo.pathAvailableOnDevice ?? true)
      }
      if (onStatsRefresh) {
        await onStatsRefresh()
      }
    } catch (e) {
      console.warn('Load storage root failed', e)
    }
  }, [onStatsRefresh])

  useEffect(() => {
    void refreshStorageInfo()
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
          void refreshStorageInfo()
        })
      )
    }
    if (api?.onJournalsPathChanged) {
      unsubs.push(
        api.onJournalsPathChanged(() => {
          if (suppressExternalPathRefreshRef.current) return
          void refreshStorageInfo()
        })
      )
    }
    if (api?.onSummariesPathChanged) {
      unsubs.push(
        api.onSummariesPathChanged(() => {
          if (suppressExternalPathRefreshRef.current) return
          void refreshStorageInfo()
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
        await refreshStorageInfo()
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

  const mapExternalDirectoryError = useCallback(
    (code: string, kind: 'journals' | 'summaries'): string => {
      switch (code) {
        case 'NOT_DIRECTORY':
          return kind === 'journals'
            ? t('storage.external_journals_not_directory', '所选路径不是文件夹')
            : t('storage.external_summaries_not_directory', '所选路径不是文件夹')
        case 'NOT_ACCESSIBLE':
          return kind === 'journals'
            ? t('storage.external_journals_not_accessible', '无法访问所选目录')
            : t('storage.external_summaries_not_accessible', '无法访问所选目录')
        case 'NOT_WRITABLE':
          return kind === 'journals'
            ? t('storage.external_journals_not_writable', '所选目录不可写，请检查权限')
            : t('storage.external_summaries_not_writable', '所选目录不可写，请检查权限')
        default:
          return code
      }
    },
    [t]
  )

  const mapExternalJournalsError = useCallback(
    (code: string): string => mapExternalDirectoryError(code, 'journals'),
    [mapExternalDirectoryError]
  )

  const mapExternalSummariesError = useCallback(
    (code: string): string => mapExternalDirectoryError(code, 'summaries'),
    [mapExternalDirectoryError]
  )

  const handleChangeExternalJournalsDirectory = useCallback(async () => {
    const api = getStorageApi()
    const picked = await api?.pickExternalJournalsDirectory?.()
    if (!picked) return

    const confirmed = await dialog.confirm(
      t(
        'storage.external_journals_confirm',
        '将把当前工作区的日记读写指向所选文件夹（不会移动或删除原文件）。是否继续？'
      ),
      t('storage.external_journals_pick', '选择日记目录')
    )
    if (!confirmed) return

    setStorageBusy('external-journals')
    suppressExternalPathRefreshRef.current = true
    try {
      const result = await api?.setExternalJournalsDirectory?.(picked)
      setExternalJournalsPath(picked)
      setExternalJournalsPathAvailable(true)
      if (typeof result?.journalFileCount === 'number') {
        setExternalJournalsFileCount(result.journalFileCount)
      }
      await refreshStorageInfo()
      const count = result?.journalFileCount
      toast.showSuccess(
        t('storage.external_journals_applied', {
          count: count ?? 0,
          defaultValue: `已切换外部日记目录，识别到 ${count ?? 0} 篇日记`
        })
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(mapExternalJournalsError(message))
    } finally {
      suppressExternalPathRefreshRef.current = false
      setStorageBusy('idle')
    }
  }, [dialog, mapExternalJournalsError, refreshStorageInfo, t, toast])

  const handleChangeExternalSummariesDirectory = useCallback(async () => {
    const api = getStorageApi()
    const picked = await api?.pickExternalSummariesDirectory?.()
    if (!picked) return

    const confirmed = await dialog.confirm(
      t(
        'storage.external_summaries_confirm',
        '将把当前工作区的总结读写指向所选文件夹（不会移动或删除原文件）。是否继续？'
      ),
      t('storage.external_summaries_pick', '选择总结目录')
    )
    if (!confirmed) return

    setStorageBusy('external-summaries')
    suppressExternalPathRefreshRef.current = true
    try {
      const result = await api?.setExternalSummariesDirectory?.(picked)
      setExternalSummariesPath(picked)
      setExternalSummariesPathAvailable(true)
      if (typeof result?.summaryFileCount === 'number') {
        setExternalSummariesFileCount(result.summaryFileCount)
      }
      if (result?.summaryFileCounts) {
        setExternalSummariesFileCounts(result.summaryFileCounts)
      }
      await refreshStorageInfo()
      const count = result?.summaryFileCount
      toast.showSuccess(
        t('storage.external_summaries_applied', {
          count: count ?? 0,
          defaultValue: `已切换外部总结目录，识别到 ${count ?? 0} 篇总结`
        })
      )
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(mapExternalSummariesError(message))
    } finally {
      suppressExternalPathRefreshRef.current = false
      setStorageBusy('idle')
    }
  }, [dialog, mapExternalSummariesError, refreshStorageInfo, t, toast])

  const handleClearExternalSummariesDirectory = useCallback(async () => {
    const confirmed = await dialog.confirm(
      t(
        'storage.external_summaries_clear_confirm',
        '将恢复为工作区内的 Archives 目录。外部文件夹中的文件不会被删除。'
      ),
      t('storage.external_summaries_clear', '恢复默认目录')
    )
    if (!confirmed) return

    setStorageBusy('external-summaries')
    suppressExternalPathRefreshRef.current = true
    try {
      await getStorageApi()?.clearExternalSummariesDirectory?.()
      setExternalSummariesPath(null)
      setExternalSummariesPathAvailable(true)
      await refreshStorageInfo()
      toast.showSuccess(t('storage.external_summaries_cleared', '已恢复默认总结目录'))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(
        t('storage.external_summaries_clear_failed', {
          error: message,
          defaultValue: `恢复失败：${message}`
        })
      )
    } finally {
      suppressExternalPathRefreshRef.current = false
      setStorageBusy('idle')
    }
  }, [dialog, refreshStorageInfo, t, toast])

  const handleClearExternalJournalsDirectory = useCallback(async () => {
    const confirmed = await dialog.confirm(
      t(
        'storage.external_journals_clear_confirm',
        '将恢复为工作区内的 Journals 目录。外部文件夹中的文件不会被删除。'
      ),
      t('storage.external_journals_clear', '恢复默认目录')
    )
    if (!confirmed) return

    setStorageBusy('external-journals')
    suppressExternalPathRefreshRef.current = true
    try {
      await getStorageApi()?.clearExternalJournalsDirectory?.()
      setExternalJournalsPath(null)
      setExternalJournalsPathAvailable(true)
      await refreshStorageInfo()
      toast.showSuccess(t('storage.external_journals_cleared', '已恢复默认日记目录'))
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      toast.showError(
        t('storage.external_journals_clear_failed', {
          error: message,
          defaultValue: `恢复失败：${message}`
        })
      )
    } finally {
      suppressExternalPathRefreshRef.current = false
      setStorageBusy('idle')
    }
  }, [dialog, refreshStorageInfo, t, toast])

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
