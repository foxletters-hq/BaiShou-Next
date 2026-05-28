import { useCallback, useEffect, useState } from 'react'
import { Alert, AppState, Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeToast } from '@baishou/ui/native'
import { hasStoragePermission, requestStoragePermission } from '../services/storage-permission.service'
import { useBaishou } from '../providers/BaishouProvider'

export function useStoragePermission() {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const { dbReady, storageReady, retryStorageSetup } = useBaishou()
  const [granted, setGranted] = useState<boolean | undefined>(
    Platform.OS === 'android' ? undefined : true
  )

  const refresh = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      setGranted(true)
      return true
    }
    const ok = await hasStoragePermission()
    setGranted(ok)
    return ok
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
      if (state === 'active') void refresh()
    })
    return () => sub.remove()
  }, [refresh])

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
      Alert.alert(t('storage.all_files_access_title'), t('storage.all_files_access_settings_hint'), [
        { text: t('common.ok') }
      ])
      return false
    }

    const mounted = await retryStorageSetup()
    const ok = mounted && (await hasStoragePermission())
    setGranted(ok)

    if (ok) {
      toast.showToast(t('common.permission.storage_granted'), 'success')
    } else {
      Alert.alert(t('storage.all_files_access_title'), t('storage.all_files_access_settings_hint'), [
        { text: t('common.ok') }
      ])
    }

    return ok
  }, [retryStorageSetup, storageReady, t, toast])

  const needsFullFileAccess = Platform.OS === 'android' && granted === false

  return {
    isAndroid: Platform.OS === 'android',
    granted,
    storageReady,
    refresh,
    request,
    needsFullFileAccess,
    needsPermission: needsFullFileAccess
  }
}
