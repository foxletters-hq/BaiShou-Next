import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSyncStore } from '@baishou/store'
import { useToast, useDialog } from '@baishou/ui'
import {
  assertSyncConfirmAllowed,
  canExecuteIncrementalSyncPlan,
  hasIncrementalSyncPlanMaterialChange,
  resolvePlanConfirmEligibleAt,
  runIncrementalSyncWithDivergenceConfirmation,
  type IncrementalSyncResult,
  type IncrementalSyncRunOptions
} from '@baishou/shared'
import { friendlySyncError } from '../utils/friendly-sync-error'

interface SyncProgress {
  uploaded: number
  downloaded: number
  deletedRemote: number
  deletedLocal: number
  conflicts: number
  skipped: number
  duration: number
  sessionId: string
}

function summarizeSyncResult(result: IncrementalSyncResult): SyncProgress {
  return {
    uploaded: result.uploaded.length,
    downloaded: result.downloaded.length,
    deletedRemote: result.deletedRemote.length,
    deletedLocal: result.deletedLocal.length,
    conflicts: result.conflicted.length,
    skipped: result.skipped.length,
    duration: result.duration,
    sessionId: result.sessionId
  }
}

export function useOrchestratedSync() {
  const { t } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()
  const confirmingRef = useRef(false)
  const [isConfirmingPlan, setIsConfirmingPlan] = useState(false)

  const status = useSyncStore((s) => s.status)
  const message = useSyncStore((s) => s.message)
  const syncResult = useSyncStore((s) => s.syncResult)
  const progress = useSyncStore((s) => s.progress)
  const planPreview = useSyncStore((s) => s.planPreview)
  const planDialogOpen = useSyncStore((s) => s.planDialogOpen)
  const setStatus = useSyncStore((s) => s.setStatus)
  const setMessage = useSyncStore((s) => s.setMessage)
  const setSyncResult = useSyncStore((s) => s.setSyncResult)
  const setProgress = useSyncStore((s) => s.setProgress)
  const setPlanPreview = useSyncStore((s) => s.setPlanPreview)
  const setPlanDialogOpen = useSyncStore((s) => s.setPlanDialogOpen)
  const setPlanConfirmEligibleAt = useSyncStore((s) => s.setPlanConfirmEligibleAt)
  const clearPlanPreview = useSyncStore((s) => s.clearPlanPreview)

  const isSyncing = status === 'syncing'
  const isPlanning = status === 'planning'

  const confirmHighDivergence = useCallback(
    (divergence: number, limit: number) =>
      dialog.confirm(
        t('data_sync.error_divergence_first_sync_confirm_message', {
          divergence,
          limit
        }),
        t('data_sync.error_divergence_first_sync_confirm_title')
      ),
    [dialog, t]
  )

  const runOrchestratedSync = useCallback(
    async (initialRunOptions?: IncrementalSyncRunOptions) => {
      setStatus('syncing')
      setMessage(t('data_sync.syncing', 'Syncing...'))
      setSyncResult(null)
      setProgress(null)

      const result = await runIncrementalSyncWithDivergenceConfirmation<IncrementalSyncResult>(
        (runOptions) =>
          window.api.incrementalSync.orchestratedSync(runOptions ?? initialRunOptions),
        confirmHighDivergence
      )

      if (!result) {
        setStatus('idle')
        setMessage('')
        setProgress(null)
        return null
      }

      const summary = summarizeSyncResult(result)
      setSyncResult(result)
      setProgress(null)
      setMessage(t('data_sync.sync_completed', 'Sync Completed'))
      setStatus('success')
      toast.showSuccess(t('data_sync.sync_completed', 'Sync Completed'))
      return summary
    },
    [
      confirmHighDivergence,
      setMessage,
      setProgress,
      setStatus,
      setSyncResult,
      t,
      toast
    ]
  )

  const cancelSyncPlan = useCallback(() => {
    clearPlanPreview()
  }, [clearPlanPreview])

  const confirmSyncPlan = useCallback(async () => {
    if (confirmingRef.current) return null

    const { planPreview: stalePreview, planConfirmEligibleAt } = useSyncStore.getState()
    if (!stalePreview) return null

    const canExecute = canExecuteIncrementalSyncPlan(stalePreview)
    try {
      assertSyncConfirmAllowed({
        canExecuteSync: canExecute,
        eligibleAtMs: planConfirmEligibleAt
      })
    } catch {
      return null
    }

    const initialRunOptions: IncrementalSyncRunOptions | undefined =
      stalePreview.requiresHighDivergenceConfirm ? { highDivergenceConfirmed: true } : undefined

    confirmingRef.current = true
    setIsConfirmingPlan(true)

    let preview = stalePreview
    try {
      preview = await window.api.incrementalSync.planSync(initialRunOptions)

      if (preview.deletePropagationBlocked) {
        toast.showError(t('data_sync.plan_warning_delete_blocked'))
        setPlanPreview(preview)
        setPlanConfirmEligibleAt(resolvePlanConfirmEligibleAt(preview))
        return null
      }

      if (preview.changeCount === 0) {
        clearPlanPreview()
        if (preview.warnings.length === 0) {
          toast.showSuccess(t('data_sync.plan_up_to_date', '本地与云端已一致，无需同步'))
        }
        return null
      }

      if (hasIncrementalSyncPlanMaterialChange(stalePreview, preview)) {
        setPlanPreview(preview)
        setPlanConfirmEligibleAt(resolvePlanConfirmEligibleAt(preview))
        toast.showWarning(t('data_sync.plan_changed_reconfirm'))
        return null
      }

      clearPlanPreview()
      return await runOrchestratedSync(initialRunOptions)
    } catch (e: any) {
      const errorMessage = friendlySyncError(
        e?.message || t('data_sync.sync_unknown_error', 'Unknown error'),
        t
      )
      setMessage(errorMessage)
      setStatus('error')
      toast.showError(errorMessage)
      return null
    } finally {
      confirmingRef.current = false
      setIsConfirmingPlan(false)
    }
  }, [
    clearPlanPreview,
    runOrchestratedSync,
    setMessage,
    setPlanConfirmEligibleAt,
    setPlanPreview,
    setStatus,
    t,
    toast
  ])

  const startSync = useCallback(async () => {
    if (isSyncing || isPlanning || useSyncStore.getState().planDialogOpen || confirmingRef.current) {
      return null
    }

    setStatus('planning')
    setMessage(t('data_sync.planning', '正在分析同步变更…'))
    setSyncResult(null)
    setProgress(null)

    try {
      const preview = await window.api.incrementalSync.planSync()

      if (preview.changeCount === 0 && preview.warnings.length === 0) {
        setStatus('idle')
        setMessage('')
        toast.showSuccess(t('data_sync.plan_up_to_date', '本地与云端已一致，无需同步'))
        return null
      }

      setPlanPreview(preview)
      setPlanDialogOpen(true)
      setPlanConfirmEligibleAt(resolvePlanConfirmEligibleAt(preview))
      setStatus('idle')
      setMessage('')
      return null
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
  }, [
    isPlanning,
    isSyncing,
    setMessage,
    setPlanConfirmEligibleAt,
    setPlanDialogOpen,
    setPlanPreview,
    setProgress,
    setStatus,
    setSyncResult,
    t,
    toast
  ])

  return {
    status,
    isSyncing,
    isPlanning,
    isConfirmingPlan,
    message,
    syncResult,
    progress,
    planPreview,
    planDialogOpen,
    startSync,
    confirmSyncPlan,
    cancelSyncPlan
  }
}
