export type SessionMessageCacheEntry = {
  messages: any[]
  loadedFromEnd: number
  roundWindowStart: number
  fetchHasMore: boolean
  compactionAnchor: {
    messageId: string
    record: Record<string, unknown>
  } | null
}

const SESSION_CACHE_LIMIT = 5

class SessionMessageLruCache {
  private readonly map = new Map<string, SessionMessageCacheEntry>()

  get(sessionId: string): SessionMessageCacheEntry | undefined {
    const entry = this.map.get(sessionId)
    if (!entry) return undefined
    this.map.delete(sessionId)
    this.map.set(sessionId, entry)
    return entry
  }

  set(sessionId: string, entry: SessionMessageCacheEntry): void {
    if (this.map.has(sessionId)) {
      this.map.delete(sessionId)
    }
    this.map.set(sessionId, entry)
    while (this.map.size > SESSION_CACHE_LIMIT) {
      const oldest = this.map.keys().next().value
      if (oldest === undefined) break
      this.map.delete(oldest)
    }
  }

  delete(sessionId: string): void {
    this.map.delete(sessionId)
  }

  clear(): void {
    this.map.clear()
  }
}

export const chatSessionMessageCache = new SessionMessageLruCache()
