import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  startTransition
} from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { IncrementalSyncProgressOverlay } from '@baishou/ui/native'
import type { IncrementalSyncProgress } from '../services/mobile-incremental-sync.service'
import { mergeIncrementalSyncProgress } from '../services/mobile-incremental-sync-progress.util'

export type IncrementalSyncOverlayHandle = {
  publish: (progress: IncrementalSyncProgress) => void
  reset: () => void
}

export const IncrementalSyncOverlayHost = forwardRef<
  IncrementalSyncOverlayHandle,
  {
    isSyncing: boolean
    blocking: boolean
    blockingTitle?: string
    onRequestClose?: () => void
  }
>(function IncrementalSyncOverlayHost({ isSyncing, blocking, blockingTitle, onRequestClose }, ref) {
  const insets = useSafeAreaInsets()
  const [progress, setProgress] = useState<IncrementalSyncProgress | null>(null)
  const progressThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingProgressRef = useRef<IncrementalSyncProgress | null>(null)
  const progressSnapshotRef = useRef<IncrementalSyncProgress | null>(null)

  const applyProgress = useCallback((incoming: IncrementalSyncProgress) => {
    const slice = mergeIncrementalSyncProgress(progressSnapshotRef.current, incoming)
    const merged: IncrementalSyncProgress = {
      current: slice.current ?? progressSnapshotRef.current?.current ?? incoming.current ?? 0,
      total: slice.total ?? progressSnapshotRef.current?.total ?? incoming.total ?? 0,
      ...slice
    }
    progressSnapshotRef.current = merged
    setProgress(merged)
  }, [])

  const flushProgress = useCallback(() => {
    if (progressThrottleRef.current) {
      clearTimeout(progressThrottleRef.current)
      progressThrottleRef.current = null
    }
    pendingProgressRef.current = null
    progressSnapshotRef.current = null
  }, [])

  useImperativeHandle(
    ref,
    () => ({
      publish: (p: IncrementalSyncProgress) => {
        pendingProgressRef.current = p
        const hasByteProgress = (p.fileBytesTotal ?? 0) > 0
        const hasStatusUpdate = Boolean(p.statusText)
        if (hasByteProgress || hasStatusUpdate) {
          if (progressThrottleRef.current) {
            clearTimeout(progressThrottleRef.current)
            progressThrottleRef.current = null
          }
          startTransition(() => applyProgress(p))
          return
        }
        if (progressThrottleRef.current) return
        startTransition(() => applyProgress(p))
        progressThrottleRef.current = setTimeout(() => {
          progressThrottleRef.current = null
          if (pendingProgressRef.current) {
            startTransition(() => applyProgress(pendingProgressRef.current!))
            pendingProgressRef.current = null
          }
        }, 280)
      },
      reset: () => {
        flushProgress()
        setProgress(null)
      }
    }),
    [applyProgress, flushProgress]
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
})
