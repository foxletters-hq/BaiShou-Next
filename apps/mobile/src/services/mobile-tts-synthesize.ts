import {
  getDefaultTtsRegistry,
  synthesizeTtsFromSettings,
  synthesizeTtsFromFormConfig,
  synthesizeTtsSpeechContent,
  synthesizeAllTtsSpeechSegments,
  type GlobalModelsConfig,
  type TtsFormSynthesizeConfig,
  type TtsSpeechSynthesisOptions,
  type TtsSpeechSynthesisResult,
  type TtsSpeechSegmentsResult
} from '@baishou/shared'
import type { SettingsManagerService } from '@baishou/core-mobile'
import type { TtsProviderConfig } from '@baishou/ui/native'
import { getTtsPlaybackSettings } from './mobile-tts-settings.service'

export type TtsTestResult =
  | { success: true; audioBase64: string; format: string; fromCache?: boolean }
  | { success: false; error: string; errorCode?: string }

const registry = getDefaultTtsRegistry()

function toTestResult(
  result: Awaited<ReturnType<typeof synthesizeTtsFromSettings>>
): TtsTestResult {
  if (result.success) {
    return {
      success: true,
      audioBase64: result.audioBase64,
      format: result.format,
      fromCache: result.fromCache
    }
  }
  return {
    success: false,
    errorCode: result.errorCode,
    error: result.error || result.errorCode
  }
}

/** 与桌面 agent:tts-synthesize-speech 一致：分片合成 + 缓存 */
export async function synthesizeTtsSpeechFromSavedSettings(
  settingsManager: SettingsManagerService,
  content: string,
  options?: TtsSpeechSynthesisOptions & {
    providerId?: string
    modelId?: string
  }
): Promise<TtsSpeechSynthesisResult> {
  const { providerId, modelId, ...speechOptions } = options ?? {}
  const { globalModels } = await getTtsPlaybackSettings(settingsManager, {
    forceRefresh: true
  })
  return synthesizeTtsSpeechContent(
    registry,
    {
      globalModels: globalModels as GlobalModelsConfig | null | undefined,
      content,
      providerId,
      modelId
    },
    speechOptions
  )
}

/** 与桌面 api.tts.synthesize(text) 一致：从已保存的 global_models 合成单段 */
export async function synthesizeTtsFromSavedSettings(
  settingsManager: SettingsManagerService,
  text: string,
  providerId?: string,
  modelId?: string
): Promise<TtsTestResult> {
  const { globalModels } = await getTtsPlaybackSettings(settingsManager, {
    forceRefresh: true
  })
  return toTestResult(
    await synthesizeTtsFromSettings(registry, {
      globalModels: globalModels as GlobalModelsConfig | null | undefined,
      text,
      providerId,
      modelId
    })
  )
}

/** 并行合成全部分片，供后台连续播放使用 */
export async function synthesizeAllTtsSpeechFromSavedSettings(
  settingsManager: SettingsManagerService,
  content: string,
  options?: Pick<TtsSpeechSynthesisOptions, 'isCancelled' | 'useCache'> & {
    providerId?: string
    modelId?: string
  }
): Promise<TtsSpeechSegmentsResult> {
  const { providerId, modelId, ...speechOptions } = options ?? {}
  const { globalModels } = await getTtsPlaybackSettings(settingsManager)
  return synthesizeAllTtsSpeechSegments(
    registry,
    {
      globalModels: globalModels as GlobalModelsConfig | null | undefined,
      content,
      providerId,
      modelId
    },
    speechOptions
  )
}

/** 设置页试听：使用表单当前配置，不依赖已保存的 global_models */
export async function synthesizeTtsFromForm(
  config: TtsProviderConfig,
  text: string
): Promise<TtsTestResult> {
  const formConfig: TtsFormSynthesizeConfig = {
    id: config.id,
    modelId: config.modelId,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    voice: config.voice,
    speed: config.speed,
    responseFormat: config.responseFormat,
    refAudioPath: config.refAudioPath,
    promptText: config.promptText,
    promptLang: config.promptLang,
    textLang: config.textLang
  }
  return toTestResult(await synthesizeTtsFromFormConfig(registry, formConfig, text))
}

export type {
  TtsSpeechSegment,
  TtsSpeechSynthesisOptions,
  TtsSpeechSynthesisResult,
  TtsSpeechSegmentsResult
} from '@baishou/shared'
