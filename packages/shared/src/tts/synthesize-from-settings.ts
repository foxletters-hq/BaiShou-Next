import type { GlobalModelsConfig } from '../types/settings.types'
import type { TtsProviderSettings } from '../types/tts.types'
import {
  TtsApiError,
  TtsInvalidResponseError,
  TtsNotConfiguredError,
  TtsProviderNotFoundError
} from './tts.errors'
import {
  resolveTtsProviderBaseUrl,
  resolveTtsProviderCredentials,
  resolveTtsSynthesisSettings
} from './tts-defaults'
import {
  hydrateMimoTtsProviderSettings,
  prepareMimoTtsFormSynthesis,
  resolveMimoTtsSynthesisModelId
} from './mimo-tts.util'
import { resolveTtsStreamingEnabled, shouldUseTtsSynthesisCache } from './tts-stream.util'
import { refAudioCacheToken } from './ref-audio-pick.util'
import type { TtsProviderRegistry } from './tts.registry'
import {
  buildTtsSynthesisCacheKey,
  getGlobalTtsSynthesisCache,
  type TtsSynthesisCache
} from './tts-synthesis-cache'

export type TtsSynthesizeFromSettingsResult =
  | { success: true; audioBase64: string; format: string; fromCache?: boolean }
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
  refAudioBase64?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  stream?: boolean
}

export interface TtsSynthesizeOptions {
  useCache?: boolean
  cache?: TtsSynthesisCache
}

function optionalString(value: unknown): string | undefined {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || undefined
}

function optionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined
}

function toMimoProviderSettings(
  settings: ReturnType<typeof resolveTtsSynthesisSettings>
): TtsProviderSettings {
  return {
    voice: settings.voice || '',
    speed: settings.speed,
    responseFormat: settings.responseFormat || 'wav',
    refAudioPath: settings.refAudioPath,
    refAudioBase64: settings.refAudioBase64,
    promptText: settings.promptText,
    promptLang: settings.promptLang,
    textLang: settings.textLang,
    stream: settings.stream
  }
}

function resolveEffectiveTtsModelId(
  providerId: string,
  mergedSettings: ReturnType<typeof resolveTtsSynthesisSettings>,
  globalModels: GlobalModelsConfig | null | undefined,
  overrideModelId?: string
): string {
  const candidate =
    providerId === 'mimo-tts'
      ? mergedSettings.modelId || overrideModelId || globalModels?.globalTtsModelId || ''
      : overrideModelId || mergedSettings.modelId || globalModels?.globalTtsModelId || ''

  if (providerId === 'mimo-tts') {
    return resolveMimoTtsSynthesisModelId(
      candidate,
      mergedSettings.refAudioPath,
      mergedSettings.refAudioBase64
    )
  }
  return candidate
}

async function prepareMimoSynthesisSettings(
  providerId: string,
  mergedSettings: ReturnType<typeof resolveTtsSynthesisSettings>,
  modelId: string
) {
  if (providerId !== 'mimo-tts') {
    return mergedSettings
  }
  const hydrated = await hydrateMimoTtsProviderSettings(
    toMimoProviderSettings(mergedSettings),
    modelId
  )
  return {
    ...mergedSettings,
    ...hydrated
  }
}

/**
 * 与桌面 agent:tts-synthesize IPC 完全一致的合成路径：
 * 仅从 global_models（含 globalTtsProviderConfigs）读取 TTS 配置，可选覆盖 providerId / modelId。
 */
export async function synthesizeTtsFromSettings(
  registry: TtsProviderRegistry,
  input: TtsSynthesizeFromSettingsInput,
  options?: TtsSynthesizeOptions
): Promise<TtsSynthesizeFromSettingsResult> {
  try {
    const { globalModels, text, providerId, modelId } = input

    const ttsProviderId = providerId || globalModels?.globalTtsProviderId
    const mergedSettings = resolveTtsSynthesisSettings(globalModels, ttsProviderId || '')
    const preliminaryModelId = resolveEffectiveTtsModelId(
      ttsProviderId || '',
      mergedSettings,
      globalModels,
      modelId
    )
    const synthesisSettings = await prepareMimoSynthesisSettings(
      ttsProviderId || '',
      mergedSettings,
      preliminaryModelId
    )
    const ttsModelId = resolveEffectiveTtsModelId(
      ttsProviderId || '',
      synthesisSettings,
      globalModels,
      modelId
    )

    if (!ttsProviderId || !ttsModelId) {
      return { success: false, errorCode: 'tts_not_configured' }
    }

    const credentials = resolveTtsProviderCredentials(
      ttsProviderId,
      globalModels?.globalTtsProviderConfigs
    )

    const baseUrl = resolveTtsProviderBaseUrl(ttsProviderId, credentials.baseUrl)
    const voice = synthesisSettings.voice || ''
    const speed = synthesisSettings.speed ?? 1.0
    const responseFormat = synthesisSettings.responseFormat || ''
    const streamEnabled = resolveTtsStreamingEnabled(
      ttsProviderId || '',
      synthesisSettings.stream as boolean | undefined,
      ttsModelId
    )

    const useCache =
      options?.useCache !== false && shouldUseTtsSynthesisCache(ttsProviderId || '', streamEnabled)
    const cache = options?.cache ?? getGlobalTtsSynthesisCache()
    const cacheKey = buildTtsSynthesisCacheKey({
      providerId: ttsProviderId,
      modelId: ttsModelId,
      voice,
      speed,
      responseFormat,
      baseUrl,
      stream: streamEnabled,
      refAudioPath: optionalString(synthesisSettings.refAudioPath),
      refAudioToken: refAudioCacheToken(
        optionalString(synthesisSettings.refAudioPath),
        optionalString(synthesisSettings.refAudioBase64)
      ),
      promptText: optionalString(synthesisSettings.promptText),
      promptLang: optionalString(synthesisSettings.promptLang),
      textLang: optionalString(synthesisSettings.textLang),
      text
    })

    if (useCache) {
      const cached = cache.get(cacheKey)
      if (cached) {
        return {
          success: true,
          audioBase64: cached.audioBase64,
          format: cached.format,
          fromCache: true
        }
      }
    }

    let ttsProvider = registry.get(ttsProviderId)
    if (!ttsProvider) {
      ttsProvider = registry.findByModel(ttsModelId)
    }
    if (!ttsProvider) {
      return { success: false, errorCode: 'tts_provider_not_supported' }
    }

    const result = await ttsProvider.synthesize(
      {
        text,
        modelId: ttsModelId,
        settings: {
          voice,
          speed,
          responseFormat,
          refAudioPath: optionalString(synthesisSettings.refAudioPath),
          refAudioBase64: optionalString(synthesisSettings.refAudioBase64),
          promptText: optionalString(synthesisSettings.promptText),
          promptLang: optionalString(synthesisSettings.promptLang),
          textLang: optionalString(synthesisSettings.textLang),
          stream: optionalBoolean(streamEnabled ? true : synthesisSettings.stream)
        }
      },
      {
        baseUrl,
        apiKey: credentials.apiKey ?? ''
      }
    )

    if (useCache) {
      cache.set(cacheKey, result)
    }

    return {
      success: true,
      audioBase64: result.audioBase64,
      format: result.format,
      fromCache: false
    }
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
  text: string,
  options?: TtsSynthesizeOptions
): Promise<TtsSynthesizeFromSettingsResult> {
  try {
    if (!config.id || !config.modelId) {
      return { success: false, errorCode: 'tts_not_configured' }
    }

    const prepared =
      config.id === 'mimo-tts'
        ? await prepareMimoTtsFormSynthesis({
            modelId: config.modelId,
            voice: config.voice,
            speed: config.speed,
            responseFormat: config.responseFormat,
            refAudioPath: config.refAudioPath,
            refAudioBase64: config.refAudioBase64,
            promptText: config.promptText,
            promptLang: config.promptLang,
            textLang: config.textLang,
            stream: config.stream
          })
        : {
            modelId: config.modelId,
            settings: {
              voice: config.voice || '',
              speed: config.speed,
              responseFormat: config.responseFormat || '',
              refAudioPath: config.refAudioPath,
              refAudioBase64: config.refAudioBase64,
              promptText: config.promptText,
              promptLang: config.promptLang,
              textLang: config.textLang,
              stream: config.stream
            }
          }

    const effectiveModelId = prepared.modelId
    const synthesisSettings = prepared.settings

    const baseUrl = resolveTtsProviderBaseUrl(config.id, config.baseUrl)
    const voice = synthesisSettings.voice || ''
    const speed = synthesisSettings.speed ?? 1.0
    const responseFormat = synthesisSettings.responseFormat || ''

    const streamEnabled = resolveTtsStreamingEnabled(
      config.id,
      synthesisSettings.stream as boolean | undefined,
      effectiveModelId
    )

    const useCache =
      options?.useCache !== false && shouldUseTtsSynthesisCache(config.id, streamEnabled)
    const cache = options?.cache ?? getGlobalTtsSynthesisCache()
    const cacheKey = buildTtsSynthesisCacheKey({
      providerId: config.id,
      modelId: effectiveModelId,
      voice,
      speed,
      responseFormat,
      baseUrl,
      stream: streamEnabled,
      refAudioPath: optionalString(synthesisSettings.refAudioPath),
      refAudioToken: refAudioCacheToken(
        optionalString(synthesisSettings.refAudioPath),
        optionalString(synthesisSettings.refAudioBase64)
      ),
      promptText: optionalString(synthesisSettings.promptText),
      promptLang: optionalString(synthesisSettings.promptLang),
      textLang: optionalString(synthesisSettings.textLang),
      text
    })

    if (useCache) {
      const cached = cache.get(cacheKey)
      if (cached) {
        return {
          success: true,
          audioBase64: cached.audioBase64,
          format: cached.format,
          fromCache: true
        }
      }
    }

    let ttsProvider = registry.get(config.id)
    if (!ttsProvider) {
      ttsProvider = registry.findByModel(effectiveModelId)
    }
    if (!ttsProvider) {
      return { success: false, errorCode: 'tts_provider_not_supported' }
    }

    const result = await ttsProvider.synthesize(
      {
        text,
        modelId: effectiveModelId,
        settings: {
          voice,
          speed,
          responseFormat,
          refAudioPath: optionalString(synthesisSettings.refAudioPath),
          refAudioBase64: optionalString(synthesisSettings.refAudioBase64),
          promptText: optionalString(synthesisSettings.promptText),
          promptLang: optionalString(synthesisSettings.promptLang),
          textLang: optionalString(synthesisSettings.textLang),
          stream: optionalBoolean(streamEnabled ? true : synthesisSettings.stream)
        }
      },
      {
        baseUrl,
        apiKey: config.apiKey?.trim() ?? ''
      }
    )

    if (useCache) {
      cache.set(cacheKey, result)
    }

    return {
      success: true,
      audioBase64: result.audioBase64,
      format: result.format,
      fromCache: false
    }
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
