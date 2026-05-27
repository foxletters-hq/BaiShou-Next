import type { TtsProviderConfig } from './tts-provider-settings.types'

export const TTS_PROVIDERS = [
  { id: 'openai-tts', label: 'OpenAI TTS' },
  { id: 'mimo-tts', label: 'MiMo TTS' },
  { id: 'clone-tts', label: 'Clone TTS' },
  { id: 'gpt-sovits', label: 'GPT-SoVITS' }
] as const

export const TTS_FORMATS = [
  { id: 'mp3', label: 'MP3' },
  { id: 'wav', label: 'WAV' },
  { id: 'aac', label: 'AAC' }
] as const

export const DEFAULT_TTS_CONFIG: TtsProviderConfig = {
  id: 'openai-tts',
  name: '',
  baseUrl: '',
  apiKey: '',
  modelId: '',
  voice: '',
  speed: 1.0,
  responseFormat: 'mp3'
}
