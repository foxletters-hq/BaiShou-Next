import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useDialog, useToast } from '@baishou/ui'

type StorageBusyState = 'idle' | 'migrating' | 'switching'

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
  const [storageBusy, setStorageBusy] = useState<StorageBusyState>('idle')
  const [migrationProgress, setMigrationProgress] = useState('')

  const refreshStorageInfo = useCallback(async () => {
    try {
      const stats = await getStorageApi()?.getStats?.()
      if (stats?.storageRootPath) {
        setStorageRootPath(stats.storageRootPath)
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
    return () => {
      unsubs.forEach((u) => u())
    }
  }, [refreshStorageInfo])

  const pickDirectory = useCallback(async (): Promise<string | null> => {
    const path = await getStorageApi()?.pickDirectory?.()
    return path ?? null
  }, [])

  const validateTarget = useCallback(async (targetPath: string): Promise<StorageTargetValidation | null> => {
    return (await getStorageApi()?.validateTargetDirectory?.(targetPath)) ?? null
  }, [])

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

  const overlayVisible = storageBusy !== 'idle'
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

  return {
    storageRootPath,
    storageBusy,
    overlayVisible,
    overlayMessage,
    overlayHint,
    handleChangeDirectory,
    handleMigrateDirectory,
    refreshStorageInfo
  }
}
