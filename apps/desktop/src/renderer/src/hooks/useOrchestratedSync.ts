import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSyncStore } from '@baishou/store'
import { useToast, useDialog } from '@baishou/ui'
import {
  assertSyncConfirmAllowed,
  canExecuteIncrementalSyncPlan,
  resolvePlanConfirmEligibleAt,
  runIncrementalSyncWithDivergenceConfirmation,
  type IncrementalSyncResult,
  type IncrementalSyncRunOptions,
  type SyncDeletePropagationChoice
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
  const planConfirmEligibleAt = useSyncStore((s) => s.planConfirmEligibleAt)
  const setStatus = useSyncStore((s) => s.setStatus)
  const setMessage = useSyncStore((s) => s.setMessage)
  const setSyncResult = useSyncStore((s) => s.setSyncResult)
  const setProgress = useSyncStore((s) => s.setProgress)
  const setPlanPreview = useSyncStore((s) => s.setPlanPreview)
  const setPlanConfirmEligibleAt = useSyncStore((s) => s.setPlanConfirmEligibleAt)
  const showPlanConfirmDialog = useSyncStore((s) => s.showPlanConfirmDialog)
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
      setProgress({ phase: 'scanning', current: 0, total: 0 })

      const result = await runIncrementalSyncWithDivergenceConfirmation<IncrementalSyncResult>(
        (runOptions) =>
          window.api.incrementalSync.orchestratedSync({
            ...initialRunOptions,
            ...runOptions
          }),
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

  const confirmSyncPlan = useCallback(async (deletePropagationChoice?: SyncDeletePropagationChoice) => {
    if (confirmingRef.current) return null

    const { planPreview: stalePreview, planConfirmEligibleAt } = useSyncStore.getState()
    if (!stalePreview) return null

    if (stalePreview.requiresDeletePropagationChoice && !deletePropagationChoice) {
      return null
    }

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

    try {
      clearPlanPreview()
      setStatus('syncing')
      setProgress({
        phase: 'comparing',
        current: 0,
        total: 1,
        statusText: 'data_sync.progress_registering_vaults'
      })
      const runOptions: IncrementalSyncRunOptions = {
        ...initialRunOptions,
        unknownVaultPaths: stalePreview.boundaryIssues.unknownVaultPaths,
        ...(deletePropagationChoice ? { deletePropagationChoice } : {})
      }
      return await runOrchestratedSync(runOptions)
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
  }, [clearPlanPreview, runOrchestratedSync, setMessage, setStatus, setProgress, t, toast])

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

      showPlanConfirmDialog(preview, resolvePlanConfirmEligibleAt(preview))
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
    showPlanConfirmDialog,
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
    planConfirmEligibleAt,
    startSync,
    confirmSyncPlan,
    cancelSyncPlan
  }
}
