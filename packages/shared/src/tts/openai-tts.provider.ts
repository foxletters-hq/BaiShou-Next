import {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderConfig
} from '../types/tts.types'
import { TtsApiError } from './tts.errors'
import { buildTtsAuthHeaders } from './tts-http'
import { uint8ArrayToBase64 } from './bytes-base64'

export class OpenAiTtsProvider implements TtsProvider {
  readonly id = 'openai-tts'
  readonly name = 'OpenAI 兼容 TTS'

  supportsModel(modelId: string): boolean {
    const lower = modelId.toLowerCase()
    if (lower.includes('mimo-v2.5-tts')) return false
    if (lower.startsWith('speech-')) return false
    return true
  }

  async synthesize(
    request: TtsSynthesizeRequest,
    config: TtsProviderConfig
  ): Promise<TtsSynthesizeResponse> {
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const endpoint = `${baseUrl}/audio/speech`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildTtsAuthHeaders(config.apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        model: request.modelId,
        input: request.text,
        voice: request.settings.voice || 'alloy',
        speed: request.settings.speed ?? 1.0,
        response_format: request.settings.responseFormat || 'mp3'
      })
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new TtsApiError(`TTS API 调用失败: ${errText}`, response.status, this.id)
    }

    const arrayBuffer = await response.arrayBuffer()
    const audioBase64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer))

    return {
      audioBase64,
      format: request.settings.responseFormat || 'mp3'
    }
  }
}
