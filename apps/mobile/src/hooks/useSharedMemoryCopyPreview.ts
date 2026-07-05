import { useEffect, useState } from 'react'
import type { SharedMemoryCopyPreview } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

export function useSharedMemoryCopyPreview(
  lookbackMonths: number,
  enabled = true,
  options?: { userCopyPrefix?: string; locale?: string }
) {
  const { services } = useBaishou()
  const [preview, setPreview] = useState<SharedMemoryCopyPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const userCopyPrefix = options?.userCopyPrefix ?? ''
  const locale = options?.locale

  useEffect(() => {
    if (!enabled || !services?.buildSharedContextPreview) {
      setPreview(null)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    const timer = setTimeout(() => {
      void services
        .buildSharedContextPreview(lookbackMonths, { userCopyPrefix, locale })
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
      clearTimeout(timer)
    }
  }, [lookbackMonths, enabled, services, userCopyPrefix, locale])

  return { preview, loading }
}
