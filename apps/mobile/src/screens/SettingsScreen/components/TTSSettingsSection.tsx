import React, { useEffect, useMemo, useState } from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { TTSProviderSettings, type TtsProviderConfig } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'

export const TTSSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const { services, dbReady } = useBaishou()
  const [initialConfig, setInitialConfig] = useState<Partial<TtsProviderConfig> | undefined>()

  useEffect(() => {
    if (!dbReady || !services) return
    void (async () => {
      const globalModels = (await services.settingsManager.get<any>('global_models')) || {}
      const providers = (await services.settingsManager.get<any[]>('ai_providers')) || []
      const savedProviderId = globalModels.globalTtsProviderId || 'openai-tts'
      const providerConfig =
        providers.find((p) => p.id === savedProviderId) || ({} as Record<string, unknown>)
      const ttsSettings = globalModels.globalTtsSettings || {}

      setInitialConfig({
        id: savedProviderId,
        baseUrl:
          (providerConfig.baseUrl as string) ||
          (savedProviderId === 'gpt-sovits' ? 'http://127.0.0.1:9880' : 'https://api.openai.com/v1'),
        apiKey: (providerConfig.apiKey as string) || '',
        modelId:
          globalModels.globalTtsModelId ||
          (savedProviderId === 'gpt-sovits' ? 'default' : 'tts-1'),
        voice: ttsSettings.voice || 'alloy',
        speed: ttsSettings.speed ?? 1,
        responseFormat: ttsSettings.responseFormat || 'mp3',
        refAudioPath: ttsSettings.refAudioPath || '',
        promptText: ttsSettings.promptText || '',
        promptLang: ttsSettings.promptLang || 'zh',
        textLang: ttsSettings.textLang || 'zh'
      })
    })()
  }, [dbReady, services])

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

    Alert.alert(t('common.success'), t('tts.settings.save_success'))
  }

  const configReady = useMemo(() => initialConfig !== undefined, [initialConfig])

  if (!configReady) return null

  return (
    <TTSProviderSettings
      initialConfig={initialConfig}
      onSaveConfig={handleSaveConfig}
      onTestTts={async () => ({
        success: false,
        message: t('tts.settings.test_failed')
      })}
    />
  )
}
