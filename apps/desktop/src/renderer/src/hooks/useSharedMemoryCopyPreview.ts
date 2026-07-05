import { useEffect, useState } from 'react'
import type { SharedMemoryCopyPreview } from '@baishou/shared'

async function fetchSharedMemoryCopyPreview(
  lookbackMonths: number
): Promise<SharedMemoryCopyPreview | null> {
  const api = (window as any).api
  const preview =
    (await api?.summary?.buildSharedContextPreview?.(lookbackMonths)) ??
    (await api?.rag?.buildSharedContextPreview?.(lookbackMonths))
  return preview ?? null
}

export function useSharedMemoryCopyPreview(lookbackMonths: number, enabled = true) {
  const [preview, setPreview] = useState<SharedMemoryCopyPreview | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setPreview(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    const timer = window.setTimeout(() => {
      void fetchSharedMemoryCopyPreview(lookbackMonths)
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
  }, [lookbackMonths, enabled])

  return { preview, loading }
}
