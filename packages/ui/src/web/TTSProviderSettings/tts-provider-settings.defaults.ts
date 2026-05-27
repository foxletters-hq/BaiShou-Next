import type { ProviderLocalState } from './tts-provider-settings.types'

export const getInitialConfigs = (): Record<string, ProviderLocalState> => {
  const defaults: Record<string, ProviderLocalState> = {
    'openai-tts': {
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelId: 'tts-1',
      voice: 'alloy',
      speed: 1.0,
      responseFormat: 'mp3',
      availableModels: []
    },
    'mimo-tts': {
      baseUrl: '',
      apiKey: '',
      modelId: 'mimo-v2.5-tts',
      voice: '冰糖',
      speed: 1.0,
      responseFormat: 'wav',
      availableModels: []
    },
    'clone-tts': {
      baseUrl: 'http://127.0.0.1:8080',
      apiKey: '',
      modelId: 'default',
      voice: 'default',
      speed: 1.0,
      responseFormat: 'mp3',
      availableModels: []
    },
    'gpt-sovits': {
      baseUrl: 'http://127.0.0.1:9880',
      apiKey: '',
      modelId: 'default',
      voice: 'default',
      speed: 1.0,
      responseFormat: 'wav',
      availableModels: [],
      refAudioPath: '',
      promptText: '',
      promptLang: 'zh',
      textLang: 'zh'
    }
  }
  try {
    const saved = localStorage.getItem('baishou_tts_provider_configs')
    if (saved) {
      const parsed = JSON.parse(saved)
      // 融合 defaults 以确保结构完整
      return {
        'openai-tts': { ...defaults['openai-tts'], ...parsed['openai-tts'] },
        'mimo-tts': { ...defaults['mimo-tts'], ...parsed['mimo-tts'] },
        'clone-tts': { ...defaults['clone-tts'], ...parsed['clone-tts'] },
        'gpt-sovits': { ...defaults['gpt-sovits'], ...parsed['gpt-sovits'] }
      }
    }
  } catch (e) {}
  return defaults
}
