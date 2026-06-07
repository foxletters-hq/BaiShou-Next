import { useCallback, useEffect, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import {
  hasStoragePermission,
  requestStoragePermission
} from '../services/storage-permission.service'
import { useBaishou } from '../providers/BaishouProvider'

export function useStoragePermission() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { dbReady, storageReady, retryStorageSetup } = useBaishou()
  const [granted, setGranted] = useState<boolean | undefined>(
    Platform.OS === 'android' ? undefined : true
  )
  const [permissionChecked, setPermissionChecked] = useState(Platform.OS !== 'android')

  const refresh = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setGranted(true)
      setPermissionChecked(true)
      return true
    }
    try {
      const ok = await hasStoragePermission()
      setGranted(ok)
      return ok
    } finally {
      setPermissionChecked(true)
    }
  }, [])

  useEffect(() => {
    if (Platform.OS !== 'android') {
      void refresh()
      return
    }
    if (dbReady) void refresh()
  }, [refresh, dbReady])

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh().then(async (permitted) => {
          if (permitted && !storageReady) {
            await retryStorageSetup()
          }
        })
      }
    })
    return () => sub.remove()
  }, [refresh, storageReady, retryStorageSetup])

  const request = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true

    const mountIfNeeded = async (): Promise<boolean> => {
      if (storageReady) return true
      return retryStorageSetup()
    }

    if (await hasStoragePermission()) {
      const mounted = await mountIfNeeded()
      const ok = mounted && (await hasStoragePermission())
      setGranted(ok)
      if (ok) {
        toast.showToast(t('common.permission.storage_granted'), 'success')
      }
      return ok
    }

    await requestStoragePermission()
    const permitted = await hasStoragePermission()
    if (!permitted) {
      setGranted(false)
      toast.showWarning(t('storage.all_files_access_settings_hint'))
      return false
    }

    const mounted = await retryStorageSetup()
    const ok = mounted && (await hasStoragePermission())
    setGranted(ok)

    if (ok) {
      toast.showToast(t('common.permission.storage_granted'), 'success')
    } else {
      toast.showWarning(t('storage.all_files_access_settings_hint'))
    }

    return ok
  }, [retryStorageSetup, storageReady, t, toast])

  /** 仅在已确认未授权时展示权限引导，避免启动时 granted 未决的闪屏 */
  const needsFullFileAccess = Platform.OS === 'android' && permissionChecked && granted === false

  /** 已授权但外部存储/vault 仍在挂载 */
  const isStoragePending =
    Platform.OS === 'android' && permissionChecked && granted === true && !storageReady

  return {
    isAndroid: Platform.OS === 'android',
    granted,
    permissionChecked,
    storageReady,
    isStoragePending,
    refresh,
    request,
    needsFullFileAccess,
    needsPermission: needsFullFileAccess
  }
}
