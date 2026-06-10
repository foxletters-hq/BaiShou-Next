import { describe, it, expect } from 'vitest'
import {
  buildTtsSettingsInitialConfig,
  getTtsInitialConfigs,
  mergeTtsPersistedConfigs,
  resolveTtsProviderBaseUrl
} from '../tts-defaults'

describe('tts-defaults', () => {
  it('resolveTtsProviderBaseUrl uses MiMo default when baseUrl is empty', () => {
    expect(resolveTtsProviderBaseUrl('mimo-tts', '')).toBe('https://api.xiaomimimo.com/v1')
    expect(resolveTtsProviderBaseUrl('openai-tts', '')).toBe('https://api.openai.com/v1')
  })

  it('getTtsInitialConfigs pre-fills MiMo defaults', () => {
    const configs = getTtsInitialConfigs()
    expect(configs['mimo-tts']).toMatchObject({
      baseUrl: 'https://api.xiaomimimo.com/v1',
      modelId: 'mimo-v2.5-tts',
      voice: '冰糖',
      responseFormat: 'wav'
    })
  })

  it('mergeTtsPersistedConfigs keeps defaults when persisted fields are empty strings', () => {
    const merged = mergeTtsPersistedConfigs({
      'mimo-tts': { modelId: '', voice: '', baseUrl: '' }
    })
    expect(merged['mimo-tts']).toMatchObject({
      baseUrl: 'https://api.xiaomimimo.com/v1',
      modelId: 'mimo-v2.5-tts',
      voice: '冰糖'
    })
  })

  it('buildTtsSettingsInitialConfig applies global settings for active global provider', () => {
    const config = buildTtsSettingsInitialConfig({
      activeProviderId: 'mimo-tts',
      globalTtsProviderId: 'mimo-tts',
      globalTtsModelId: 'mimo-v2.5-tts',
      globalTtsSettings: { voice: '自定义', speed: 1.2, responseFormat: 'wav' },
      persisted: getTtsInitialConfigs()
    })
    expect(config).toMatchObject({
      id: 'mimo-tts',
      modelId: 'mimo-v2.5-tts',
      voice: '自定义',
      speed: 1.2
    })
  })

  it('buildTtsSettingsInitialConfig uses persisted defaults for non-global provider', () => {
    const config = buildTtsSettingsInitialConfig({
      activeProviderId: 'mimo-tts',
      globalTtsProviderId: 'openai-tts',
      globalTtsModelId: 'tts-1',
      globalTtsSettings: { voice: 'alloy' },
      persisted: getTtsInitialConfigs()
    })
    expect(config).toMatchObject({
      id: 'mimo-tts',
      baseUrl: 'https://api.xiaomimimo.com/v1',
      modelId: 'mimo-v2.5-tts',
      voice: '冰糖'
    })
  })
})
