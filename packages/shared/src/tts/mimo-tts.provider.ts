import {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderConfig
} from '../types/tts.types'
import { TtsApiError, TtsInvalidResponseError } from './tts.errors'
import { buildTtsAuthHeaders } from './tts-http'
import { buildMimoTtsChatCompletionBody } from './mimo-tts.util'

export class MimoTtsProvider implements TtsProvider {
  readonly id = 'mimo-tts'
  readonly name = '小米 MiMo TTS'

  supportsModel(modelId: string): boolean {
    return modelId.toLowerCase().includes('mimo-v2.5-tts')
  }

  async synthesize(
    request: TtsSynthesizeRequest,
    config: TtsProviderConfig
  ): Promise<TtsSynthesizeResponse> {
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const endpoint = `${baseUrl}/chat/completions`

    let body: Record<string, unknown>
    try {
      body = await buildMimoTtsChatCompletionBody({
        modelId: request.modelId,
        text: request.text,
        settings: request.settings
      })
    } catch (error) {
      if (error instanceof TtsApiError) {
        throw error
      }
      const message = error instanceof Error ? error.message : String(error)
      throw new TtsApiError(`MiMo TTS 请求构建失败: ${message}`, 400, this.id)
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildTtsAuthHeaders(config.apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new TtsApiError(`TTS API 调用失败: ${errText}`, response.status, this.id)
    }

    const resJson = await response.json()
    const base64Audio = resJson.choices?.[0]?.message?.audio?.data

    if (!base64Audio) {
      throw new TtsInvalidResponseError(this.id)
    }

    return {
      audioBase64: base64Audio,
      format: request.settings.responseFormat || 'wav'
    }
  }
}
