import { useEffect, useState, useSyncExternalStore } from 'react'
import type { SharedMemoryCopyPreview } from '@baishou/shared'
import {
  getSummaryDashboardCacheVersion,
  subscribeSummaryDashboardCache
} from '../lib/summary-dashboard-cache'

async function fetchSharedMemoryCopyPreview(
  lookbackMonths: number,
  options?: { userCopyPrefix?: string; locale?: string }
): Promise<SharedMemoryCopyPreview | null> {
  const api = (window as any).api
  const preview =
    (await api?.summary?.buildSharedContextPreview?.(lookbackMonths, options)) ??
    (await api?.rag?.buildSharedContextPreview?.(lookbackMonths, options))
  return preview ?? null
}

export function useSharedMemoryCopyPreview(
  lookbackMonths: number,
  enabled = true,
  options?: { userCopyPrefix?: string; locale?: string }
) {
  const [preview, setPreview] = useState<SharedMemoryCopyPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const userCopyPrefix = options?.userCopyPrefix ?? ''
  const locale = options?.locale
  const cacheVersion = useSyncExternalStore(
    subscribeSummaryDashboardCache,
    getSummaryDashboardCacheVersion
  )

  useEffect(() => {
    if (!enabled) {
      setPreview(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    const timer = window.setTimeout(() => {
      void fetchSharedMemoryCopyPreview(lookbackMonths, { userCopyPrefix, locale })
        .then((next) => {
          if (!cancelled) setPreview(next)
        })
        .catch(() => {
          if (!cancelled) setPreview(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 280)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [lookbackMonths, enabled, userCopyPrefix, locale, cacheVersion])

  return { preview, loading }
}
