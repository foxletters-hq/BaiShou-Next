import { useCallback } from 'react'
import type { IFileSystem } from '@baishou/core-mobile'
import {
  resolveAttachmentImageDataUri,
  resolveDisplayFallbackUri
} from '../utils/mobile-attachment-image-resolver'
import {
  type AttachmentImagePurpose,
  clearAllAttachmentImageCaches,
  getAttachmentImageCache
} from '../utils/mobile-attachment-image-cache'
import { normalizeExternalStoragePath } from '../utils/mobile-attachment-display-path.util'

const MAX_CONCURRENT_LOADS = 6
let activeLoads = 0
const waitQueue: Array<() => void> = []

function acquireLoadSlot(): Promise<void> {
  if (activeLoads < MAX_CONCURRENT_LOADS) {
    activeLoads += 1
    return Promise.resolve()
  }
  return new Promise((resolve) => {
    waitQueue.push(() => {
      activeLoads += 1
      resolve()
    })
  })
}

function releaseLoadSlot(): void {
  activeLoads = Math.max(0, activeLoads - 1)
  const next = waitQueue.shift()
  next?.()
}

function buildCacheKey(purpose: AttachmentImagePurpose, filePath: string): string {
  return `${purpose}:${normalizeExternalStoragePath(filePath)}`
}

export function useAttachmentImageLoader(fileSystem: IFileSystem | undefined) {
  const loadImageUri = useCallback(
    async (
      filePath: string,
      purpose: AttachmentImagePurpose = 'thumbnail'
    ): Promise<string | null> => {
      const cacheKey = buildCacheKey(purpose, filePath)
      const cache = getAttachmentImageCache(purpose)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      if (!fileSystem) return resolveDisplayFallbackUri(filePath)

      await acquireLoadSlot()
      try {
        const hit = cache.get(cacheKey)
        if (hit) return hit

        const dataUri = await resolveAttachmentImageDataUri(fileSystem, filePath, purpose)
        if (dataUri) {
          cache.set(cacheKey, dataUri)
          return dataUri
        }
        return resolveDisplayFallbackUri(filePath)
      } catch (e) {
        console.warn('Load attachment image failed', e)
        return resolveDisplayFallbackUri(filePath)
      } finally {
        releaseLoadSlot()
      }
    },
    [fileSystem]
  )

  const clearImageCache = useCallback(() => {
    clearAllAttachmentImageCaches()
  }, [])

  return { loadImageUri, clearImageCache }
}
