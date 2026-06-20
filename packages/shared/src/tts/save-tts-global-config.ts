import type { GlobalModelsConfig, TtsSettings } from '../types/settings.types'
import type { TtsProviderLocalState } from './tts-defaults'
import { buildTtsProviderConnectionEntry } from './tts-defaults'

export interface TtsSavePayload {
  id: string
  baseUrl: string
  apiKey: string
  modelId: string
  voice: string
  speed: number
  responseFormat: string
  availableModels?: string[]
  refAudioPath?: string
  refAudioBase64?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  stream?: boolean
}

export function applyTtsSaveToGlobalModels(
  globalModels: GlobalModelsConfig,
  config: TtsSavePayload
): GlobalModelsConfig {
  const existingConfigs = globalModels.globalTtsProviderConfigs ?? {}
  const providerState: TtsProviderLocalState = {
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    modelId: config.modelId,
    voice: config.voice,
    speed: config.speed,
    responseFormat: config.responseFormat,
    availableModels: config.availableModels ?? [],
    refAudioPath: config.refAudioPath,
    refAudioBase64: config.refAudioPath?.trim() ? undefined : config.refAudioBase64,
    promptText: config.promptText,
    promptLang: config.promptLang,
    textLang: config.textLang,
    stream: config.stream
  }

  const globalTtsSettings: TtsSettings = {
    voice: config.voice,
    speed: config.speed,
    responseFormat: config.responseFormat,
    refAudioPath: config.refAudioPath,
    refAudioBase64: config.refAudioPath?.trim() ? undefined : config.refAudioBase64,
    promptText: config.promptText,
    promptLang: config.promptLang,
    textLang: config.textLang,
    stream: config.stream
  }

  return {
    ...globalModels,
    globalTtsProviderId: config.id,
    globalTtsModelId: config.modelId,
    globalTtsProviderConfigs: {
      ...existingConfigs,
      [config.id]: buildTtsProviderConnectionEntry(providerState)
    },
    globalTtsSettings
  }
}
