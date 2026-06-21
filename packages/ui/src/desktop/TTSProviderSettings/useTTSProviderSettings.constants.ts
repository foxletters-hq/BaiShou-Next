export const TTS_PROVIDER_IDS = ['openai-tts', 'mimo-tts', 'clone-tts', 'gpt-sovits'] as const

export type TtsProviderId = (typeof TTS_PROVIDER_IDS)[number]

export function isTtsProviderId(id: string): id is TtsProviderId {
  return (TTS_PROVIDER_IDS as readonly string[]).includes(id)
}
