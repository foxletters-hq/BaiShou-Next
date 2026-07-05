import type { TtsSynthesizeResponse } from '../types/tts.types'

export interface TtsSynthesisCacheKeyInput {
  providerId: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  baseUrl: string
  stream?: boolean
  refAudioPath?: string
  refAudioToken?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  text: string
}

export interface TtsSynthesisCacheEntry {
  audioBase64: string
  format: string
}

const MAX_CACHE_ENTRIES = 64

export function buildTtsSynthesisCacheKey(input: TtsSynthesisCacheKeyInput): string {
  return JSON.stringify({
    p: input.providerId,
    m: input.modelId,
    v: input.voice,
    s: input.speed,
    f: input.responseFormat,
    u: input.baseUrl,
    st: input.stream === true,
    r: input.refAudioToken || input.refAudioPath || '',
    pt: input.promptText || '',
    pl: input.promptLang || '',
    tl: input.textLang || '',
    t: input.text
  })
}

export class TtsSynthesisCache {
  private readonly entries = new Map<string, TtsSynthesisCacheEntry>()
  private readonly order: string[] = []

  get(key: string): TtsSynthesisCacheEntry | null {
    const hit = this.entries.get(key)
    if (!hit) return null

    const index = this.order.indexOf(key)
    if (index >= 0) {
      this.order.splice(index, 1)
      this.order.push(key)
    }

    return hit
  }

  set(key: string, value: TtsSynthesizeResponse): void {
    if (this.entries.has(key)) {
      const index = this.order.indexOf(key)
      if (index >= 0) this.order.splice(index, 1)
    } else if (this.order.length >= MAX_CACHE_ENTRIES) {
      const oldest = this.order.shift()
      if (oldest) this.entries.delete(oldest)
    }

    this.entries.set(key, {
      audioBase64: value.audioBase64,
      format: value.format
    })
    this.order.push(key)
  }

  clear(): void {
    this.entries.clear()
    this.order.length = 0
  }

  get size(): number {
    return this.entries.size
  }
}

let globalTtsSynthesisCache: TtsSynthesisCache | null = null

export function getGlobalTtsSynthesisCache(): TtsSynthesisCache {
  if (!globalTtsSynthesisCache) {
    globalTtsSynthesisCache = new TtsSynthesisCache()
  }
  return globalTtsSynthesisCache
}

export function clearGlobalTtsSynthesisCache(): void {
  globalTtsSynthesisCache?.clear()
}
