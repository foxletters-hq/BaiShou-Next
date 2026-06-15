import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from 'react'
import { View, StyleSheet } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { IncrementalSyncProgressOverlay, useDialog, useNativeToast } from '@baishou/ui/native'
import { useRouter } from 'expo-router'
import type {
  IncrementalSyncProgress,
  IncrementalSyncResult
} from '../services/mobile-incremental-sync.service'
import { useBaishou } from './BaishouProvider'
import { logger } from '@baishou/shared'

export type IncrementalSyncMode = 'sync' | 'uploadOnly' | 'downloadOnly'

type IncrementalSyncContextValue = {
  isSyncing: boolean
  progress: IncrementalSyncProgress | null
  isConfigured: boolean | null
  refreshConfigured: () => Promise<void>
  runIncrementalSync: (mode?: IncrementalSyncMode) => Promise<IncrementalSyncResult | undefined>
}

const IncrementalSyncContext = createContext<IncrementalSyncContextValue>({
  isSyncing: false,
  progress: null,
  isConfigured: null,
  refreshConfigured: async () => {},
  runIncrementalSync: async () => undefined
})

export const useIncrementalSync = () => useContext(IncrementalSyncContext)

export function IncrementalSyncProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const dialog = useDialog()
  const router = useRouter()
  const insets = useSafeAreaInsets()
  const { services, dbReady } = useBaishou()

  const [isSyncing, setIsSyncing] = useState(false)
  const [progress, setProgress] = useState<IncrementalSyncProgress | null>(null)
  const [isConfigured, setIsConfigured] = useState<boolean | null>(null)
  const syncingRef = useRef(false)
  const progressThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingProgressRef = useRef<IncrementalSyncProgress | null>(null)

  const publishProgress = useCallback((p: IncrementalSyncProgress) => {
    pendingProgressRef.current = p
    if (progressThrottleRef.current) return
    setProgress(p)
    progressThrottleRef.current = setTimeout(() => {
      progressThrottleRef.current = null
      if (pendingProgressRef.current) {
        setProgress(pendingProgressRef.current)
        pendingProgressRef.current = null
      }
    }, 120)
  }, [])

  const flushProgress = useCallback(() => {
    if (progressThrottleRef.current) {
      clearTimeout(progressThrottleRef.current)
      progressThrottleRef.current = null
    }
    pendingProgressRef.current = null
  }, [])

  const refreshConfigured = useCallback(async () => {
    if (!services?.incrementalSyncService || !dbReady) {
      setIsConfigured(false)
      return
    }
    try {
      setIsConfigured(await services.incrementalSyncService.isConfigured())
    } catch {
      setIsConfigured(false)
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
      setProgress({ phase: 'scanning', current: 0, total: 0 })

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

        const svc = services.incrementalSyncService
        const onProgress = (p: IncrementalSyncProgress) => {
          if (p.phase === 'finalizing') {
            flushProgress()
            setProgress(p)
            return
          }
          publishProgress(p)
        }

        const result =
          mode === 'uploadOnly'
            ? await svc.uploadOnly(onProgress)
            : mode === 'downloadOnly'
              ? await svc.downloadOnly(onProgress)
              : await svc.sync(onProgress)

        flushProgress()
        syncingRef.current = false
        setIsSyncing(false)
        setProgress(null)

        toast.showSuccess(t('data_sync.sync_completed'))
        if (result.conflicts > 0) {
          toast.showWarning(
            t('data_sync.sync_result_conflicts').replace('$count', String(result.conflicts))
          )
        }
        return result
      } catch (e) {
        logger.error('增量同步失败', e instanceof Error ? e : String(e))
        toast.showError(e instanceof Error ? e.message : t('data_sync.sync_failed_generic'))
        throw e
      } finally {
        flushProgress()
        syncingRef.current = false
        setIsSyncing(false)
        setProgress(null)
      }
    },
    [
      dbReady,
      dialog,
      flushProgress,
      isConfigured,
      isSyncing,
      publishProgress,
      router,
      services,
      t,
      toast
    ]
  )

  return (
    <IncrementalSyncContext.Provider
      value={{
        isSyncing,
        progress,
        isConfigured,
        refreshConfigured,
        runIncrementalSync
      }}
    >
      <View style={styles.root}>
        {children}
        <IncrementalSyncProgressOverlay
          visible={isSyncing}
          progress={progress}
          topInset={insets.top + 48}
        />
      </View>
    </IncrementalSyncContext.Provider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  }
})
