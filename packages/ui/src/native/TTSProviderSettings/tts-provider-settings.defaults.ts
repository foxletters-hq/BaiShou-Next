import {
  TTS_PROVIDER_IDS,
  getTtsInitialConfigs,
  isTtsProviderId as sharedIsTtsProviderId,
  mergeTtsPersistedConfigs
} from '@baishou/shared'
import type { ProviderLocalState } from './tts-provider-settings.types'

export { TTS_PROVIDER_IDS }
export type { TtsProviderId } from '@baishou/shared'

export function isTtsProviderId(id: string): id is import('@baishou/shared').TtsProviderId {
  return sharedIsTtsProviderId(id)
}

export function getInitialConfigs(): Record<string, ProviderLocalState> {
  return getTtsInitialConfigs()
}

export function mergePersistedConfigs(
  persisted: Record<string, Partial<ProviderLocalState>> | null | undefined
): Record<string, ProviderLocalState> {
  return mergeTtsPersistedConfigs(persisted)
}
