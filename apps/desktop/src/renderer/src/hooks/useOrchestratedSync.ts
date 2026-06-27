import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { useSyncStore } from '@baishou/store'
import { useToast, useDialog } from '@baishou/ui'
import {
  assertSyncConfirmAllowed,
  canExecuteIncrementalSyncPlan,
  isIncrementalSyncReady,
  resolveIncrementalSyncConfirmReplan,
  resolvePlanConfirmEligibleAt,
  runIncrementalSyncWithDivergenceConfirmation,
  shouldRequireIncrementalSyncReconfirmAfterReplan,
  type IncrementalSyncResult,
  type IncrementalSyncRunOptions,
  type S3SyncConfig,
  type SyncDeletePropagationChoice
} from '@baishou/shared'
import { friendlySyncError } from '../utils/friendly-sync-error'
import {
  SYNC_IPC_FAST_TIMEOUT_MS,
  SYNC_IPC_PLAN_TIMEOUT_MS,
  withSyncIpcTimeoutAndRetry,
  withSyncProgressStallAndRetry
} from '../utils/sync-ipc-timeout'

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

async function readIncrementalSyncConfig(): Promise<S3SyncConfig | null> {
  try {
    return (await window.api.incrementalSync.getConfig()) as S3SyncConfig
  } catch {
    return null
  }
}

function resolveSyncNotReadyMessage(config: S3SyncConfig | null, t: TFunction): string {
  if (config?.enabled === false) {
    return t(
      'data_sync.error_sync_disabled',
      '请先在设置中开启「文件同步」开关后再同步'
    )
  }
  return t(
    'data_sync.error_not_configured',
    '同步服务尚未启用或配置不完整'
  )
}

export function useOrchestratedSync() {
  const { t } = useTranslation()
  const toast = useToast()
  const dialog = useDialog()
  const confirmingRef = useRef(false)
  const planVaultRegistryFingerprintRef = useRef<string | null>(null)
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

  const notifySyncRetry = useCallback(
    (retryIndex: number, maxRetries: number) => {
      setMessage(
        t('data_sync.sync_retrying', {
          attempt: retryIndex,
          max: maxRetries,
          defaultValue: `同步请求超时，正在重试 (${retryIndex}/${maxRetries})…`
        })
      )
    },
    [setMessage, t]
  )

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
          withSyncProgressStallAndRetry(
            () =>
              window.api.incrementalSync.orchestratedSync({
                ...initialRunOptions,
                ...runOptions
              }),
            (onBeat) => window.api.incrementalSync.onSyncProgress(() => onBeat()),
            { onRetry: notifySyncRetry }
          ),
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
      notifySyncRetry,
      setMessage,
      setProgress,
      setStatus,
      setSyncResult,
      t,
      toast
    ]
  )

  const cancelSyncPlan = useCallback(() => {
    planVaultRegistryFingerprintRef.current = null
    clearPlanPreview()
  }, [clearPlanPreview])

  const confirmSyncPlan = useCallback(
    async (deletePropagationChoice?: SyncDeletePropagationChoice) => {
      if (confirmingRef.current) return null

      const { planPreview: stalePreview, planConfirmEligibleAt } = useSyncStore.getState()
      if (!stalePreview) return null

      const syncConfig = await readIncrementalSyncConfig()
      if (!isIncrementalSyncReady(syncConfig)) {
        clearPlanPreview()
        const errorMessage = resolveSyncNotReadyMessage(syncConfig, t)
        setMessage(errorMessage)
        setStatus('idle')
        toast.showWarning(errorMessage)
        return null
      }

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

      let preview = stalePreview
      try {
        const currentFingerprint = await withSyncIpcTimeoutAndRetry(
          () => window.api.incrementalSync.readVaultRegistryFingerprint(),
          { timeoutMs: SYNC_IPC_FAST_TIMEOUT_MS, onRetry: notifySyncRetry }
        )
        const vaultRegistryChanged =
          planVaultRegistryFingerprintRef.current != null &&
          planVaultRegistryFingerprintRef.current !== currentFingerprint

        let localTreeDrifted = false
        let remoteManifestDrifted = false
        if (stalePreview.planReuseBaseline) {
          const drift = await withSyncIpcTimeoutAndRetry(
            () =>
              window.api.incrementalSync.evaluatePlanDrift(stalePreview.planReuseBaseline!),
            { timeoutMs: SYNC_IPC_PLAN_TIMEOUT_MS, onRetry: notifySyncRetry }
          )
          localTreeDrifted = drift.localTreeDrifted
          remoteManifestDrifted = drift.remoteManifestDrifted
        }

        const replanRunOptions: IncrementalSyncRunOptions = {
          ...initialRunOptions,
          unknownVaultPaths: stalePreview.boundaryIssues.unknownVaultPaths,
          ...(deletePropagationChoice ? { deletePropagationChoice } : {})
        }

        const { needsReplan } = resolveIncrementalSyncConfirmReplan({
          stalePreview,
          planPreparedAtMs: stalePreview.planReuseBaseline?.preparedAtMs ?? null,
          planReuseBaseline: stalePreview.planReuseBaseline,
          vaultRegistryChanged,
          highDivergenceConfirmed: Boolean(initialRunOptions?.highDivergenceConfirmed),
          deletePropagationChoiceProvided: Boolean(deletePropagationChoice),
          drift: { localTreeDrifted, remoteManifestDrifted }
        })

        if (needsReplan) {
          preview = await withSyncIpcTimeoutAndRetry(
            () => window.api.incrementalSync.planSync(replanRunOptions),
            { timeoutMs: SYNC_IPC_PLAN_TIMEOUT_MS, onRetry: notifySyncRetry }
          )
          planVaultRegistryFingerprintRef.current = await withSyncIpcTimeoutAndRetry(
            () => window.api.incrementalSync.readVaultRegistryFingerprint(),
            { timeoutMs: SYNC_IPC_FAST_TIMEOUT_MS, onRetry: notifySyncRetry }
          )
        }

        if (preview.changeCount === 0 && preview.warnings.length === 0) {
          clearPlanPreview()
          toast.showSuccess(t('data_sync.plan_up_to_date', '本地与云端已一致，无需同步'))
          setStatus('idle')
          setMessage('')
          return null
        }

        if (
          shouldRequireIncrementalSyncReconfirmAfterReplan(
            needsReplan,
            stalePreview,
            preview,
            Boolean(deletePropagationChoice)
          )
        ) {
          showPlanConfirmDialog(preview, resolvePlanConfirmEligibleAt(preview))
          setStatus('idle')
          setMessage('')
          toast.showWarning(t('data_sync.plan_changed_reconfirm'))
          return null
        }

        if (preview.requiresDeletePropagationChoice && !deletePropagationChoice) {
          showPlanConfirmDialog(preview, resolvePlanConfirmEligibleAt(preview))
          setStatus('idle')
          setMessage('')
          return null
        }

        clearPlanPreview()
        setStatus('syncing')
        setProgress({
          phase: 'comparing',
          current: 0,
          total: 1,
          statusText: 'data_sync.progress_registering_vaults'
        })
        return await runOrchestratedSync(replanRunOptions)
      } catch (e: any) {
        const errorMessage = friendlySyncError(
          e?.message || t('data_sync.sync_unknown_error', 'Unknown error'),
          t
        )
        setMessage(errorMessage)
        setStatus('error')
        setProgress(null)
        toast.showError(errorMessage)
        return null
      } finally {
        confirmingRef.current = false
        setIsConfirmingPlan(false)
      }
    },
    [
      clearPlanPreview,
      notifySyncRetry,
      runOrchestratedSync,
      setMessage,
      setStatus,
      setProgress,
      showPlanConfirmDialog,
      t,
      toast
    ]
  )

  const startSync = useCallback(async () => {
    if (isSyncing || isPlanning || useSyncStore.getState().planDialogOpen || confirmingRef.current) {
      return null
    }

    const syncConfig = await readIncrementalSyncConfig()
    if (!isIncrementalSyncReady(syncConfig)) {
      const errorMessage = resolveSyncNotReadyMessage(syncConfig, t)
      setMessage(errorMessage)
      setStatus('idle')
      toast.showWarning(errorMessage)
      return null
    }

    setStatus('planning')
    setMessage(t('data_sync.planning', '正在分析同步变更…'))
    setSyncResult(null)
    setProgress(null)

    try {
      const preview = await withSyncIpcTimeoutAndRetry(
        () => window.api.incrementalSync.planSync(),
        { timeoutMs: SYNC_IPC_PLAN_TIMEOUT_MS, onRetry: notifySyncRetry }
      )

      if (preview.changeCount === 0 && preview.warnings.length === 0) {
        setStatus('idle')
        setMessage('')
        toast.showSuccess(t('data_sync.plan_up_to_date', '本地与云端已一致，无需同步'))
        return null
      }

      planVaultRegistryFingerprintRef.current = await withSyncIpcTimeoutAndRetry(
        () => window.api.incrementalSync.readVaultRegistryFingerprint(),
        { timeoutMs: SYNC_IPC_FAST_TIMEOUT_MS, onRetry: notifySyncRetry }
      )
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
      return null
    }
  }, [
    isPlanning,
    isSyncing,
    notifySyncRetry,
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
