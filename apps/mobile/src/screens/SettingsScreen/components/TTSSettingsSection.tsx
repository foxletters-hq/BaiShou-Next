import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import {
  applyTtsSaveToGlobalModels,
  buildTtsProviderStatesFromGlobal,
  buildTtsSettingsInitialConfig,
  isTtsProviderId
} from '@baishou/shared'
import {
  TTSProviderSettings,
  type ProviderLocalState,
  type TtsProviderConfig
} from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { synthesizeTtsFromForm } from '../../../services/mobile-tts-synthesize'
import { playTtsAudio } from '../../../services/play-tts-audio'
import { fetchTtsProviderModels } from '../utils/tts-provider-models'
import { setTtsPlaybackSettingsCache } from '../../../services/mobile-tts-settings.service'
import { SettingsGroupCard } from './SettingsGroupCard'

export interface TTSSettingsSectionProps {
  providerId: string
}

export const TTSSettingsSection: React.FC<TTSSettingsSectionProps> = ({ providerId }) => {
  const { services, dbReady } = useBaishou()
  const [activeProviderId, setActiveProviderId] = useState(providerId)
  const [initialConfig, setInitialConfig] = useState<Partial<TtsProviderConfig> | undefined>()
  const [initialProviderStates, setInitialProviderStates] = useState<
    Record<string, ProviderLocalState> | undefined
  >()

  useEffect(() => {
    setActiveProviderId(providerId)
  }, [providerId])

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const globalModels = (await services.settingsManager.get<any>('global_models')) || {}
      const savedProviderId = globalModels.globalTtsProviderId || 'openai-tts'
      const activeId = isTtsProviderId(providerId) ? providerId : savedProviderId
      const providerStates = buildTtsProviderStatesFromGlobal(globalModels)

      setInitialProviderStates(providerStates)
      setTtsPlaybackSettingsCache({ globalModels })

      setInitialConfig(
        buildTtsSettingsInitialConfig({
          activeProviderId: activeId,
          globalTtsProviderId: globalModels.globalTtsProviderId,
          globalTtsModelId: globalModels.globalTtsModelId,
          globalTtsSettings: globalModels.globalTtsSettings || {},
          globalTtsProviderConfigs: globalModels.globalTtsProviderConfigs,
          persisted: providerStates
        })
      )
    })()
  }, [dbReady, services, providerId])

  const handleProviderChange = useCallback((nextProviderId: string) => {
    if (!isTtsProviderId(nextProviderId)) return
    setActiveProviderId(nextProviderId)
  }, [])

  const handleSaveConfig = async (config: TtsProviderConfig) => {
    if (!services) return

    const providers = (await services.settingsManager.get<any[]>('ai_providers')) || []
    if (providers.some((p) => isTtsProviderId(p.id))) {
      await services.settingsManager.set(
        'ai_providers',
        providers.filter((p) => !isTtsProviderId(p.id))
      )
    }

    const globalModels = (await services.settingsManager.get<any>('global_models')) || {}
    const nextGlobalModels = applyTtsSaveToGlobalModels(globalModels, config)
    await services.settingsManager.set('global_models', nextGlobalModels)
    setTtsPlaybackSettingsCache({ globalModels: nextGlobalModels })
  }

  const configReady = useMemo(
    () => initialConfig !== undefined && initialProviderStates !== undefined,
    [initialConfig, initialProviderStates]
  )

  if (!configReady) return null

  return (
    <ScrollView
      style={{ flex: 1 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <SettingsGroupCard style={{ marginBottom: 0 }}>
        <TTSProviderSettings
          layout="groupCard"
          initialConfig={initialConfig}
          initialProviderStates={initialProviderStates}
          activeProviderId={activeProviderId}
          onActiveProviderIdChange={handleProviderChange}
          onSaveConfig={handleSaveConfig}
          onFetchModels={fetchTtsProviderModels}
          onPlayTestAudio={playTtsAudio}
          onTestTts={async (config, text) => {
            const result = await synthesizeTtsFromForm(config, text)
            if (result.success) {
              return {
                success: true,
                audioBase64: result.audioBase64,
                format: result.format
              }
            }
            return { success: false, error: result.error }
          }}
        />
      </SettingsGroupCard>
    </ScrollView>
  )
}
