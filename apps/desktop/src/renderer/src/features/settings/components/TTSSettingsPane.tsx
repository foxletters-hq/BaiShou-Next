import React, { useMemo } from 'react'
import { useSettingsStore } from '@baishou/store'
import { TTSProviderSettings } from '@baishou/ui'

export const TTSSettingsPane: React.FC = () => {
  const settings = useSettingsStore()

  const handleSaveConfig = async (config: any) => {
    const providers = Array.isArray(settings.providers) ? settings.providers : []
    const existingProvider = providers.find((p: any) => p.id === config.id)

    let providerData
    if (existingProvider) {
      providerData = {
        ...existingProvider,
        baseUrl: config.baseUrl,
        apiKey: config.apiKey,
        models: existingProvider.models || [config.modelId],
        enabledModels: [config.modelId],
        defaultDialogueModel: config.modelId
      }
    } else {
      providerData = {
        id: config.id,
        name: config.name,
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
    }

    await settings.updateProvider(providerData)

    const globalModels = settings.globalModels
    if (!globalModels) return

    await settings.setGlobalModels({
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
  }

  const handleTestTts = async (config: any, text: string) => {
    try {
      const result = await (window as any).api?.tts?.synthesize(text, config.id, config.modelId)
      if (result?.success) {
        return { success: true, audioBase64: result.audioBase64, format: result.format }
      }
      const errorMsg = result?.error
        ? `${result.errorCode}: ${result.error}`
        : result?.errorCode || 'unknown'
      return { success: false, error: errorMsg }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  }

  const globalModels = settings.globalModels
  const providers = settings.providers
  const initialConfig = useMemo(() => {
    const savedProviderId = globalModels?.globalTtsProviderId || 'openai-tts'
    const providerConfig = ((Array.isArray(providers) ? providers : []).find(
      (p: any) => p.id === savedProviderId
    ) || {}) as any
    return {
      id: savedProviderId,
      baseUrl:
        providerConfig.baseUrl !== undefined
          ? providerConfig.baseUrl
          : savedProviderId === 'gpt-sovits'
            ? 'http://127.0.0.1:9880'
            : savedProviderId === 'mimo-tts'
              ? ''
              : 'https://api.openai.com/v1',
      apiKey: providerConfig.apiKey || '',
      modelId:
        globalModels?.globalTtsModelId ||
        (savedProviderId === 'gpt-sovits'
          ? 'default'
          : savedProviderId === 'mimo-tts'
            ? 'mimo-v2.5-tts'
            : 'tts-1'),
      voice:
        globalModels?.globalTtsSettings?.voice ||
        (savedProviderId === 'gpt-sovits'
          ? 'default'
          : savedProviderId === 'mimo-tts'
            ? '冰糖'
            : 'alloy'),
      speed:
        globalModels?.globalTtsSettings?.speed !== undefined
          ? globalModels.globalTtsSettings.speed
          : 1.0,
      responseFormat:
        globalModels?.globalTtsSettings?.responseFormat ||
        (savedProviderId === 'mimo-tts' || savedProviderId === 'gpt-sovits' ? 'wav' : 'mp3'),
      refAudioPath: globalModels?.globalTtsSettings?.refAudioPath || '',
      promptText: globalModels?.globalTtsSettings?.promptText || '',
      promptLang: globalModels?.globalTtsSettings?.promptLang || 'zh',
      textLang: globalModels?.globalTtsSettings?.textLang || 'zh'
    }
  }, [globalModels, providers])

  return (
    <div className="settings-pane settings-pane-full">
      <TTSProviderSettings
        initialConfig={initialConfig}
        providersList={providers}
        onSaveConfig={handleSaveConfig}
        onTestTts={handleTestTts}
        onFetchModels={async (providerId, apiKey, baseUrl) => {
          return (
            (await (window as any).api?.settings?.fetchProviderModels(
              providerId,
              apiKey,
              baseUrl
            )) || []
          )
        }}
      />
    </div>
  )
}
