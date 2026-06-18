import { describe, expect, it, beforeEach } from 'vitest'
import { TtsSynthesisCache, buildTtsSynthesisCacheKey } from '../tts-synthesis-cache'

describe('TtsSynthesisCache', () => {
  let cache: TtsSynthesisCache

  const sampleKey = buildTtsSynthesisCacheKey({
    providerId: 'openai-tts',
    modelId: 'tts-1',
    voice: 'alloy',
    speed: 1,
    responseFormat: 'mp3',
    baseUrl: 'https://api.openai.com/v1',
    text: 'hello'
  })

  beforeEach(() => {
    cache = new TtsSynthesisCache()
  })

  it('stores and returns cached audio', () => {
    cache.set(sampleKey, { audioBase64: 'abc', format: 'mp3' })
    expect(cache.get(sampleKey)).toEqual({ audioBase64: 'abc', format: 'mp3' })
  })

  it('evicts oldest entry when capacity exceeded', () => {
    for (let i = 0; i < 65; i++) {
      const key = buildTtsSynthesisCacheKey({
        providerId: 'openai-tts',
        modelId: 'tts-1',
        voice: 'alloy',
        speed: 1,
        responseFormat: 'mp3',
        baseUrl: 'https://api.openai.com/v1',
        text: `chunk-${i}`
      })
      cache.set(key, { audioBase64: `audio-${i}`, format: 'mp3' })
    }

    expect(cache.size).toBe(64)
    expect(cache.get(sampleKey)).toBeNull()
  })
})
