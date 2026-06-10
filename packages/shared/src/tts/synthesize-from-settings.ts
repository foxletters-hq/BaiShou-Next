import type { GlobalModelsConfig } from '../types/settings.types'
import {
  TtsApiError,
  TtsInvalidResponseError,
  TtsNotConfiguredError,
  TtsProviderNotFoundError
} from './tts.errors'
import { resolveTtsProviderBaseUrl, resolveTtsProviderCredentials } from './tts-defaults'
import type { TtsProviderRegistry } from './tts.registry'

export type TtsSynthesizeFromSettingsResult =
  | { success: true; audioBase64: string; format: string }
  | {
      success: false
      errorCode: string
      error?: string
      statusCode?: number
    }

export interface TtsSynthesizeFromSettingsInput {
  globalModels: GlobalModelsConfig | null | undefined
  text: string
  providerId?: string
  modelId?: string
}

export interface TtsFormSynthesizeConfig {
  id: string
  modelId: string
  baseUrl?: string
  apiKey?: string
  voice?: string
  speed?: number
  responseFormat?: string
  refAudioPath?: string
  promptText?: string
  promptLang?: string
  textLang?: string
}

/**
 * 与桌面 agent:tts-synthesize IPC 完全一致的合成路径：
 * 仅从 global_models（含 globalTtsProviderConfigs）读取 TTS 配置，可选覆盖 providerId / modelId。
 */
export async function synthesizeTtsFromSettings(
  registry: TtsProviderRegistry,
  input: TtsSynthesizeFromSettingsInput
): Promise<TtsSynthesizeFromSettingsResult> {
  try {
    const { globalModels, text, providerId, modelId } = input

    const ttsProviderId = providerId || globalModels?.globalTtsProviderId
    const ttsModelId = modelId || globalModels?.globalTtsModelId

    if (!ttsProviderId || !ttsModelId) {
      return { success: false, errorCode: 'tts_not_configured' }
    }

    const credentials = resolveTtsProviderCredentials(
      ttsProviderId,
      globalModels?.globalTtsProviderConfigs
    )

    let ttsProvider = registry.get(ttsProviderId)
    if (!ttsProvider) {
      ttsProvider = registry.findByModel(ttsModelId)
    }
    if (!ttsProvider) {
      return { success: false, errorCode: 'tts_provider_not_supported' }
    }

    const ttsSettings = globalModels?.globalTtsSettings

    const result = await ttsProvider.synthesize(
      {
        text,
        modelId: ttsModelId,
        settings: {
          voice: ttsSettings?.voice || '',
          speed: ttsSettings?.speed,
          responseFormat: ttsSettings?.responseFormat || '',
          refAudioPath: ttsSettings?.refAudioPath,
          promptText: ttsSettings?.promptText,
          promptLang: ttsSettings?.promptLang,
          textLang: ttsSettings?.textLang
        }
      },
      {
        baseUrl: resolveTtsProviderBaseUrl(ttsProviderId, credentials.baseUrl),
        apiKey: credentials.apiKey ?? ''
      }
    )

    return { success: true, audioBase64: result.audioBase64, format: result.format }
  } catch (error: unknown) {
    if (error instanceof TtsNotConfiguredError) {
      return { success: false, errorCode: 'tts_not_configured' }
    }
    if (error instanceof TtsProviderNotFoundError) {
      return { success: false, errorCode: 'tts_provider_not_found' }
    }
    if (error instanceof TtsApiError) {
      return {
        success: false,
        errorCode: 'tts_api_error',
        statusCode: error.statusCode,
        error: error.message
      }
    }
    if (error instanceof TtsInvalidResponseError) {
      return { success: false, errorCode: 'tts_invalid_response_data' }
    }

    const message = error instanceof Error ? error.message : String(error)
    return { success: false, errorCode: 'tts_synthesis_failed', error: message }
  }
}

/** 设置页试听：使用表单当前值，不依赖已保存的 global_models */
export async function synthesizeTtsFromFormConfig(
  registry: TtsProviderRegistry,
  config: TtsFormSynthesizeConfig,
  text: string
): Promise<TtsSynthesizeFromSettingsResult> {
  try {
    if (!config.id || !config.modelId) {
      return { success: false, errorCode: 'tts_not_configured' }
    }

    let ttsProvider = registry.get(config.id)
    if (!ttsProvider) {
      ttsProvider = registry.findByModel(config.modelId)
    }
    if (!ttsProvider) {
      return { success: false, errorCode: 'tts_provider_not_supported' }
    }

    const result = await ttsProvider.synthesize(
      {
        text,
        modelId: config.modelId,
        settings: {
          voice: config.voice || '',
          speed: config.speed,
          responseFormat: config.responseFormat || '',
          refAudioPath: config.refAudioPath,
          promptText: config.promptText,
          promptLang: config.promptLang,
          textLang: config.textLang
        }
      },
      {
        baseUrl: resolveTtsProviderBaseUrl(config.id, config.baseUrl),
        apiKey: config.apiKey?.trim() ?? ''
      }
    )

    return { success: true, audioBase64: result.audioBase64, format: result.format }
  } catch (error: unknown) {
    if (error instanceof TtsApiError) {
      return {
        success: false,
        errorCode: 'tts_api_error',
        statusCode: error.statusCode,
        error: error.message
      }
    }
    if (error instanceof TtsInvalidResponseError) {
      return { success: false, errorCode: 'tts_invalid_response_data' }
    }

    const message = error instanceof Error ? error.message : String(error)
    return { success: false, errorCode: 'tts_synthesis_failed', error: message }
  }
}
