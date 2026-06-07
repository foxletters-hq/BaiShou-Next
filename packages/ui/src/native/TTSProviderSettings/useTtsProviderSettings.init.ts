import type { ProviderLocalState, TtsProviderConfig } from './tts-provider-settings.types'
import { isTtsProviderId } from './tts-provider-settings.defaults'

function mergeProviderEntry(
  configs: Record<string, ProviderLocalState>,
  prov: {
    id: string
    baseUrl?: string
    apiKey?: string
    defaultDialogueModel?: string
    models?: string[]
  }
): void {
  if (!isTtsProviderId(prov.id)) return
  const id = prov.id
  configs[id] = {
    ...configs[id],
    baseUrl: prov.baseUrl !== undefined ? prov.baseUrl : configs[id].baseUrl,
    apiKey: prov.apiKey || configs[id].apiKey,
    modelId: prov.defaultDialogueModel || (prov.models && prov.models[0]) || configs[id].modelId,
    availableModels:
      Array.isArray(prov.models) && prov.models.length > 0
        ? prov.models
        : configs[id].availableModels
  }
}

function mergeInitialConfigEntry(
  configs: Record<string, ProviderLocalState>,
  initialConfig: Partial<TtsProviderConfig> & { id: string }
): void {
  if (!isTtsProviderId(initialConfig.id)) return
  const id = initialConfig.id
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
    refAudioPath:
      initialConfig.refAudioPath !== undefined
        ? initialConfig.refAudioPath
        : configs[id].refAudioPath,
    promptText:
      initialConfig.promptText !== undefined ? initialConfig.promptText : configs[id].promptText,
    promptLang:
      initialConfig.promptLang !== undefined ? initialConfig.promptLang : configs[id].promptLang,
    textLang: initialConfig.textLang !== undefined ? initialConfig.textLang : configs[id].textLang
  }
}

export function buildInitializedConfigs(
  configs: Record<string, ProviderLocalState>,
  providersList: unknown[] | undefined,
  initialConfig: Partial<TtsProviderConfig> | undefined,
  activeProviderId?: string
): { configs: Record<string, ProviderLocalState>; providerType: string } {
  const newConfigs = { ...configs }

  if (Array.isArray(providersList)) {
    providersList.forEach((prov) =>
      mergeProviderEntry(newConfigs, prov as Parameters<typeof mergeProviderEntry>[1])
    )
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
