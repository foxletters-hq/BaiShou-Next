import React, { useMemo } from 'react'
import { useSettingsStore } from '@baishou/store'
import {
  buildTtsSettingsInitialConfig,
  getTtsInitialConfigs,
  isTtsProviderId,
  synthesizeTtsFromFormConfig,
  TtsProviderRegistry,
  OpenAiTtsProvider,
  MimoTtsProvider,
  CloneTtsProvider,
  GptSovitsProvider
} from '@baishou/shared'
import { TTSProviderSettings } from '@baishou/ui'
import type { TtsProviderConfig } from '@baishou/ui'

const ttsRegistry = new TtsProviderRegistry()
ttsRegistry.register(new OpenAiTtsProvider())
ttsRegistry.register(new MimoTtsProvider())
ttsRegistry.register(new CloneTtsProvider())
ttsRegistry.register(new GptSovitsProvider())

export const TTSSettingsPane: React.FC = () => {
  const settings = useSettingsStore()

  const handleSaveConfig = async (config: TtsProviderConfig) => {
    // 清理历史误写入 ai_providers 的 TTS 项（TTS 与 AI 供应商完全独立）
    const providers = Array.isArray(settings.providers) ? settings.providers : []
    if (providers.some((p: { id: string }) => isTtsProviderId(p.id))) {
      await settings.setProviders(providers.filter((p: { id: string }) => !isTtsProviderId(p.id)))
    }

    const globalModels = settings.globalModels
    if (!globalModels) return

    const existingConfigs = globalModels.globalTtsProviderConfigs ?? {}
    await settings.setGlobalModels({
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
    })
  }

  const handleTestTts = async (config: TtsProviderConfig, text: string) => {
    try {
      const result = await synthesizeTtsFromFormConfig(ttsRegistry, config, text)
      if (result.success) {
        return { success: true, audioBase64: result.audioBase64, format: result.format }
      }
      const failed = result as Extract<typeof result, { success: false }>
      const errorMsg = failed.error
        ? `${failed.errorCode}: ${failed.error}`
        : failed.errorCode || 'unknown'
      return { success: false, error: errorMsg }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error)
      return { success: false, error: message }
    }
  }

  const globalModels = settings.globalModels
  const initialConfig = useMemo(() => {
    const savedProviderId = globalModels?.globalTtsProviderId || 'openai-tts'

    return buildTtsSettingsInitialConfig({
      activeProviderId: savedProviderId,
      globalTtsProviderId: globalModels?.globalTtsProviderId,
      globalTtsModelId: globalModels?.globalTtsModelId,
      globalTtsSettings: globalModels?.globalTtsSettings,
      globalTtsProviderConfigs: globalModels?.globalTtsProviderConfigs,
      persisted: getTtsInitialConfigs()
    })
  }, [globalModels])

  return (
    <div className="settings-pane settings-pane-full">
      <TTSProviderSettings
        initialConfig={initialConfig}
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
