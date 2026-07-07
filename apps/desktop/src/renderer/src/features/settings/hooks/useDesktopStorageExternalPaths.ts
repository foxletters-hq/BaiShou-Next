import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import type { useDialog, useToast } from '@baishou/ui'
import { getStorageApi, type StorageBusyState } from './desktop-storage-settings.api'

type DialogApi = ReturnType<typeof useDialog>
type ToastApi = ReturnType<typeof useToast>

export interface ExternalPathsHookParams {
  t: TFunction
  dialog: DialogApi
  toast: ToastApi
  refreshStorageInfo: (options?: { includeFileCounts?: boolean }) => Promise<void>
  setStorageBusy: React.Dispatch<React.SetStateAction<StorageBusyState>>
  suppressExternalPathRefreshRef: React.MutableRefObject<boolean>
  setExternalJournalsPath: React.Dispatch<React.SetStateAction<string | null>>
  setExternalJournalsPathAvailable: React.Dispatch<React.SetStateAction<boolean>>
  setExternalJournalsFileCount: React.Dispatch<React.SetStateAction<number | undefined>>
  setExternalSummariesPath: React.Dispatch<React.SetStateAction<string | null>>
  setExternalSummariesPathAvailable: React.Dispatch<React.SetStateAction<boolean>>
  setExternalSummariesFileCount: React.Dispatch<React.SetStateAction<number | undefined>>
  setExternalSummariesFileCounts: React.Dispatch<
    React.SetStateAction<
      | {
          weekly: number
          monthly: number
          quarterly: number
          yearly: number
        }
      | undefined
    >
  >
}

export function useDesktopStorageExternalPaths(params: ExternalPathsHookParams) {
  const {
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
  } = params

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
      await refreshStorageInfo({ includeFileCounts: true })
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
  }, [
    dialog,
    mapExternalJournalsError,
    refreshStorageInfo,
    setExternalJournalsFileCount,
    setExternalJournalsPath,
    setExternalJournalsPathAvailable,
    setStorageBusy,
    suppressExternalPathRefreshRef,
    t,
    toast
  ])

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
      await refreshStorageInfo({ includeFileCounts: true })
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
  }, [
    dialog,
    mapExternalSummariesError,
    refreshStorageInfo,
    setExternalSummariesFileCount,
    setExternalSummariesFileCounts,
    setExternalSummariesPath,
    setExternalSummariesPathAvailable,
    setStorageBusy,
    suppressExternalPathRefreshRef,
    t,
    toast
  ])

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
      await refreshStorageInfo({ includeFileCounts: true })
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
  }, [
    dialog,
    refreshStorageInfo,
    setExternalSummariesPath,
    setExternalSummariesPathAvailable,
    setStorageBusy,
    suppressExternalPathRefreshRef,
    t,
    toast
  ])

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
      await refreshStorageInfo({ includeFileCounts: true })
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
  }, [
    dialog,
    refreshStorageInfo,
    setExternalJournalsPath,
    setExternalJournalsPathAvailable,
    setStorageBusy,
    suppressExternalPathRefreshRef,
    t,
    toast
  ])

  return {
    handleChangeExternalJournalsDirectory,
    handleClearExternalJournalsDirectory,
    handleChangeExternalSummariesDirectory,
    handleClearExternalSummariesDirectory
  }
}
