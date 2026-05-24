import {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderConfig
} from '../types/tts.types'
import { TtsApiError } from './tts.errors'

export class OpenAiTtsProvider implements TtsProvider {
  readonly id = 'openai-tts'
  readonly name = 'OpenAI 兼容 TTS'

  supportsModel(modelId: string): boolean {
    return !modelId.toLowerCase().includes('mimo-v2.5-tts')
  }

  async synthesize(
    request: TtsSynthesizeRequest,
    config: TtsProviderConfig
  ): Promise<TtsSynthesizeResponse> {
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const endpoint = `${baseUrl}/audio/speech`

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
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
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (const byte of bytes) {
      binary += String.fromCharCode(byte)
    }
    const audioBase64 = btoa(binary)

    return {
      audioBase64,
      format: request.settings.responseFormat || 'mp3'
    }
  }
}
