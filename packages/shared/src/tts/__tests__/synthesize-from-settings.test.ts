import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  CloneTtsProvider,
  GptSovitsProvider,
  MimoTtsProvider,
  OpenAiTtsProvider,
  TtsProviderRegistry
} from '../index'
import { synthesizeTtsFromFormConfig, synthesizeTtsFromSettings } from '../synthesize-from-settings'

describe('synthesizeTtsFromSettings', () => {
  let registry: TtsProviderRegistry

  beforeEach(() => {
    registry = new TtsProviderRegistry()
    registry.register(new OpenAiTtsProvider())
    registry.register(new MimoTtsProvider())
    registry.register(new CloneTtsProvider())
    registry.register(new GptSovitsProvider())
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
          responseFormat: 'wav'
        }
      } as any,
      text: '你好'
    })

    expect(result).toEqual({
      success: true,
      audioBase64: 'global-config-audio',
      format: 'wav'
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer global-key'
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
          responseFormat: 'wav'
        }
      } as any,
      text: '你好'
    })

    expect(result).toEqual({
      success: true,
      audioBase64: 'audio-data',
      format: 'wav'
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key'
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
        responseFormat: 'wav'
      },
      '你好'
    )

    expect(result).toEqual({
      success: true,
      audioBase64: 'form-audio',
      format: 'wav'
    })
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://api.xiaomimimo.com/v1/chat/completions',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer form-key' })
      })
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
