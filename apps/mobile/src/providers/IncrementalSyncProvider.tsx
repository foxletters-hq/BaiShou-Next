import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  startTransition,
  type ReactNode
} from 'react'
import { InteractionManager, View, StyleSheet, BackHandler } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import {
  IncrementalSyncConfirmDialog,
  IncrementalSyncProgressOverlay,
  useDialog,
  useNativeToast
} from '@baishou/ui/native'
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
  assertSyncConfirmAllowed,
  canExecuteIncrementalSyncPlan,
  hasIncrementalSyncPlanMaterialChange,
  logger,
  isIncrementalSyncReady,
  resolvePlanConfirmEligibleAt,
  runIncrementalSyncWithDivergenceConfirmation,
  type IncrementalSyncRunOptions
} from '@baishou/shared'
import { friendlyMobileSyncError } from '../utils/friendly-sync-error'

export type IncrementalSyncMode = 'sync' | 'uploadOnly' | 'downloadOnly'

type IncrementalSyncActionsValue = {
  isSyncing: boolean
  isPlanning: boolean
  isPlanDialogOpen: boolean
  isBusy: boolean
  isConfigured: boolean | null
  /** 增量同步开关是否已打开（与设置页展示同步入口的条件一致） */
  isEnabled: boolean | null
  refreshConfigured: () => Promise<void>
  runIncrementalSync: (mode?: IncrementalSyncMode) => Promise<IncrementalSyncResult | undefined>
}

export type IncrementalSyncOverlayHandle = {
  publish: (progress: IncrementalSyncProgress) => void
  reset: () => void
}

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

const IncrementalSyncOverlayHost = forwardRef<
  IncrementalSyncOverlayHandle,
  {
    isSyncing: boolean
    blocking: boolean
    blockingTitle?: string
    onRequestClose?: () => void
  }
>(function IncrementalSyncOverlayHost(
  { isSyncing, blocking, blockingTitle, onRequestClose },
  ref
) {
    const insets = useSafeAreaInsets()
    const [progress, setProgress] = useState<IncrementalSyncProgress | null>(null)
    const progressThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const pendingProgressRef = useRef<IncrementalSyncProgress | null>(null)

    const flushProgress = useCallback(() => {
      if (progressThrottleRef.current) {
        clearTimeout(progressThrottleRef.current)
        progressThrottleRef.current = null
      }
      pendingProgressRef.current = null
    }, [])

    useImperativeHandle(
      ref,
      () => ({
        publish: (p: IncrementalSyncProgress) => {
          pendingProgressRef.current = p
          if (progressThrottleRef.current) return
          startTransition(() => setProgress(p))
          progressThrottleRef.current = setTimeout(() => {
            progressThrottleRef.current = null
            if (pendingProgressRef.current) {
              startTransition(() => setProgress(pendingProgressRef.current))
              pendingProgressRef.current = null
            }
          }, 280)
        },
        reset: () => {
          flushProgress()
          setProgress(null)
        }
      }),
      [flushProgress]
    )

    useEffect(() => {
      if (!isSyncing) {
        flushProgress()
        setProgress(null)
      }
    }, [flushProgress, isSyncing])

    return (
      <IncrementalSyncProgressOverlay
        visible={isSyncing}
        progress={progress}
        blocking={blocking}
        blockingTitle={blockingTitle}
        onRequestClose={onRequestClose}
        topInset={insets.top + 48}
      />
    )
  }
)

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
  const planConfirmEligibleAtRef = useRef<number | null>(null)
  const pendingModeRef = useRef<IncrementalSyncMode>('sync')
  const planGenerationRef = useRef(0)
  const syncingRef = useRef(false)
  const confirmingRef = useRef(false)

  const abortActiveSyncFlow = useCallback(() => {
    planGenerationRef.current += 1
    confirmingRef.current = false
    syncingRef.current = false
    setIsPlanning(false)
    setIsSyncing(false)
    setIsConfirmingPlan(false)
    setPlanPreview(null)
    setPlanDialogOpen(false)
    planConfirmEligibleAtRef.current = null
    overlayRef.current?.reset()
  }, [])

  const clearPlanPreview = useCallback(() => {
    setPlanPreview(null)
    setPlanDialogOpen(false)
    planConfirmEligibleAtRef.current = null
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
      mode: IncrementalSyncMode,
      runOptions?: IncrementalSyncRunOptions
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

      const result = await (async () => {
        if (mode === 'uploadOnly') {
          return svc.uploadOnly(onProgress)
        }
        const run = (options?: IncrementalSyncRunOptions) => {
          const merged = { ...runOptions, ...options }
          return mode === 'downloadOnly'
            ? svc.downloadOnly(onProgress, merged)
            : svc.sync(onProgress, merged)
        }
        return runIncrementalSyncWithDivergenceConfirmation(run, confirmHighDivergence)
      })()

      if (!result) return undefined

      if (services.vaultService) {
        await reconcileVaultRegistryForIncrementalSync(services.vaultService)
      }

      toast.showSuccess(t('data_sync.sync_completed'))
      if (result.conflicts > 0) {
        toast.showWarning(
          t('data_sync.sync_result_conflicts').replace('$count', String(result.conflicts))
        )
      }
      if (result.failed > 0) {
        toast.showWarning(
          t('data_sync.sync_result_partial_failed', {
            count: result.failed,
            defaultValue: '{{count}} 个文件同步失败，将在下次同步重试'
          })
        )
      }
      return result
    },
    [dialog, services, t, toast]
  )

  const confirmSyncPlan = useCallback(async () => {
    if (confirmingRef.current || syncingRef.current) return

    const stalePreview = planPreview
    if (!stalePreview || !services?.incrementalSyncService || !services.vaultService) return

    const canExecute = canExecuteIncrementalSyncPlan(stalePreview)
    try {
      assertSyncConfirmAllowed({
        canExecuteSync: canExecute,
        eligibleAtMs: planConfirmEligibleAtRef.current
      })
    } catch {
      return
    }

    const initialRunOptions: IncrementalSyncRunOptions | undefined =
      stalePreview.requiresHighDivergenceConfirm ? { highDivergenceConfirmed: true } : undefined

    const mode = pendingModeRef.current
    confirmingRef.current = true
    setIsConfirmingPlan(true)

    let preview = stalePreview
    try {
      preview = await planIncrementalSyncWithVaultRegistry(
        {
          pathService: services.pathService,
          fileSystem: services.fileSystem,
          vaultService: services.vaultService,
          incrementalSyncService: services.incrementalSyncService
        },
        { runOptions: initialRunOptions }
      )

      if (preview.deletePropagationBlocked) {
        toast.showError(t('data_sync.plan_warning_delete_blocked'))
        setPlanPreview(preview)
        planConfirmEligibleAtRef.current = resolvePlanConfirmEligibleAt(preview)
        return
      }

      if (preview.changeCount === 0) {
        clearPlanPreview()
        if (preview.warnings.length === 0) {
          toast.showSuccess(t('data_sync.plan_up_to_date', '本地与云端已一致，无需同步'))
        }
        return
      }

      if (hasIncrementalSyncPlanMaterialChange(stalePreview, preview)) {
        setPlanPreview(preview)
        planConfirmEligibleAtRef.current = resolvePlanConfirmEligibleAt(preview)
        toast.showWarning(t('data_sync.plan_changed_reconfirm'))
        return
      }

      clearPlanPreview()
      syncingRef.current = true
      setIsSyncing(true)
      overlayRef.current?.publish({ phase: 'scanning', current: 0, total: 0 })

      try {
        await executeIncrementalSync(mode, initialRunOptions)
      } catch (e) {
        logger.error('增量同步失败', e instanceof Error ? e : String(e))
        const message = e instanceof Error ? e.message : t('data_sync.sync_failed_generic')
        toast.showError(friendlyMobileSyncError(message, t))
      } finally {
        syncingRef.current = false
        setIsSyncing(false)
        overlayRef.current?.reset()
      }
    } catch (e) {
      logger.error('增量同步预览失败', e instanceof Error ? e : String(e))
      const message = e instanceof Error ? e.message : t('data_sync.sync_failed_generic')
      toast.showError(friendlyMobileSyncError(message, t))
    } finally {
      confirmingRef.current = false
      setIsConfirmingPlan(false)
    }
  }, [clearPlanPreview, executeIncrementalSync, planPreview, services, t, toast])

  const runIncrementalSync = useCallback(
    async (mode: IncrementalSyncMode = 'sync'): Promise<IncrementalSyncResult | undefined> => {
      if (!services?.incrementalSyncService || !dbReady) {
        toast.showError(t('workspace.service_unavailable'))
        return undefined
      }

      if (
        syncingRef.current ||
        confirmingRef.current ||
        isSyncing ||
        isPlanning ||
        planDialogOpen
      ) {
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

        if (mode !== 'sync') {
          syncingRef.current = true
          setIsSyncing(true)
          overlayRef.current?.publish({ phase: 'scanning', current: 0, total: 0 })
          try {
            return await executeIncrementalSync(mode)
          } catch (e) {
            logger.error('增量同步失败', e instanceof Error ? e : String(e))
            const message = e instanceof Error ? e.message : t('data_sync.sync_failed_generic')
            toast.showError(friendlyMobileSyncError(message, t))
            return undefined
          } finally {
            syncingRef.current = false
            setIsSyncing(false)
            overlayRef.current?.reset()
          }
        }

        pendingModeRef.current = mode
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
          setPlanPreview(preview)
          setPlanDialogOpen(true)
          planConfirmEligibleAtRef.current = resolvePlanConfirmEligibleAt(preview)
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
    },
    [
      abortActiveSyncFlow,
      dbReady,
      dialog,
      executeIncrementalSync,
      isConfigured,
      isPlanning,
      isSyncing,
      planDialogOpen,
      router,
      services,
      t,
      toast
    ]
  )

  const showProgressOverlay = isSyncing || isPlanning || isConfirmingPlan
  const showBlockingOverlay = showProgressOverlay && !planDialogOpen
  const isBusy = isSyncing || isPlanning || isConfirmingPlan || planDialogOpen

  const handleBlockingBack = useCallback(() => {
    if (isPlanning) {
      abortActiveSyncFlow()
      toast.showInfo(t('data_sync.plan_cancelled', '已取消同步分析'))
      return
    }
    toast.showWarning(
      t('data_sync.sync_in_progress_leave_blocked', '同步进行中，请稍候完成后再操作')
    )
  }, [abortActiveSyncFlow, isPlanning, t, toast])

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
          isConfirming={isConfirmingPlan}
          onConfirm={() => void confirmSyncPlan()}
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
