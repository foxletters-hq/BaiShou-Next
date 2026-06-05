import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { TTSProviderSettings, useNativeToast, type TtsProviderConfig } from '@baishou/ui/native'
import { useBaishou } from '../../../providers/BaishouProvider'
import { synthesizeTtsForTest } from '../../../services/mobile-tts-synthesize'
import { fetchTtsProviderModels } from '../utils/tts-provider-models'

export const TTSSettingsSection: React.FC = () => {
  const { t } = useTranslation()
  const toast = useNativeToast()
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
          (savedProviderId === 'gpt-sovits'
            ? 'http://127.0.0.1:9880'
            : savedProviderId === 'mimo-tts'
              ? ''
              : 'https://api.openai.com/v1'),
        apiKey: (providerConfig.apiKey as string) || '',
        modelId:
          globalModels.globalTtsModelId ||
          (savedProviderId === 'gpt-sovits'
            ? 'default'
            : savedProviderId === 'mimo-tts'
              ? 'mimo-v2.5-tts'
              : 'tts-1'),
        voice:
          ttsSettings.voice ||
          (savedProviderId === 'mimo-tts'
            ? '冰糖'
            : savedProviderId === 'gpt-sovits'
              ? 'default'
              : 'alloy'),
        speed: ttsSettings.speed ?? 1,
        responseFormat:
          ttsSettings.responseFormat ||
          (savedProviderId === 'mimo-tts' || savedProviderId === 'gpt-sovits' ? 'wav' : 'mp3'),
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

    toast.showSuccess(t('tts.settings.save_success'))
  }

  const configReady = useMemo(() => initialConfig !== undefined, [initialConfig])

  if (!configReady) return null

  return (
    <TTSProviderSettings
      initialConfig={initialConfig}
      onSaveConfig={handleSaveConfig}
      onFetchModels={fetchTtsProviderModels}
      onTestTts={async (config, text) => {
        const result = await synthesizeTtsForTest(config, text)
        if (result.success) {
          return { success: true, message: t('tts.settings.test_success') }
        }
        return { success: false, message: result.error }
      }}
    />
  )
}
