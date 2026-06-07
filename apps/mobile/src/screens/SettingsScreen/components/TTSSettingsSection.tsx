import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import {
  TTSProviderSettings,
  useNativeToast,
  type ProviderLocalState,
  type TtsProviderConfig,
  mergePersistedConfigs,
  isTtsProviderId
} from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { synthesizeTtsForTest } from '../../../services/mobile-tts-synthesize'
import { playTtsAudio } from '../../../services/play-tts-audio'
import { fetchTtsProviderModels } from '../utils/tts-provider-models'

const TTS_CONFIGS_STORAGE_KEY = 'baishou_tts_provider_configs'

export interface TTSSettingsSectionProps {
  providerId: string
}

export const TTSSettingsSection: React.FC<TTSSettingsSectionProps> = ({ providerId }) => {
  const { t } = useTranslation()
  const toast = useNativeToast()
  const router = useRouter()
  const { services, dbReady } = useBaishou()
  const [initialConfig, setInitialConfig] = useState<Partial<TtsProviderConfig> | undefined>()
  const [providersList, setProvidersList] = useState<unknown[] | undefined>()
  const [persistedConfigs, setPersistedConfigs] = useState<
    Record<string, ProviderLocalState> | undefined
  >()

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const globalModels = (await services.settingsManager.get<any>('global_models')) || {}
      const providers = (await services.settingsManager.get<any[]>('ai_providers')) || []
      const savedProviderId = globalModels.globalTtsProviderId || 'openai-tts'
      const activeId = isTtsProviderId(providerId) ? providerId : savedProviderId
      const providerConfig =
        providers.find((p) => p.id === activeId) || ({} as Record<string, unknown>)
      const ttsSettings = globalModels.globalTtsSettings || {}

      let mergedPersisted = mergePersistedConfigs(undefined)
      try {
        const saved = await AsyncStorage.getItem(TTS_CONFIGS_STORAGE_KEY)
        if (saved) {
          const parsed = JSON.parse(saved) as Record<string, Partial<ProviderLocalState>>
          mergedPersisted = mergePersistedConfigs(parsed)
        }
      } catch {
        /* ignore */
      }

      setPersistedConfigs(mergedPersisted)
      setProvidersList(providers)

      const isActiveGlobal = activeId === savedProviderId
      setInitialConfig({
        id: activeId,
        baseUrl:
          (providerConfig.baseUrl as string) ||
          mergedPersisted[activeId]?.baseUrl ||
          (activeId === 'gpt-sovits'
            ? 'http://127.0.0.1:9880'
            : activeId === 'clone-tts'
              ? 'http://127.0.0.1:8080'
              : activeId === 'mimo-tts'
                ? ''
                : 'https://api.openai.com/v1'),
        apiKey: (providerConfig.apiKey as string) || mergedPersisted[activeId]?.apiKey || '',
        modelId:
          (isActiveGlobal ? globalModels.globalTtsModelId : undefined) ||
          mergedPersisted[activeId]?.modelId ||
          (activeId === 'gpt-sovits'
            ? 'default'
            : activeId === 'mimo-tts'
              ? 'mimo-v2.5-tts'
              : 'tts-1'),
        voice:
          (isActiveGlobal ? ttsSettings.voice : undefined) ||
          mergedPersisted[activeId]?.voice ||
          (activeId === 'mimo-tts' ? '冰糖' : activeId === 'gpt-sovits' ? 'default' : 'alloy'),
        speed:
          (isActiveGlobal ? ttsSettings.speed : undefined) ?? mergedPersisted[activeId]?.speed ?? 1,
        responseFormat:
          (isActiveGlobal ? ttsSettings.responseFormat : undefined) ||
          mergedPersisted[activeId]?.responseFormat ||
          (activeId === 'mimo-tts' || activeId === 'gpt-sovits' ? 'wav' : 'mp3'),
        refAudioPath:
          (isActiveGlobal ? ttsSettings.refAudioPath : undefined) ||
          mergedPersisted[activeId]?.refAudioPath ||
          '',
        promptText:
          (isActiveGlobal ? ttsSettings.promptText : undefined) ||
          mergedPersisted[activeId]?.promptText ||
          '',
        promptLang:
          (isActiveGlobal ? ttsSettings.promptLang : undefined) ||
          mergedPersisted[activeId]?.promptLang ||
          'zh',
        textLang:
          (isActiveGlobal ? ttsSettings.textLang : undefined) ||
          mergedPersisted[activeId]?.textLang ||
          'zh'
      })
    })()
  }, [dbReady, services, providerId])

  const handlePersistConfigs = useCallback(
    (configs: Record<string, ProviderLocalState>) => {
      void AsyncStorage.setItem(
        TTS_CONFIGS_STORAGE_KEY,
        JSON.stringify({ ...configs, __lastActiveProviderId: providerId })
      ).catch(() => {})
    },
    [providerId]
  )

  const handleProviderChange = useCallback(
    (nextProviderId: string) => {
      if (!isTtsProviderId(nextProviderId) || nextProviderId === providerId) return
      router.replace(`/settings/tts/${nextProviderId}`)
    },
    [providerId, router]
  )

  const handleSaveConfig = async (config: TtsProviderConfig) => {
    if (!services) return
    const providers = (await services.settingsManager.get<any[]>('ai_providers')) || []
    const existing = providers.find((p) => p.id === config.id)
    const providerData = existing
      ? {
          ...existing,
          baseUrl: config.baseUrl,
          apiKey: config.apiKey,
          models: existing.models?.length ? existing.models : [config.modelId],
          enabledModels: [config.modelId],
          defaultDialogueModel: config.modelId
        }
      : {
          id: config.id,
          name: config.name || config.id,
          type: 'custom',
          apiKey: config.apiKey,
          baseUrl: config.baseUrl,
          models: [config.modelId],
          enabledModels: [config.modelId],
          defaultDialogueModel: config.modelId,
          isEnabled: true,
          isSystem: false,
          sortOrder: providers.length
        }

    const nextProviders = existing
      ? providers.map((p) => (p.id === config.id ? providerData : p))
      : [...providers, providerData]
    await services.settingsManager.set('ai_providers', nextProviders)

    const globalModels = (await services.settingsManager.get<any>('global_models')) || {}
    await services.settingsManager.set('global_models', {
      ...globalModels,
      globalTtsProviderId: config.id,
      globalTtsModelId: config.modelId,
      globalTtsSettings: {
        voice: config.voice,
        speed: config.speed,
        responseFormat: config.responseFormat,
        refAudioPath: config.refAudioPath,
        promptText: config.promptText,
        promptLang: config.promptLang,
        textLang: config.textLang
      }
    })

    toast.showSuccess(t('tts.settings.save_success'))
  }

  const configReady = useMemo(
    () =>
      initialConfig !== undefined && persistedConfigs !== undefined && providersList !== undefined,
    [initialConfig, persistedConfigs, providersList]
  )

  if (!configReady) return null

  return (
    <TTSProviderSettings
      key={providerId}
      initialConfig={initialConfig}
      activeProviderId={providerId}
      onActiveProviderIdChange={handleProviderChange}
      persistedConfigs={persistedConfigs}
      onPersistConfigs={handlePersistConfigs}
      providersList={providersList}
      onSaveConfig={handleSaveConfig}
      onFetchModels={fetchTtsProviderModels}
      onPlayTestAudio={playTtsAudio}
      onTestTts={async (config, text) => {
        const result = await synthesizeTtsForTest(config, text)
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
  )
}
