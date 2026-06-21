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
import { InteractionManager, View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { IncrementalSyncProgressOverlay, useDialog, useNativeToast } from '@baishou/ui/native'
import { useRouter } from 'expo-router'
import type {
  IncrementalSyncProgress,
  IncrementalSyncResult
} from '../services/mobile-incremental-sync.service'
import { useBaishou } from './BaishouProvider'
import {
  logger,
  isIncrementalSyncReady,
  runIncrementalSyncWithDivergenceConfirmation
} from '@baishou/shared'
import { friendlyMobileSyncError } from '../utils/friendly-sync-error'

export type IncrementalSyncMode = 'sync' | 'uploadOnly' | 'downloadOnly'

type IncrementalSyncActionsValue = {
  isSyncing: boolean
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
  isConfigured: null,
  isEnabled: null,
  refreshConfigured: async () => {},
  runIncrementalSync: async () => undefined
})

export const useIncrementalSync = () => useContext(IncrementalSyncActionsContext)

const IncrementalSyncOverlayHost = forwardRef<IncrementalSyncOverlayHandle, { isSyncing: boolean }>(
  function IncrementalSyncOverlayHost({ isSyncing }, ref) {
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
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const [isEnabled, setIsEnabled] = useState<boolean | null>(null)
  const syncingRef = useRef(false)

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

  const runIncrementalSync = useCallback(
    async (mode: IncrementalSyncMode = 'sync'): Promise<IncrementalSyncResult | undefined> => {
      if (!services?.incrementalSyncService || !dbReady) {
        toast.showError(t('workspace.service_unavailable'))
        return undefined
      }

      if (syncingRef.current || isSyncing) return undefined

      syncingRef.current = true
      setIsSyncing(true)
      overlayRef.current?.publish({ phase: 'scanning', current: 0, total: 0 })

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
          const run = (runOptions?: { highDivergenceConfirmed?: boolean }) =>
            mode === 'downloadOnly'
              ? svc.downloadOnly(onProgress, runOptions)
              : svc.sync(onProgress, runOptions)
          const outcome = await runIncrementalSyncWithDivergenceConfirmation(
            run,
            confirmHighDivergence
          )
          return outcome
        })()

        if (!result) return undefined

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
    },
    [dbReady, dialog, isConfigured, isSyncing, router, services, t, toast]
  )

  const actionsValue = useMemo(
    () => ({
      isSyncing,
      isConfigured,
      isEnabled,
      refreshConfigured,
      runIncrementalSync
    }),
    [isConfigured, isEnabled, isSyncing, refreshConfigured, runIncrementalSync]
  )

  return (
    <IncrementalSyncActionsContext.Provider value={actionsValue}>
      <View style={styles.root}>
        {children}
        <IncrementalSyncOverlayHost ref={overlayRef} isSyncing={isSyncing} />
      </View>
    </IncrementalSyncActionsContext.Provider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
})
