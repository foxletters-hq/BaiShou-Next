import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  createDefaultTtsRegistry,
  clearGlobalTtsSynthesisCache,
  clearMimoRefAudioHydrationCache
} from '../index'
import { synthesizeTtsFromFormConfig, synthesizeTtsFromSettings } from '../synthesize-from-settings'
import { registerTtsRefAudioBase64Reader, registerTtsRefAudioReader } from '../tts-ref-audio.util'
import { uint8ArrayToBase64 } from '../bytes-base64'

function mockWavBytes(payload?: string): Uint8Array {
  const bytes = new Uint8Array(1200)
  bytes[0] = 0x52
  bytes[1] = 0x49
  bytes[2] = 0x46
  bytes[3] = 0x46
  bytes[8] = 0x57
  bytes[9] = 0x41
  bytes[10] = 0x56
  bytes[11] = 0x45
  if (payload) {
    const encoded = new TextEncoder().encode(payload)
    bytes.set(encoded.slice(0, Math.min(encoded.length, 64)), 128)
  }
  return bytes
}

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn()
}))

describe('synthesizeTtsFromSettings', () => {
  let registry: ReturnType<typeof createDefaultTtsRegistry>

  beforeEach(() => {
    registry = createDefaultTtsRegistry()
    registerTtsRefAudioReader(null)
    registerTtsRefAudioBase64Reader(null)
    clearGlobalTtsSynthesisCache()
    clearMimoRefAudioHydrationCache()
    vi.restoreAllMocks()
  })

  it('returns tts_not_configured when global models are missing', async () => {
    const result = await synthesizeTtsFromSettings(registry, {
      globalModels: { globalTtsProviderId: '', globalTtsModelId: '' } as any,
      text: 'hello'
    })
    expect(result).toEqual({ success: false, errorCode: 'tts_not_configured' })
  })

  it('reads credentials from globalTtsProviderConfigs', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { audio: { data: 'global-config-audio' } } }]
      })
    } as Response)

    const result = await synthesizeTtsFromSettings(registry, {
      globalModels: {
        globalTtsProviderId: 'mimo-tts',
        globalTtsModelId: 'mimo-v2.5-tts',
        globalTtsProviderConfigs: {
          'mimo-tts': { baseUrl: '', apiKey: 'global-key' }
        },
        globalTtsSettings: {
          voice: '冰糖',
          speed: 1,
          responseFormat: 'wav',
          stream: false
        }
      } as any,
      text: '你好'
    })

    expect(result).toEqual({
      success: true,
      audioBase64: 'global-config-audio',
      format: 'wav',
      fromCache: false
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          'api-key': 'global-key'
        })
      })
    )
  })

  it('uses global_models settings and resolves MiMo base URL like desktop IPC', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { audio: { data: 'audio-data' } } }]
      })
    } as Response)

    const result = await synthesizeTtsFromSettings(registry, {
      globalModels: {
        globalTtsProviderId: 'mimo-tts',
        globalTtsModelId: 'mimo-v2.5-tts',
        globalTtsProviderConfigs: {
          'mimo-tts': { baseUrl: '', apiKey: 'test-key' }
        },
        globalTtsSettings: {
          voice: '冰糖',
          speed: 1,
          responseFormat: 'wav',
          stream: false
        }
      } as any,
      text: '你好'
    })

    expect(result).toEqual({
      success: true,
      audioBase64: 'audio-data',
      format: 'wav',
      fromCache: false
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'api-key': 'test-key'
        })
      })
    )
  })

  it('synthesizes from form config without saved global_models', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { audio: { data: 'form-audio' } } }]
      })
    } as Response)

    const result = await synthesizeTtsFromFormConfig(
      registry,
      {
        id: 'mimo-tts',
        modelId: 'mimo-v2.5-tts',
        baseUrl: '',
        apiKey: 'form-key',
        voice: '冰糖',
        responseFormat: 'wav',
        stream: false
      },
      '你好'
    )

    expect(result).toEqual({
      success: true,
      audioBase64: 'form-audio',
      format: 'wav',
      fromCache: false
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ 'api-key': 'form-key' })
      })
    )
  })

  it('uses voice clone ref audio from provider config when global model is still preset', async () => {
    const refAudioBytes = mockWavBytes('clone-sample')
    registerTtsRefAudioReader(async () => refAudioBytes)
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { audio: { data: 'cloned-audio' } } }]
      })
    } as Response)

    const result = await synthesizeTtsFromSettings(registry, {
      globalModels: {
        globalTtsProviderId: 'mimo-tts',
        globalTtsModelId: 'mimo-v2.5-tts',
        globalTtsProviderConfigs: {
          'mimo-tts': {
            baseUrl: '',
            apiKey: 'clone-key',
            refAudioPath: '/storage/emulated/0/BaiShou_Root/tts-ref-audio/sample.wav'
          }
        },
        globalTtsSettings: {
          voice: '冰糖',
          speed: 1,
          responseFormat: 'wav',
          stream: false
        }
      } as any,
      text: '你好'
    })

    expect(result).toEqual({
      success: true,
      audioBase64: 'cloned-audio',
      format: 'wav',
      fromCache: false
    })

    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(requestBody.model).toBe('mimo-v2.5-tts-voiceclone')
    expect(requestBody.audio.voice).toBe(
      `data:audio/wav;base64,${uint8ArrayToBase64(refAudioBytes)}`
    )
  })

  it('uses voice clone ref audio from provider config when global settings were overwritten', async () => {
    const refAudioBytes = mockWavBytes('clone-sample')
    registerTtsRefAudioReader(async () => refAudioBytes)
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { audio: { data: 'cloned-audio' } } }]
      })
    } as Response)

    const result = await synthesizeTtsFromSettings(registry, {
      globalModels: {
        globalTtsProviderId: 'mimo-tts',
        globalTtsModelId: 'mimo-v2.5-tts-voiceclone',
        globalTtsProviderConfigs: {
          'mimo-tts': {
            baseUrl: '',
            apiKey: 'clone-key',
            modelId: 'mimo-v2.5-tts-voiceclone',
            refAudioPath: '/storage/emulated/0/BaiShou_Root/tts-ref-audio/sample.wav'
          }
        },
        globalTtsSettings: {
          voice: '冰糖',
          speed: 1,
          responseFormat: 'wav',
          stream: false
        }
      } as any,
      text: '你好'
    })

    expect(result).toEqual({
      success: true,
      audioBase64: 'cloned-audio',
      format: 'wav',
      fromCache: false
    })

    const requestBody = JSON.parse(String(fetchSpy.mock.calls[0]?.[1]?.body))
    expect(requestBody.model).toBe('mimo-v2.5-tts-voiceclone')
    expect(requestBody.audio.voice).toBe(
      `data:audio/wav;base64,${uint8ArrayToBase64(refAudioBytes)}`
    )
  })

  it('allows providerId and modelId overrides like desktop settings test', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { audio: { data: 'audio-data' } } }]
      })
    } as Response)

    await synthesizeTtsFromSettings(registry, {
      globalModels: {
        globalTtsProviderId: 'openai-tts',
        globalTtsModelId: 'tts-1',
        globalTtsProviderConfigs: {
          'mimo-tts': { baseUrl: '', apiKey: 'test-key' }
        },
        globalTtsSettings: { voice: 'alloy', responseFormat: 'mp3' }
      } as any,
      text: '你好',
      providerId: 'mimo-tts',
      modelId: 'mimo-v2.5-tts'
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        body: expect.stringContaining('mimo-v2.5-tts')
      })
    )
  })
})
