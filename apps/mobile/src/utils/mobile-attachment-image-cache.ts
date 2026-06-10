/** 缩略图 LRU：约等于当前页 + 邻近页（默认每页 10 条，缓存 40 张） */
export const ATTACHMENT_THUMB_CACHE_LIMIT = 40

/** 全屏预览 LRU：仅保留最近几次预览 */
export const ATTACHMENT_PREVIEW_CACHE_LIMIT = 3

/** 缩略图：超过此大小不读入 base64，避免大图撑爆内存 */
export const ATTACHMENT_THUMB_MAX_BYTES = 2 * 1024 * 1024

/** 全屏预览：超过此大小提示过大，仍尝试 file:// 回退 */
export const ATTACHMENT_PREVIEW_MAX_BYTES = 12 * 1024 * 1024

export type AttachmentImagePurpose = 'thumbnail' | 'preview'

export class LruStringCache {
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

  get size(): number {
    return this.map.size
  }
}

const thumbCache = new LruStringCache(ATTACHMENT_THUMB_CACHE_LIMIT)
const previewCache = new LruStringCache(ATTACHMENT_PREVIEW_CACHE_LIMIT)

export function getAttachmentImageCache(
  purpose: AttachmentImagePurpose
): LruStringCache {
  return purpose === 'preview' ? previewCache : thumbCache
}

export function clearAllAttachmentImageCaches(): void {
  thumbCache.clear()
  previewCache.clear()
}
