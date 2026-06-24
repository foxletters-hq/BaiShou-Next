import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchTtsProviderModels, TtsFetchModelsError } from '../fetch-tts-models'

describe('fetchTtsProviderModels', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('throws for unknown provider id', async () => {
    await expect(fetchTtsProviderModels('unknown-tts', '', '')).rejects.toBeInstanceOf(
      TtsFetchModelsError
    )
  })

  it('returns openai tts fallback models when base url is empty', async () => {
    const models = await fetchTtsProviderModels('openai-tts', '', '')
    expect(models).toEqual(['tts-1', 'tts-1-hd'])
  })

  it('returns mimo default models when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')))
    const models = await fetchTtsProviderModels('mimo-tts', 'key', '')
    expect(models).toEqual([
      'mimo-v2.5-tts',
      'mimo-v2.5-tts-voicedesign',
      'mimo-v2.5-tts-voiceclone'
    ])
  })

  it('returns minimax built-in models', async () => {
    const models = await fetchTtsProviderModels('minimax-tts', 'key', '')
    expect(models).toEqual([
      'speech-2.8-hd',
      'speech-2.8-turbo',
      'speech-2.6-hd',
      'speech-2.6-turbo',
      'speech-02-hd',
      'speech-02-turbo',
      'speech-01-hd',
      'speech-01-turbo'
    ])
  })

  it('parses clone-tts voice list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ voices: ['voice-a', 'voice-b'] })
      })
    )

    const models = await fetchTtsProviderModels('clone-tts', '', 'http://127.0.0.1:8080')
    expect(models).toEqual(['voice-a', 'voice-b'])
  })

  it('returns default for gpt-sovits when config is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })
    )

    const models = await fetchTtsProviderModels('gpt-sovits', '', 'http://127.0.0.1:9872')
    expect(models).toEqual(['default'])
  })
})
