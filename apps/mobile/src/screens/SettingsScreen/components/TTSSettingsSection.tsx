import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ScrollView } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { buildTtsSettingsInitialConfig, isTtsProviderId, mergeTtsPersistedConfigs } from '@baishou/shared'
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

const TTS_CONFIGS_STORAGE_KEY = 'baishou_tts_provider_configs'

export interface TTSSettingsSectionProps {
  providerId: string
}

export const TTSSettingsSection: React.FC<TTSSettingsSectionProps> = ({ providerId }) => {
  const { services, dbReady } = useBaishou()
  const [activeProviderId, setActiveProviderId] = useState(providerId)
  const [initialConfig, setInitialConfig] = useState<Partial<TtsProviderConfig> | undefined>()
  const [persistedConfigs, setPersistedConfigs] = useState<
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
      const ttsSettings = globalModels.globalTtsSettings || {}

      let mergedPersisted = mergeTtsPersistedConfigs(undefined)
      try {
        const saved = await AsyncStorage.getItem(TTS_CONFIGS_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, Partial<ProviderLocalState>>
          mergedPersisted = mergeTtsPersistedConfigs(parsed)
        }
      } catch {
        /* ignore */
      }

      setPersistedConfigs(mergedPersisted)
      setTtsPlaybackSettingsCache({ globalModels })

      setInitialConfig(
        buildTtsSettingsInitialConfig({
          activeProviderId: activeId,
          globalTtsProviderId: globalModels.globalTtsProviderId,
          globalTtsModelId: globalModels.globalTtsModelId,
          globalTtsSettings: ttsSettings,
          globalTtsProviderConfigs: globalModels.globalTtsProviderConfigs,
          persisted: mergedPersisted
        })
      )
    })()
  // 供应商芯片切换只更新本地 activeProviderId，不走路由，避免栈页面滑入动画
  }, [dbReady, services, providerId])

  const handlePersistConfigs = useCallback(
    (configs: Record<string, ProviderLocalState>) => {
      void AsyncStorage.setItem(
        TTS_CONFIGS_STORAGE_KEY,
        JSON.stringify({ ...configs, __lastActiveProviderId: activeProviderId })
      ).catch(() => {})
    },
    [activeProviderId]
  )

  const handleProviderChange = useCallback(
    (nextProviderId: string) => {
      if (!isTtsProviderId(nextProviderId) || nextProviderId === activeProviderId) return
      setActiveProviderId(nextProviderId)
      void (async () => {
        try {
          const saved = await AsyncStorage.getItem(TTS_CONFIGS_STORAGE_KEY)
          const parsed = saved ? (JSON.parse(saved) as Record<string, unknown>) : {}
          await AsyncStorage.setItem(
            TTS_CONFIGS_STORAGE_KEY,
            JSON.stringify({ ...parsed, __lastActiveProviderId: nextProviderId })
          )
        } catch {
          /* ignore */
        }
      })()
    },
    [activeProviderId]
  )

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
    const existingConfigs = globalModels.globalTtsProviderConfigs ?? {}
    const nextGlobalModels = {
      ...globalModels,
      globalTtsProviderId: config.id,
      globalTtsModelId: config.modelId,
      globalTtsProviderConfigs: {
        ...existingConfigs,
        [config.id]: {
          baseUrl: config.baseUrl,
          apiKey: config.apiKey
        }
      },
      globalTtsSettings: {
        voice: config.voice,
        speed: config.speed,
        responseFormat: config.responseFormat,
        refAudioPath: config.refAudioPath,
        promptText: config.promptText,
        promptLang: config.promptLang,
        textLang: config.textLang
      }
    }
    await services.settingsManager.set('global_models', nextGlobalModels)
    setTtsPlaybackSettingsCache({ globalModels: nextGlobalModels })
  }

  const configReady = useMemo(
    () => initialConfig !== undefined && persistedConfigs !== undefined,
    [initialConfig, persistedConfigs]
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
          autoSaveOnFetchModels
          initialConfig={initialConfig}
          activeProviderId={activeProviderId}
          onActiveProviderIdChange={handleProviderChange}
          persistedConfigs={persistedConfigs}
          onPersistConfigs={handlePersistConfigs}
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
