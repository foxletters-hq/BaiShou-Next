import type { ProviderLocalState, TtsProviderConfig } from './tts-provider-settings.types'
import { isTtsProviderId } from './useTTSProviderSettings.constants'
import { getInitialConfigs } from './tts-provider-settings.defaults'

function mergeInitialConfigEntry(
  configs: Record<string, ProviderLocalState>,
  initialConfig: Partial<TtsProviderConfig> & { id: string }
): void {
  if (!isTtsProviderId(initialConfig.id)) return
  const id = initialConfig.id
  const extra = initialConfig as Partial<TtsProviderConfig> & {
    refAudioPath?: string
    promptText?: string
    promptLang?: string
    textLang?: string
    availableModels?: string[]
  }
  configs[id] = {
    ...configs[id],
    baseUrl: initialConfig.baseUrl !== undefined ? initialConfig.baseUrl : configs[id].baseUrl,
    apiKey: initialConfig.apiKey !== undefined ? initialConfig.apiKey : configs[id].apiKey,
    modelId: initialConfig.modelId !== undefined ? initialConfig.modelId : configs[id].modelId,
    voice: initialConfig.voice !== undefined ? initialConfig.voice : configs[id].voice,
    speed: initialConfig.speed !== undefined ? initialConfig.speed : configs[id].speed,
    responseFormat:
      initialConfig.responseFormat !== undefined
        ? initialConfig.responseFormat
        : configs[id].responseFormat,
    availableModels:
      extra.availableModels && extra.availableModels.length > 0
        ? extra.availableModels
        : configs[id].availableModels,
    refAudioPath: extra.refAudioPath !== undefined ? extra.refAudioPath : configs[id].refAudioPath,
    refAudioBase64:
      extra.refAudioBase64 !== undefined ? extra.refAudioBase64 : configs[id].refAudioBase64,
    promptText: extra.promptText !== undefined ? extra.promptText : configs[id].promptText,
    promptLang: extra.promptLang !== undefined ? extra.promptLang : configs[id].promptLang,
    textLang: extra.textLang !== undefined ? extra.textLang : configs[id].textLang,
    stream: extra.stream !== undefined ? extra.stream : configs[id].stream
  }
}

export function buildInitializedConfigs(
  initialProviderStates: Record<string, ProviderLocalState> | undefined,
  initialConfig: Partial<TtsProviderConfig> | undefined
): { configs: Record<string, ProviderLocalState>; providerType: string } {
  const newConfigs = {
    ...getInitialConfigs(),
    ...initialProviderStates
  }

  let providerType = 'openai-tts'
  if (initialConfig?.id) {
    providerType = initialConfig.id
    mergeInitialConfigEntry(
      newConfigs,
      initialConfig as Partial<TtsProviderConfig> & { id: string }
    )
  }

  return { configs: newConfigs, providerType }
}
