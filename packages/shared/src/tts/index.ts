export { TtsProviderRegistry } from './tts.registry';
export { OpenAiTtsProvider } from './openai-tts.provider';
export { MimoTtsProvider } from './mimo-tts.provider';
export {
  TtsNotConfiguredError,
  TtsProviderNotFoundError,
  TtsApiError,
  TtsInvalidResponseError,
} from './tts.errors';
export type {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderSettings,
  TtsProviderConfig,
  TtsSettings,
} from '../types/tts.types';
