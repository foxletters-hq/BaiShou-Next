import { useCallback } from 'react'
import type { IFileSystem } from '@baishou/core-mobile'
import { guessImageMimeType } from '@baishou/ui/native'
import { toFileUri } from '../services/android-external-fs'
import {
  type AttachmentImagePurpose,
  ATTACHMENT_PREVIEW_MAX_BYTES,
  ATTACHMENT_THUMB_MAX_BYTES,
  clearAllAttachmentImageCaches,
  getAttachmentImageCache
} from '../utils/mobile-attachment-image-cache'

const MAX_CONCURRENT_LOADS = 3
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

async function readImageDataUri(
  fileSystem: IFileSystem,
  filePath: string,
  purpose: AttachmentImagePurpose
): Promise<string | null> {
  const fileName = filePath.split('/').pop() || 'image.jpg'
  const maxBytes = purpose === 'preview' ? ATTACHMENT_PREVIEW_MAX_BYTES : ATTACHMENT_THUMB_MAX_BYTES

  const stat = await fileSystem.stat(filePath).catch(() => null)
  if (stat?.isFile && (stat.size ?? 0) > maxBytes) {
    return null
  }

  const b64 = await fileSystem.readFile(filePath, 'base64')
  return `data:${guessImageMimeType(fileName)};base64,${b64}`
}

export function useAttachmentImageLoader(fileSystem: IFileSystem | undefined) {
  const loadImageUri = useCallback(
    async (filePath: string, purpose: AttachmentImagePurpose = 'thumbnail'): Promise<string | null> => {
      const cacheKey = `${purpose}:${filePath}`
      const cache = getAttachmentImageCache(purpose)
      const cached = cache.get(cacheKey)
      if (cached) return cached

      if (!fileSystem) return toFileUri(filePath)

      await acquireLoadSlot()
      try {
        const hit = cache.get(cacheKey)
        if (hit) return hit

        const dataUri = await readImageDataUri(fileSystem, filePath, purpose)
        if (dataUri) {
          cache.set(cacheKey, dataUri)
          return dataUri
        }
        // 缩略图过大时不强行读入内存，仅保留图标 + 点击后 preview 加载
        if (purpose === 'thumbnail') return null
        return toFileUri(filePath)
      } catch (e) {
        console.warn('Load attachment image failed', e)
        return toFileUri(filePath)
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
