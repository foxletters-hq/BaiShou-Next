import React from 'react'
import type { TTSProviderSettingsProps } from './tts-provider-settings.types'
import { useTTSProviderSettings } from './useTTSProviderSettings'
import { TTSProviderSettingsForm } from './TTSProviderSettingsForm'

export const TTSProviderSettings: React.FC<TTSProviderSettingsProps> = (props) => {
  const vm = useTTSProviderSettings(props)
  return <TTSProviderSettingsForm vm={vm} />
}
