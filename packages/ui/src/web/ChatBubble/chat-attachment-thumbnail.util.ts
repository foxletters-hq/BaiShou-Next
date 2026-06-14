import { resolveAttachmentAbsolutePath } from '@baishou/shared'
import { resolveChatAttachmentSrc } from './chat-bubble.utils'

export const CHAT_ATTACHMENT_THUMB_SIZE = 96

/** 缩略图 LRU：约等于当前会话多图 + 邻近会话残留 */
const CHAT_THUMB_CACHE_LIMIT = 48
/** 全图预览 LRU：仅保留最近几次预览 */
const CHAT_FULL_IMAGE_CACHE_LIMIT = 6

class LruStringCache {
  private readonly map = new Map<string, string>()

  constructor(private readonly maxSize: number) {}

  get(key: string): string | undefined {
    const value = this.map.get(key)
    if (value === undefined) return undefined
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key: string, value: string): void {
    if (this.map.has(key)) this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.maxSize) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  clear(): void {
    this.map.clear()
  }
}

const thumbCache = new LruStringCache(CHAT_THUMB_CACHE_LIMIT)
const fullImageCache = new LruStringCache(CHAT_FULL_IMAGE_CACHE_LIMIT)

/** 切换会话时调用，避免跨会话无限累积 data URL */
export function clearChatAttachmentImageCaches(): void {
  thumbCache.clear()
  fullImageCache.clear()
}

function isInlineImageSrc(filePath: string): boolean {
  return filePath.startsWith('blob:') || filePath.startsWith('data:')
}

function toAbsoluteFilePath(filePath: string): string {
  if (!filePath) return ''
  if (isInlineImageSrc(filePath)) return ''
  if (filePath.startsWith('local://')) {
    return resolveAttachmentAbsolutePath(filePath)
  }
  if (/^[a-zA-Z]:[\\/]/.test(filePath) || filePath.startsWith('/')) {
    return filePath
  }
  return resolveAttachmentAbsolutePath(resolveChatAttachmentSrc(filePath))
}

async function invokeGetThumbnail(filePath: string, maxSize: number): Promise<string | null> {
  const w = window as Window & {
    api?: { attachment?: { getThumbnail?: (p: string, s: number) => Promise<string | null> } }
    electron?: { ipcRenderer?: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }
  }
  if (w.api?.attachment?.getThumbnail) {
    return w.api.attachment.getThumbnail(filePath, maxSize)
  }
  if (w.electron?.ipcRenderer?.invoke) {
    return w.electron.ipcRenderer.invoke('attachment:getThumbnail', filePath, maxSize) as Promise<
      string | null
    >
  }
  return null
}

async function invokeGetFullImage(filePath: string): Promise<string | null> {
  const w = window as Window & {
    api?: { attachment?: { getFullImage?: (p: string) => Promise<string | null> } }
    electron?: { ipcRenderer?: { invoke: (ch: string, ...args: unknown[]) => Promise<unknown> } }
  }
  if (w.api?.attachment?.getFullImage) {
    return w.api.attachment.getFullImage(filePath)
  }
  if (w.electron?.ipcRenderer?.invoke) {
    return w.electron.ipcRenderer.invoke('attachment:getFullImage', filePath) as Promise<
      string | null
    >
  }
  return null
}

export function createClientImageThumbnail(
  src: string,
  maxSize: number = CHAT_ATTACHMENT_THUMB_SIZE
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      try {
        let { width, height } = img
        if (width <= 0 || height <= 0) {
          resolve(null)
          return
        }
        if (width > maxSize || height > maxSize) {
          const ratio = Math.min(maxSize / width, maxSize / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.72))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
}

export async function getChatAttachmentThumbnail(
  filePath: string,
  maxSize: number = CHAT_ATTACHMENT_THUMB_SIZE
): Promise<string | null> {
  if (!filePath) return null
  const cacheKey = `${filePath}@${maxSize}`
  const cached = thumbCache.get(cacheKey)
  if (cached) return cached

  let thumbnail: string | null = null

  if (isInlineImageSrc(filePath)) {
    thumbnail = await createClientImageThumbnail(filePath, maxSize)
  } else {
    const absolutePath = toAbsoluteFilePath(filePath)
    if (absolutePath) {
      thumbnail = await invokeGetThumbnail(absolutePath, maxSize)
    }
    if (!thumbnail) {
      const displaySrc = resolveChatAttachmentSrc(filePath)
      if (displaySrc) {
        thumbnail = await createClientImageThumbnail(displaySrc, maxSize)
      }
    }
  }

  if (thumbnail) {
    thumbCache.set(cacheKey, thumbnail)
  }
  return thumbnail
}

export async function getChatAttachmentFullImage(filePath: string): Promise<string | null> {
  if (!filePath) return null
  const cached = fullImageCache.get(filePath)
  if (cached) return cached

  let full: string | null = null

  if (isInlineImageSrc(filePath)) {
    full = filePath
  } else {
    const absolutePath = toAbsoluteFilePath(filePath)
    if (absolutePath) {
      full = await invokeGetFullImage(absolutePath)
    }
    if (!full) {
      full = resolveChatAttachmentSrc(filePath) || null
    }
  }

  if (full) {
    fullImageCache.set(filePath, full)
  }
  return full
}
