import {
  CloneTtsProvider,
  GptSovitsProvider,
  MimoTtsProvider,
  OpenAiTtsProvider,
  TtsApiError,
  TtsProviderRegistry
} from '@baishou/shared'
import type { TtsProviderConfig } from '@baishou/ui/native'

export type TtsTestResult =
  | { success: true; audioBase64: string; format: string }
  | { success: false; error: string }

const registry = new TtsProviderRegistry()
registry.register(new OpenAiTtsProvider())
registry.register(new MimoTtsProvider())
registry.register(new CloneTtsProvider())
registry.register(new GptSovitsProvider())

/** 与桌面 agent:tts-synthesize / TTS Registry 一致的试听请求 */
export async function synthesizeTtsForTest(
  config: TtsProviderConfig,
  text: string
): Promise<TtsTestResult> {
  const sample = text.trim() || 'Hello'
  const provider = registry.get(config.id) ?? registry.findByModel(config.modelId)
  if (!provider) {
    return { success: false, error: 'tts_provider_not_supported' }
  }

  try {
    const result = await provider.synthesize(
      {
        text: sample,
        modelId: config.modelId,
        settings: {
          voice: config.voice,
          speed: config.speed,
          responseFormat: config.responseFormat,
          refAudioPath: config.refAudioPath,
          promptText: config.promptText,
          promptLang: config.promptLang,
          textLang: config.textLang
        }
      },
      {
        baseUrl: (config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, ''),
        apiKey: config.apiKey?.trim() ?? ''
      }
    )

    return {
      success: true,
      audioBase64: result.audioBase64,
      format: result.format
    }
  } catch (error: unknown) {
    if (error instanceof TtsApiError) {
      return { success: false, error: error.message }
    }
    const message = error instanceof Error ? error.message : String(error)
    return { success: false, error: message }
  }
}
