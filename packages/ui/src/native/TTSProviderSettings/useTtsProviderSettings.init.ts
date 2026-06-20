import type { ProviderLocalState, TtsProviderConfig } from './tts-provider-settings.types'
import { getInitialConfigs, isTtsProviderId } from './tts-provider-settings.defaults'

function mergeInitialConfigEntry(
  configs: Record<string, ProviderLocalState>,
  initialConfig: Partial<TtsProviderConfig> & { id: string }
): void {
  if (!isTtsProviderId(initialConfig.id)) return
  const id = initialConfig.id
  const extra = initialConfig as Partial<TtsProviderConfig> & {
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
    refAudioPath:
      initialConfig.refAudioPath !== undefined
        ? initialConfig.refAudioPath
        : configs[id].refAudioPath,
    refAudioBase64:
      initialConfig.refAudioBase64 !== undefined
        ? initialConfig.refAudioBase64
        : configs[id].refAudioBase64,
    promptText:
      initialConfig.promptText !== undefined ? initialConfig.promptText : configs[id].promptText,
    promptLang:
      initialConfig.promptLang !== undefined ? initialConfig.promptLang : configs[id].promptLang,
    textLang: initialConfig.textLang !== undefined ? initialConfig.textLang : configs[id].textLang,
    stream: initialConfig.stream !== undefined ? initialConfig.stream : configs[id].stream
  }
}

export function buildInitializedConfigs(
  initialProviderStates: Record<string, ProviderLocalState> | undefined,
  initialConfig: Partial<TtsProviderConfig> | undefined,
  activeProviderId?: string
): { configs: Record<string, ProviderLocalState>; providerType: string } {
  const newConfigs = {
    ...getInitialConfigs(),
    ...initialProviderStates
  }

  let providerType: string =
    activeProviderId && isTtsProviderId(activeProviderId) ? activeProviderId : 'openai-tts'

  if (initialConfig?.id && isTtsProviderId(initialConfig.id)) {
    if (!activeProviderId) {
      providerType = initialConfig.id
    }
    mergeInitialConfigEntry(
      newConfigs,
      initialConfig as Partial<TtsProviderConfig> & { id: string }
    )
  }

  if (activeProviderId && isTtsProviderId(activeProviderId)) {
    providerType = activeProviderId
  }

  return { configs: newConfigs, providerType }
}
