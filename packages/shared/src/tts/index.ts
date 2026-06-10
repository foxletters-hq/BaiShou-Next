export {
  TTS_PROVIDER_IDS,
  TTS_DEFAULT_BASE_URLS,
  TTS_DEFAULT_MODEL_IDS,
  TTS_DEFAULT_VOICES,
  isTtsProviderId,
  getTtsDefaultBaseUrl,
  resolveTtsProviderBaseUrl,
  getTtsDefaultResponseFormat,
  getTtsInitialConfigs,
  mergeTtsPersistedConfigs,
  buildTtsSettingsInitialConfig,
  resolveTtsProviderCredentials
} from './tts-defaults'
export type { TtsProviderId, TtsProviderLocalState, TtsSettingsInitialConfig } from './tts-defaults'
export { synthesizeTtsFromSettings, synthesizeTtsFromFormConfig } from './synthesize-from-settings'
export type {
  TtsSynthesizeFromSettingsInput,
  TtsSynthesizeFromSettingsResult,
  TtsFormSynthesizeConfig
} from './synthesize-from-settings'
export { TtsProviderRegistry } from './tts.registry'
export { OpenAiTtsProvider } from './openai-tts.provider'
export { MimoTtsProvider } from './mimo-tts.provider'
export { CloneTtsProvider } from './clone-tts.provider'
export { GptSovitsProvider } from './gpt-sovits.provider'
export {
  TtsNotConfiguredError,
  TtsProviderNotFoundError,
  TtsApiError,
  TtsInvalidResponseError
} from './tts.errors'
export type {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderSettings,
  TtsProviderConfig,
  TtsSettings
} from '../types/tts.types'
