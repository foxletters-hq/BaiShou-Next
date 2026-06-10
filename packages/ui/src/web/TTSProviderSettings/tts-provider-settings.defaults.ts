import {
  getTtsInitialConfigs,
  mergeTtsPersistedConfigs,
  type TtsProviderLocalState
} from '@baishou/shared'
import type { ProviderLocalState } from './tts-provider-settings.types'

export const getInitialConfigs = (): Record<string, ProviderLocalState> => {
  try {
    const saved = localStorage.getItem('baishou_tts_provider_configs')
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, Partial<TtsProviderLocalState>>
      return mergeTtsPersistedConfigs(parsed)
    }
  } catch {
    /* ignore */
  }
  return getTtsInitialConfigs()
}
