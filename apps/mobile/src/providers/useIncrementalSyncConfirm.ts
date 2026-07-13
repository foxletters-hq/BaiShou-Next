import { useCallback } from 'react'
import type { TFunction } from 'i18next'
import type { IncrementalSyncPlanPreview } from '@baishou/shared'
import {
  assertSyncConfirmAllowed,
  canExecuteIncrementalSyncPlan,
  INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS,
  logger,
  readVaultRegistryFingerprint,
  resolveIncrementalSyncConfirmReplan,
  resolvePlanConfirmEligibleAt,
  shouldRequireIncrementalSyncReconfirmAfterReplan,
  type IncrementalSyncRunOptions,
  type SyncDeletePropagationChoice
} from '@baishou/shared'
import type { IncrementalSyncResult } from '../services/mobile-incremental-sync.service'
import { planIncrementalSyncWithVaultRegistry } from '../services/incremental-sync-vault-registry'
import { detectLocalSyncTreeDrift } from '../services/mobile-incremental-sync-drift.util'
import { friendlyMobileSyncError } from '../utils/friendly-sync-error'
import { isIncrementalSyncAbortedError } from '../services/mobile-incremental-sync-abort.util'
import type { IncrementalSyncOverlayHandle } from './IncrementalSyncOverlayHost'
import type { useBaishou } from './BaishouProvider'

type BaishouServices = NonNullable<ReturnType<typeof useBaishou>['services']>

export type IncrementalSyncConfirmDeps = {
  services: BaishouServices | null
  t: TFunction
  toast: {
    showSuccess: (msg: string) => void
    showWarning: (msg: string) => void
    showError: (msg: string) => void
    showInfo: (msg: string) => void
  }
  planPreview: IncrementalSyncPlanPreview | null
  planConfirmEligibleAt: number | null
  planPreparedAtRef: React.MutableRefObject<number | null>
  planVaultRegistryFingerprintRef: React.MutableRefObject<string | null>
  confirmingRef: React.MutableRefObject<boolean>
  syncingRef: React.MutableRefObject<boolean>
  overlayRef: React.RefObject<IncrementalSyncOverlayHandle | null>
  beginSyncAbortController: () => AbortSignal
  executeIncrementalSync: (
    runOptions?: IncrementalSyncRunOptions,
    abortSignal?: AbortSignal
  ) => Promise<IncrementalSyncResult | undefined>
  finishIncrementalSync: (result: IncrementalSyncResult) => Promise<void>
  clearPlanPreview: () => void
  setPlanPreview: (preview: IncrementalSyncPlanPreview | null) => void
  setPlanConfirmEligibleAt: (at: number | null) => void
  setIsConfirmingPlan: (v: boolean) => void
  setIsSyncing: (v: boolean) => void
  syncAbortRef: React.MutableRefObject<AbortController | null>
}

export function useIncrementalSyncConfirm(deps: IncrementalSyncConfirmDeps) {
  const {
    services,
    t,
    toast,
    planPreview,
    planConfirmEligibleAt,
    planPreparedAtRef,
    planVaultRegistryFingerprintRef,
    confirmingRef,
    syncingRef,
    overlayRef,
    beginSyncAbortController,
    executeIncrementalSync,
    finishIncrementalSync,
    clearPlanPreview,
    setPlanPreview,
    setPlanConfirmEligibleAt,
    setIsConfirmingPlan,
    setIsSyncing,
    syncAbortRef
  } = deps

  return useCallback(
    async (deletePropagationChoice?: SyncDeletePropagationChoice) => {
      if (confirmingRef.current || syncingRef.current) return

      const stalePreview = planPreview
      if (!stalePreview || !services?.incrementalSyncService || !services.vaultService) return

      if (stalePreview.requiresDeletePropagationChoice && !deletePropagationChoice) {
        return
      }

      const canExecute = canExecuteIncrementalSyncPlan(stalePreview)
      try {
        assertSyncConfirmAllowed({
          canExecuteSync: canExecute,
          eligibleAtMs: planConfirmEligibleAt
        })
      } catch {
        return
      }

      const initialRunOptions: IncrementalSyncRunOptions | undefined =
        stalePreview.requiresHighDivergenceConfirm ? { highDivergenceConfirmed: true } : undefined

      confirmingRef.current = true
      setIsConfirmingPlan(true)

      let preview = stalePreview
      try {
        const registryPath = `${await services.pathService.getRootDirectory()}/vault_registry.json`
        const currentFingerprint = await readVaultRegistryFingerprint(
          services.fileSystem,
          registryPath
        )
        const vaultRegistryChanged =
          planVaultRegistryFingerprintRef.current != null &&
          planVaultRegistryFingerprintRef.current !== currentFingerprint

        let localTreeDrifted = false
        let remoteManifestDrifted = false
        const withinPlanReuseTtl =
          planPreparedAtRef.current != null &&
          Date.now() - planPreparedAtRef.current <= INCREMENTAL_SYNC_PLAN_REUSE_TTL_MS
        if (
          withinPlanReuseTtl &&
          !vaultRegistryChanged &&
          !stalePreview.deletePropagationBlocked &&
          !(
            stalePreview.requiresHighDivergenceConfirm &&
            !initialRunOptions?.highDivergenceConfirmed
          )
        ) {
          const pendingLocal = services.incrementalSyncService.peekPendingSyncPlanLocalManifest()
          if (pendingLocal || stalePreview.planReuseBaseline?.localFilesFingerprint) {
            const syncRoot = await services.pathService.getRootDirectory()
            localTreeDrifted = await detectLocalSyncTreeDrift(
              services.fileSystem,
              syncRoot,
              pendingLocal ?? { version: 1, updatedAt: 0, deviceId: '', files: {} },
              stalePreview.planReuseBaseline?.localFilesFingerprint
            )
          }
          if (!localTreeDrifted) {
            remoteManifestDrifted =
              await services.incrementalSyncService.detectRemoteManifestDrift()
          }
        }

        const replanRunOptions: IncrementalSyncRunOptions | undefined =
          initialRunOptions || deletePropagationChoice
            ? {
                ...initialRunOptions,
                ...(deletePropagationChoice ? { deletePropagationChoice } : {})
              }
            : undefined

        const { needsReplan } = resolveIncrementalSyncConfirmReplan({
          stalePreview,
          planPreparedAtMs:
            stalePreview.planReuseBaseline?.preparedAtMs ?? planPreparedAtRef.current,
          planReuseBaseline: stalePreview.planReuseBaseline,
          vaultRegistryChanged,
          highDivergenceConfirmed: Boolean(initialRunOptions?.highDivergenceConfirmed),
          deletePropagationChoiceProvided: Boolean(deletePropagationChoice),
          drift: { localTreeDrifted, remoteManifestDrifted }
        })

        if (needsReplan) {
          preview = await planIncrementalSyncWithVaultRegistry(
            {
              pathService: services.pathService,
              fileSystem: services.fileSystem,
              vaultService: services.vaultService,
              incrementalSyncService: services.incrementalSyncService
            },
            { runOptions: replanRunOptions }
          )
          planPreparedAtRef.current = Date.now()
          planVaultRegistryFingerprintRef.current = await readVaultRegistryFingerprint(
            services.fileSystem,
            registryPath
          )
        }

        if (preview.changeCount === 0) {
          clearPlanPreview()
          if (preview.warnings.length === 0) {
            toast.showSuccess(t('data_sync.plan_up_to_date', '本地与云端已一致，无需同步'))
          }
          return
        }

        if (
          shouldRequireIncrementalSyncReconfirmAfterReplan(
            needsReplan,
            stalePreview,
            preview,
            Boolean(deletePropagationChoice),
            Boolean(initialRunOptions?.highDivergenceConfirmed)
          )
        ) {
          logger.warn('[IncrementalSync] plan changed after replan, require reconfirm', {
            vaultRegistryChanged,
            localTreeDrifted,
            remoteManifestDrifted,
            staleChangeCount: stalePreview.changeCount,
            freshChangeCount: preview.changeCount,
            staleDeleteBlocked: stalePreview.deletePropagationBlocked,
            freshDeleteBlocked: preview.deletePropagationBlocked
          })
          setPlanPreview(preview)
          setPlanConfirmEligibleAt(resolvePlanConfirmEligibleAt(preview))
          toast.showWarning(t('data_sync.plan_changed_reconfirm'))
          return
        }

        if (preview.requiresDeletePropagationChoice && !deletePropagationChoice) {
          setPlanPreview(preview)
          setPlanConfirmEligibleAt(resolvePlanConfirmEligibleAt(preview))
          return
        }

        clearPlanPreview()
        syncingRef.current = true
        setIsSyncing(true)
        overlayRef.current?.publish({
          phase: 'comparing',
          current: 0,
          total: 1,
          statusText: 'data_sync.progress_registering_vaults'
        })
        const abortSignal = beginSyncAbortController()
        let syncResult: IncrementalSyncResult | undefined

        try {
          syncResult = await executeIncrementalSync(
            {
              ...initialRunOptions,
              ...(deletePropagationChoice ? { deletePropagationChoice } : {})
            },
            abortSignal
          )
        } catch (e) {
          if (isIncrementalSyncAbortedError(e)) {
            toast.showInfo(t('data_sync.sync_cancelled', '已取消同步'))
            return
          }
          logger.error('增量同步失败', e instanceof Error ? e : String(e))
          const message = e instanceof Error ? e.message : t('data_sync.sync_failed_generic')
          toast.showError(friendlyMobileSyncError(message, t))
        } finally {
          syncAbortRef.current = null
          syncingRef.current = false
          setIsSyncing(false)
          overlayRef.current?.reset()
        }

        if (syncResult) {
          await finishIncrementalSync(syncResult)
        }
      } catch (e) {
        logger.error('增量同步确认失败', e instanceof Error ? e : String(e))
        const message = e instanceof Error ? e.message : t('data_sync.sync_failed_generic')
        toast.showError(friendlyMobileSyncError(message, t))
      } finally {
        confirmingRef.current = false
        setIsConfirmingPlan(false)
      }
    },
    [
      beginSyncAbortController,
      clearPlanPreview,
      confirmingRef,
      executeIncrementalSync,
      finishIncrementalSync,
      overlayRef,
      planConfirmEligibleAt,
      planPreparedAtRef,
      planPreview,
      planVaultRegistryFingerprintRef,
      services,
      setIsConfirmingPlan,
      setIsSyncing,
      setPlanConfirmEligibleAt,
      setPlanPreview,
      syncAbortRef,
      syncingRef,
      t,
      toast
    ]
  )
}
