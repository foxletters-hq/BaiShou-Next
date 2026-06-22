/** RN 侧 attachment URL 解析缓存（I-9）：LRU + 并发去重 */

export interface DiaryCmAttachmentUrlCacheOptions {
  maxSize?: number
}

export class DiaryCmAttachmentUrlCache {
  private readonly cache = new Map<string, string>()
  private readonly inFlight = new Map<string, Promise<string | null>>()
  private readonly maxSize: number

  constructor(options: DiaryCmAttachmentUrlCacheOptions = {}) {
    this.maxSize = options.maxSize ?? 64
  }

  get(srcRaw: string): string | undefined {
    const hit = this.cache.get(srcRaw)
    if (hit === undefined) return undefined
    this.cache.delete(srcRaw)
    this.cache.set(srcRaw, hit)
    return hit
  }

  set(srcRaw: string, url: string): void {
    if (this.cache.has(srcRaw)) this.cache.delete(srcRaw)
    this.cache.set(srcRaw, url)
    while (this.cache.size > this.maxSize) {
      const oldest = this.cache.keys().next().value
      if (oldest === undefined) break
      this.cache.delete(oldest)
    }
  }

  resolve(
    srcRaw: string,
    resolver: (srcRaw: string) => Promise<string | null>
  ): Promise<string | null> {
    const cached = this.get(srcRaw)
    if (cached !== undefined) return Promise.resolve(cached)

    const pending = this.inFlight.get(srcRaw)
    if (pending) return pending

    const promise = resolver(srcRaw)
      .then((url) => {
        this.inFlight.delete(srcRaw)
        if (url) this.set(srcRaw, url)
        return url
      })
      .catch((error) => {
        this.inFlight.delete(srcRaw)
        throw error
      })

    this.inFlight.set(srcRaw, promise)
    return promise
  }

  clear(): void {
    this.cache.clear()
    this.inFlight.clear()
  }
}
