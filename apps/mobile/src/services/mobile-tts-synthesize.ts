import {
  CloneTtsProvider,
  GptSovitsProvider,
  MimoTtsProvider,
  OpenAiTtsProvider,
  TtsProviderRegistry,
  synthesizeTtsFromFormConfig,
  synthesizeTtsSpeechContent,
  type GlobalModelsConfig,
  type TtsFormSynthesizeConfig,
  type TtsSpeechSegment,
  type TtsSpeechSynthesisOptions,
  type TtsSpeechSynthesisResult
} from '@baishou/shared'
import type { SettingsManagerService } from '@baishou/core-mobile'
import type { TtsProviderConfig } from '@baishou/ui/native'
import { getTtsPlaybackSettings } from './mobile-tts-settings.service'

export type TtsTestResult =
  | { success: true; audioBase64: string; format: string; fromCache?: boolean }
  | { success: false; error: string; errorCode?: string }

const registry = new TtsProviderRegistry()
registry.register(new OpenAiTtsProvider())
registry.register(new MimoTtsProvider())
registry.register(new CloneTtsProvider())
registry.register(new GptSovitsProvider())

/** 与桌面 agent:tts-synthesize IPC 一致：分片合成 + 缓存，配置走内存缓存 */
export async function synthesizeTtsSpeechFromSavedSettings(
  settingsManager: SettingsManagerService,
  content: string,
  options?: TtsSpeechSynthesisOptions & {
    providerId?: string
    modelId?: string
  }
): Promise<TtsSpeechSynthesisResult> {
  const { providerId, modelId, ...speechOptions } = options ?? {}
  const { globalModels } = await getTtsPlaybackSettings(settingsManager)
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
  const result = await synthesizeTtsFromFormConfig(registry, formConfig, text)
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

export type { TtsSpeechSegment, TtsSpeechSynthesisOptions, TtsSpeechSynthesisResult }
