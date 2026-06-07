import type { ProviderLocalState } from './tts-provider-settings.types'

export const TTS_PROVIDER_IDS = ['openai-tts', 'mimo-tts', 'clone-tts', 'gpt-sovits'] as const

export type TtsProviderId = (typeof TTS_PROVIDER_IDS)[number]

export function isTtsProviderId(id: string): id is TtsProviderId {
  return (TTS_PROVIDER_IDS as readonly string[]).includes(id)
}

export function getInitialConfigs(): Record<string, ProviderLocalState> {
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
  return defaults
}

export function mergePersistedConfigs(
  persisted: Record<string, Partial<ProviderLocalState>> | null | undefined
): Record<string, ProviderLocalState> {
  const defaults = getInitialConfigs()
  if (!persisted) return defaults
  return {
    'openai-tts': { ...defaults['openai-tts'], ...persisted['openai-tts'] },
    'mimo-tts': { ...defaults['mimo-tts'], ...persisted['mimo-tts'] },
    'clone-tts': { ...defaults['clone-tts'], ...persisted['clone-tts'] },
    'gpt-sovits': { ...defaults['gpt-sovits'], ...persisted['gpt-sovits'] }
  }
}
