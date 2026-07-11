import { useEffect, useState } from 'react'
import type { SharedMemoryCopyPreview } from '@baishou/shared'
import { useBaishou } from '../providers/BaishouProvider'

const previewCache = new Map<string, SharedMemoryCopyPreview>()
const MAX_PREVIEW_CACHE = 12

function previewCacheKey(
  vaultRevision: number,
  lookbackMonths: number,
  userCopyPrefix: string,
  locale?: string
): string {
  return `${vaultRevision}:${lookbackMonths}:${userCopyPrefix}:${locale ?? ''}`
}

function readPreviewCache(key: string): SharedMemoryCopyPreview | undefined {
  return previewCache.get(key)
}

function writePreviewCache(key: string, value: SharedMemoryCopyPreview): void {
  if (previewCache.size >= MAX_PREVIEW_CACHE) {
    const oldest = previewCache.keys().next().value
    if (oldest) previewCache.delete(oldest)
  }
  previewCache.set(key, value)
}

export function useSharedMemoryCopyPreview(
  lookbackMonths: number,
  enabled = true,
  options?: { userCopyPrefix?: string; locale?: string }
) {
  const { services, vaultRevision } = useBaishou()
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

    const cacheKey = previewCacheKey(vaultRevision, lookbackMonths, userCopyPrefix, locale)
    const cached = readPreviewCache(cacheKey)
    if (cached) {
      setPreview(cached)
      setLoading(false)
      return undefined
    }

    let cancelled = false
    setLoading(true)

    const timer = setTimeout(() => {
      void services
        .buildSharedContextPreview(lookbackMonths, { userCopyPrefix, locale })
        .then((next) => {
          if (cancelled) return
          writePreviewCache(cacheKey, next)
          setPreview(next)
        })
        .catch(() => {
          if (!cancelled) setPreview(null)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 150)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [lookbackMonths, enabled, services, userCopyPrefix, locale, vaultRevision])

  return { preview, loading }
}
