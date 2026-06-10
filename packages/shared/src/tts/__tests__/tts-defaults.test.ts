import { describe, it, expect } from 'vitest'
import {
  buildTtsProviderStatesFromGlobal,
  buildTtsSettingsInitialConfig,
  getTtsInitialConfigs,
  mergeTtsPersistedConfigs,
  resolveTtsProviderBaseUrl
} from '../tts-defaults'
import { applyTtsSaveToGlobalModels } from '../save-tts-global-config'

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

  it('buildTtsProviderStatesFromGlobal restores availableModels from global_models', () => {
    const states = buildTtsProviderStatesFromGlobal({
      globalTtsProviderId: 'openai-tts',
      globalTtsModelId: 'tts-1-hd',
      globalTtsSettings: { voice: 'alloy', speed: 1, responseFormat: 'mp3' },
      globalTtsProviderConfigs: {
        'openai-tts': {
          baseUrl: 'https://proxy.example/v1',
          apiKey: 'sk-test',
          availableModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts']
        }
      }
    })
    expect(states['openai-tts']).toMatchObject({
      baseUrl: 'https://proxy.example/v1',
      modelId: 'tts-1-hd',
      availableModels: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts']
    })
  })

  it('applyTtsSaveToGlobalModels stores availableModels per provider', () => {
    const next = applyTtsSaveToGlobalModels(
      {
        globalDialogueProviderId: '',
        globalDialogueModelId: '',
        globalNamingProviderId: '',
        globalNamingModelId: '',
        globalSummaryProviderId: '',
        globalSummaryModelId: '',
        globalEmbeddingProviderId: '',
        globalEmbeddingModelId: '',
        globalTtsProviderId: '',
        globalTtsModelId: '',
        monthlySummarySource: 'weeklies'
      },
      {
        id: 'openai-tts',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: 'sk-test',
        modelId: 'tts-1',
        voice: 'alloy',
        speed: 1,
        responseFormat: 'mp3',
        availableModels: ['tts-1', 'tts-1-hd']
      }
    )
    expect(next.globalTtsProviderConfigs?.['openai-tts']).toMatchObject({
      availableModels: ['tts-1', 'tts-1-hd'],
      modelId: 'tts-1'
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
