import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSyncStore } from '@baishou/store'
import { useToast } from '@baishou/ui'
import { friendlySyncError } from '../utils/friendly-sync-error'

export function useOrchestratedSync() {
  const { t } = useTranslation()
  const toast = useToast()

  const status = useSyncStore((s) => s.status)
  const message = useSyncStore((s) => s.message)
  const syncResult = useSyncStore((s) => s.syncResult)
  const progress = useSyncStore((s) => s.progress)
  const setStatus = useSyncStore((s) => s.setStatus)
  const setMessage = useSyncStore((s) => s.setMessage)
  const setSyncResult = useSyncStore((s) => s.setSyncResult)
  const setProgress = useSyncStore((s) => s.setProgress)

  const isSyncing = status === 'syncing'

  const startSync = useCallback(async () => {
    if (isSyncing) return null

    setStatus('syncing')
    setMessage(t('data_sync.syncing', 'Syncing...'))
    setSyncResult(null)
    setProgress(null)

    try {
      const result = await (window as any).api?.incrementalSync?.orchestratedSync()
      setSyncResult(result)
      setProgress(null)
      setMessage(t('data_sync.sync_completed', 'Sync Completed'))
      setStatus('success')
      toast.showSuccess(t('data_sync.sync_completed', 'Sync Completed'))
      return result
    } catch (e: any) {
      const errorMessage = friendlySyncError(
        e?.message || t('data_sync.sync_unknown_error', 'Unknown error'),
        t
      )
      setMessage(errorMessage)
      setStatus('error')
      setProgress(null)
      toast.showError(errorMessage)
      throw e
    }
  }, [isSyncing, setMessage, setProgress, setStatus, setSyncResult, t, toast])

  return {
    status,
    isSyncing,
    message,
    syncResult,
    progress,
    startSync
  }
}
