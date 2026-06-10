import { getTtsInitialConfigs } from '@baishou/shared'
import type { ProviderLocalState } from './tts-provider-settings.types'

export const getInitialConfigs = (): Record<string, ProviderLocalState> => getTtsInitialConfigs()
