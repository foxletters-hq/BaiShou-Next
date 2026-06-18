import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSyncStore } from '@baishou/store'
import { useToast, useDialog } from '@baishou/ui'
import { runIncrementalSyncWithDivergenceConfirmation } from '@baishou/shared'
import { friendlySyncError } from '../utils/friendly-sync-error'

export function useOrchestratedSync() {
  const { t } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()

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
      const confirmHighDivergence = (divergence: number, limit: number) =>
        dialog.confirm(
          t('data_sync.error_divergence_first_sync_confirm_message', {
            divergence,
            limit
          }),
          {
            title: t('data_sync.error_divergence_first_sync_confirm_title'),
            confirmText: t('common.confirm', 'Confirm'),
            cancelText: t('common.cancel', 'Cancel'),
            destructive: true
          }
        )

      const result = await runIncrementalSyncWithDivergenceConfirmation(
        (runOptions) => (window as any).api?.incrementalSync?.orchestratedSync(runOptions),
        confirmHighDivergence
      )

      if (!result) {
        setStatus('idle')
        setMessage('')
        setProgress(null)
        return null
      }

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
  }, [dialog, isSyncing, setMessage, setProgress, setStatus, setSyncResult, t, toast])

  return {
    status,
    isSyncing,
    message,
    syncResult,
    progress,
    startSync
  }
}
