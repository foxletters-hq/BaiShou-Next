import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import {
  hasStoragePermission,
  getStoragePermissionHint,
  openStoragePermissionSettings,
  requestStoragePermission
} from '../services/storage-permission.service'
import { useBaishou } from '../providers/BaishouProvider'

export type StorageMountStatus = 'idle' | 'mounting' | 'slow' | 'failed'

const STORAGE_MOUNT_SLOW_MS = 5000
const PERMISSION_SETTINGS_RETRY_MS = 450

export function useStoragePermission() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { dbReady, storageReady, retryStorageSetup } = useBaishou()
  const [granted, setGranted] = useState<boolean | undefined>(
    Platform.OS === 'android' ? undefined : true
  )
  const [permissionChecked, setPermissionChecked] = useState(Platform.OS !== 'android')
  const [mountStatus, setMountStatus] = useState<StorageMountStatus>('idle')
  const mountInFlightRef = useRef(false)
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const awaitingSettingsReturnRef = useRef(false)

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

  const attemptMount = useCallback(
    async (forcePermitted = false): Promise<boolean> => {
      if (Platform.OS !== 'android') return true
      if (
        !dbReady ||
        (!forcePermitted && granted !== true) ||
        storageReady ||
        mountInFlightRef.current
      ) {
        return storageReady
      }

      mountInFlightRef.current = true
      setMountStatus('mounting')
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current)
      }
      slowTimerRef.current = setTimeout(() => {
        if (mountInFlightRef.current) {
          setMountStatus('slow')
        }
      }, STORAGE_MOUNT_SLOW_MS)
      try {
        const ok = await retryStorageSetup()
        setMountStatus(ok ? 'idle' : 'failed')
        return ok
      } finally {
        if (slowTimerRef.current) {
          clearTimeout(slowTimerRef.current)
          slowTimerRef.current = null
        }
        mountInFlightRef.current = false
      }
    },
    [dbReady, granted, retryStorageSetup, storageReady]
  )

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (storageReady) {
      setMountStatus('idle')
    }
  }, [storageReady])

  useEffect(
    () => () => {
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current)
      }
    },
    []
  )

  /** 权限已授予后自动尝试挂载 BaiShou_Root（失败不阻塞，可手动重试） */
  useEffect(() => {
    if (Platform.OS !== 'android') return
    if (!dbReady || !permissionChecked || granted !== true || storageReady) return
    void attemptMount()
  }, [attemptMount, dbReady, granted, permissionChecked, storageReady])

  useEffect(() => {
    if (Platform.OS !== 'android') return
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void (async () => {
          if (awaitingSettingsReturnRef.current) {
            awaitingSettingsReturnRef.current = false
            await new Promise((resolve) => setTimeout(resolve, PERMISSION_SETTINGS_RETRY_MS))
          }
          const permitted = await refresh()
          if (permitted && dbReady && !storageReady) {
            await attemptMount()
          }
        })()
      }
    })
    return () => sub.remove()
  }, [attemptMount, dbReady, refresh, storageReady])

  const request = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true

    if (!(await hasStoragePermission())) {
      awaitingSettingsReturnRef.current = true
      const apiLevel = typeof Platform.Version === 'number' ? Platform.Version : 0
      if (apiLevel >= 30) {
        const opened = await openStoragePermissionSettings()
        if (!opened) {
          toast.showWarning(t('storage.settings_open_failed'))
          return false
        }
      } else {
        await requestStoragePermission()
      }
    }

    const permitted = await hasStoragePermission()
    setGranted(permitted)
    if (!permitted) {
      const hint = getStoragePermissionHint()
      toast.showWarning(hint || t('storage.all_files_access_settings_hint'))
      return false
    }

    const mounted = await attemptMount(true)
    if (mounted) {
      toast.showToast(t('common.permission.storage_granted'), 'success')
      return true
    }

    toast.showWarning(t('storage.external_access_error'))
    return false
  }, [attemptMount, t, toast])

  /** 仅在已确认未授权时展示权限引导，避免启动时 granted 未决的闪屏 */
  const needsFullFileAccess = Platform.OS === 'android' && permissionChecked && granted === false

  /** 正在主动挂载外部存储（非「尚未就绪」的永久等待态） */
  const isStoragePending = mountStatus === 'mounting'
  const mountSlow = mountStatus === 'slow' && granted === true && !storageReady
  const mountFailed = mountStatus === 'failed' && granted === true && !storageReady

  return {
    isAndroid: Platform.OS === 'android',
    granted,
    permissionChecked,
    storageReady,
    isStoragePending,
    mountSlow,
    mountFailed,
    refresh,
    request,
    retryMount: attemptMount,
    needsFullFileAccess,
    needsPermission: needsFullFileAccess
  }
}
