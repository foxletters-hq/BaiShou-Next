import { getMimoTtsModelMode, shouldUseMimoTtsStreaming } from './mimo-tts.util'
import { shouldUseMinimaxTtsStreaming } from './minimax-tts.util'

export const TTS_STREAM_CAPABLE_PROVIDER_IDS = ['mimo-tts', 'minimax-tts'] as const

export type TtsStreamCapableProviderId = (typeof TTS_STREAM_CAPABLE_PROVIDER_IDS)[number]

export function supportsTtsProviderStreaming(providerId: string): providerId is TtsStreamCapableProviderId {
  return (TTS_STREAM_CAPABLE_PROVIDER_IDS as readonly string[]).includes(providerId)
}

export function resolveTtsStreamingEnabled(
  providerId: string,
  streamPreference: boolean | undefined,
  modelId?: string
): boolean {
  if (!supportsTtsProviderStreaming(providerId) || streamPreference !== true) {
    return false
  }

  if (providerId === 'minimax-tts') {
    return shouldUseMinimaxTtsStreaming(streamPreference)
  }

  if (providerId === 'mimo-tts') {
    return shouldUseMimoTtsStreaming(getMimoTtsModelMode(modelId || ''), streamPreference)
  }

  return false
}

export function shouldUseTtsSynthesisCache(providerId: string, streamEnabled: boolean): boolean {
  if (providerId === 'mimo-tts') return false
  if (supportsTtsProviderStreaming(providerId) && streamEnabled) return false
  return true
}
