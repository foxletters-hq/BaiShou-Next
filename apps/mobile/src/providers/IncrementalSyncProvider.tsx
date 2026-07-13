import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { InteractionManager, View, StyleSheet, BackHandler } from 'react-native'
import { useTranslation } from 'react-i18next'
import { IncrementalSyncConfirmDialog, useDialog, useNativeToast } from '@baishou/ui/native'
import { useRouter } from 'expo-router'
import type { IncrementalSyncPlanPreview } from '@baishou/shared'
import type {
  IncrementalSyncProgress,
  IncrementalSyncResult
} from '../services/mobile-incremental-sync.service'
import {
  planIncrementalSyncWithVaultRegistry,
  reconcileVaultRegistryForIncrementalSync
} from '../services/incremental-sync-vault-registry'
import { useBaishou } from './BaishouProvider'
import {
  isIncrementalSyncReady,
  logger,
  readVaultRegistryFingerprint,
  resolvePlanConfirmEligibleAt,
  runIncrementalSyncWithDivergenceConfirmation,
  type IncrementalSyncRunOptions
} from '@baishou/shared'
import { friendlyMobileSyncError } from '../utils/friendly-sync-error'
import {
  IncrementalSyncOverlayHost,
  type IncrementalSyncOverlayHandle
} from './IncrementalSyncOverlayHost'
import { useIncrementalSyncConfirm } from './useIncrementalSyncConfirm'

type IncrementalSyncActionsValue = {
  isSyncing: boolean
  isPlanning: boolean
  isPlanDialogOpen: boolean
  isBusy: boolean
  isConfigured: boolean | null
  /** 增量同步开关是否已打开（与设置页展示同步入口的条件一致） */
  isEnabled: boolean | null
  refreshConfigured: () => Promise<void>
  runIncrementalSync: () => Promise<IncrementalSyncResult | undefined>
}

export type { IncrementalSyncOverlayHandle } from './IncrementalSyncOverlayHost'

const IncrementalSyncActionsContext = createContext<IncrementalSyncActionsValue>({
  isSyncing: false,
  isPlanning: false,
  isPlanDialogOpen: false,
  isBusy: false,
  isConfigured: null,
  isEnabled: null,
  refreshConfigured: async () => {},
  runIncrementalSync: async () => undefined
})

export const useIncrementalSync = () => useContext(IncrementalSyncActionsContext)

export function IncrementalSyncProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const router = useRouter()
  const { services, dbReady } = useBaishou()

  const overlayRef = useRef<IncrementalSyncOverlayHandle>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isPlanning, setIsPlanning] = useState(false)
  const [isConfirmingPlan, setIsConfirmingPlan] = useState(false)
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null)
  const [planPreview, setPlanPreview] = useState<IncrementalSyncPlanPreview | null>(null)
  const [planDialogOpen, setPlanDialogOpen] = useState(false)
  const [planConfirmEligibleAt, setPlanConfirmEligibleAt] = useState<number | null>(null)
  const planPreparedAtRef = useRef<number | null>(null)
  const planVaultRegistryFingerprintRef = useRef<string | null>(null)
  const planGenerationRef = useRef(0)
  const syncingRef = useRef(false)
  const confirmingRef = useRef(false)
  const syncAbortRef = useRef<AbortController | null>(null)

  const beginSyncAbortController = useCallback((): AbortSignal => {
    syncAbortRef.current?.abort()
    const controller = new AbortController()
    syncAbortRef.current = controller
    return controller.signal
  }, [])

  const abortActiveSyncFlow = useCallback(() => {
    syncAbortRef.current?.abort()
    syncAbortRef.current = null
    planGenerationRef.current += 1
    confirmingRef.current = false
    syncingRef.current = false
    setIsPlanning(false)
    setIsSyncing(false)
    setIsConfirmingPlan(false)
    setPlanPreview(null)
    setPlanDialogOpen(false)
    setPlanConfirmEligibleAt(null)
    planPreparedAtRef.current = null
    planVaultRegistryFingerprintRef.current = null
    overlayRef.current?.reset()
  }, [])

  const clearPlanPreview = useCallback(() => {
    setPlanPreview(null)
    setPlanDialogOpen(false)
    setPlanConfirmEligibleAt(null)
    planPreparedAtRef.current = null
    planVaultRegistryFingerprintRef.current = null
  }, [])

  const refreshConfigured = useCallback(async () => {
    if (!services?.incrementalSyncService || !dbReady) {
      setIsConfigured(false)
      setIsEnabled(false)
      return
    }
    try {
      const config = await services.incrementalSyncService.getConfig()
      setIsEnabled(config.enabled === true)
      setIsConfigured(isIncrementalSyncReady(config))
    } catch {
      setIsConfigured(false)
      setIsEnabled(false)
    }
  }, [dbReady, services])

  useEffect(() => {
    void refreshConfigured()
  }, [refreshConfigured])

  const executeIncrementalSync = useCallback(
    async (
      runOptions?: IncrementalSyncRunOptions,
      abortSignal?: AbortSignal
    ): Promise<IncrementalSyncResult | undefined> => {
      if (!services?.incrementalSyncService) return undefined

      const svc = services.incrementalSyncService
      const onProgress = (p: IncrementalSyncProgress) => {
        overlayRef.current?.publish(p)
      }

      const confirmHighDivergence = (divergence: number, limit: number) =>
        dialog.confirm(
          t('data_sync.error_divergence_first_sync_confirm_message', {
            divergence,
            limit
          }),
          {
            title: t('data_sync.error_divergence_first_sync_confirm_title'),
            confirmText: t('common.confirm', '确认'),
            cancelText: t('common.cancel', '取消'),
            destructive: true
          }
        )

      const run = (options?: IncrementalSyncRunOptions) => {
        const merged = { ...runOptions, ...options }
        return svc.sync(onProgress, merged, abortSignal)
      }
      const result = await runIncrementalSyncWithDivergenceConfirmation(run, confirmHighDivergence)
      if (!result) return undefined

      if (services.vaultService) {
        await reconcileVaultRegistryForIncrementalSync(services.vaultService)
      }

      return result
    },
    [dialog, services, t]
  )

  const finishIncrementalSync = useCallback(
    async (result: IncrementalSyncResult) => {
      if (!services?.incrementalSyncService) return

      try {
        await services.incrementalSyncService.awaitPostSyncMaintenance()
      } catch (e: unknown) {
        logger.warn(
          '[IncrementalSync] post-sync maintenance failed:',
          e instanceof Error ? e : String(e)
        )
      }

      toast.showSuccess(t('data_sync.sync_completed'))
      if (result.conflicts > 0) {
        toast.showWarning(
          t('data_sync.sync_result_conflicts').replace('$count', String(result.conflicts))
        )
      }
    },
    [services, t, toast]
  )

  const confirmSyncPlan = useIncrementalSyncConfirm({
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
  })

  const runIncrementalSync = useCallback(async (): Promise<IncrementalSyncResult | undefined> => {
    if (!services?.incrementalSyncService || !dbReady) {
      toast.showError(t('workspace.service_unavailable'))
      return undefined
    }

    if (syncingRef.current || confirmingRef.current || isSyncing || isPlanning || planDialogOpen) {
      return undefined
    }

    try {
      const configured = isConfigured ?? (await services.incrementalSyncService.isConfigured())
      if (!configured) {
        const goConfigure = await dialog.confirm(t('data_sync.error_not_configured'), {
          title: t('data_sync.incremental_sync'),
          confirmText: t('settings.go_to_settings')
        })
        if (goConfigure) router.push('/incremental-sync')
        return undefined
      }

      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve())
      })

      const planGeneration = ++planGenerationRef.current
      setIsPlanning(true)
      overlayRef.current?.publish({ phase: 'scanning', current: 0, total: 0 })

      let openedDialog = false
      try {
        const preview = await planIncrementalSyncWithVaultRegistry(
          {
            pathService: services.pathService,
            fileSystem: services.fileSystem,
            vaultService: services.vaultService,
            incrementalSyncService: services.incrementalSyncService
          },
          {
            onProgress: (p) => overlayRef.current?.publish(p)
          }
        )

        if (planGeneration !== planGenerationRef.current) return undefined

        if (preview.changeCount === 0 && preview.warnings.length === 0) {
          toast.showSuccess(t('data_sync.plan_up_to_date', '本地与云端已一致，无需同步'))
          return undefined
        }

        openedDialog = true
        planPreparedAtRef.current = preview.planReuseBaseline?.preparedAtMs ?? Date.now()
        planVaultRegistryFingerprintRef.current = await readVaultRegistryFingerprint(
          services.fileSystem,
          `${await services.pathService.getRootDirectory()}/vault_registry.json`
        )
        setPlanPreview(preview)
        setPlanDialogOpen(true)
        setPlanConfirmEligibleAt(resolvePlanConfirmEligibleAt(preview))
        return undefined
      } finally {
        if (planGeneration === planGenerationRef.current) {
          setIsPlanning(false)
        }
        if (!openedDialog) {
          overlayRef.current?.reset()
        }
      }
    } catch (e) {
      logger.error('增量同步规划失败', e instanceof Error ? e : String(e))
      const message = e instanceof Error ? e.message : t('data_sync.sync_failed_generic')
      toast.showError(friendlyMobileSyncError(message, t))
      abortActiveSyncFlow()
      return undefined
    }
  }, [
    abortActiveSyncFlow,
    dbReady,
    dialog,
    isConfigured,
    isPlanning,
    isSyncing,
    planDialogOpen,
    router,
    services,
    t,
    toast
  ])

  const showProgressOverlay = isSyncing || isPlanning
  const showBlockingOverlay = showProgressOverlay && !planDialogOpen
  const isBusy = isSyncing || isPlanning || isConfirmingPlan || planDialogOpen

  const handleBlockingBack = useCallback(() => {
    if (isPlanning) {
      abortActiveSyncFlow()
      toast.showInfo(t('data_sync.plan_cancelled', '已取消同步分析'))
      return
    }
    if (isSyncing) {
      syncAbortRef.current?.abort()
      return
    }
    toast.showWarning(
      t('data_sync.sync_in_progress_leave_blocked', '同步进行中，请稍候完成后再操作')
    )
  }, [abortActiveSyncFlow, isPlanning, isSyncing, t, toast])

  useEffect(() => {
    if (!isBusy) return
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      handleBlockingBack()
      return true
    })
    return () => subscription.remove()
  }, [handleBlockingBack, isBusy])

  const blockingTitle = isPlanning
    ? t('data_sync.planning', '正在分析同步变更…')
    : t('data_sync.syncing', '同步中…')

  const actionsValue = useMemo(
    () => ({
      isSyncing,
      isPlanning,
      isPlanDialogOpen: planDialogOpen,
      isBusy,
      isConfigured,
      isEnabled,
      refreshConfigured,
      runIncrementalSync
    }),
    [
      isBusy,
      isConfigured,
      isEnabled,
      isPlanning,
      isSyncing,
      planDialogOpen,
      refreshConfigured,
      runIncrementalSync
    ]
  )

  return (
    <IncrementalSyncActionsContext.Provider value={actionsValue}>
      <View style={styles.root}>
        {children}
        <IncrementalSyncOverlayHost
          ref={overlayRef}
          isSyncing={showProgressOverlay}
          blocking={showBlockingOverlay}
          blockingTitle={blockingTitle}
          onRequestClose={handleBlockingBack}
        />
        <IncrementalSyncConfirmDialog
          visible={planDialogOpen}
          preview={planPreview}
          confirmEligibleAtMs={planConfirmEligibleAt}
          isConfirming={isConfirmingPlan}
          onConfirm={(choice) => void confirmSyncPlan(choice)}
          onCancel={clearPlanPreview}
        />
      </View>
    </IncrementalSyncActionsContext.Provider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
})
