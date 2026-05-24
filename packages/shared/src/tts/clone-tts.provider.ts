import {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderConfig
} from '../types/tts.types'
import { TtsApiError } from './tts.errors'

export class CloneTtsProvider implements TtsProvider {
  readonly id = 'clone-tts'
  readonly name = 'CloneTTS 本地服务'

  supportsModel(_modelId: string): boolean {
    // CloneTTS 不绑定特定的大模型 ID，支持任意音色代号作为模型/音色选择
    return true
  }

  async synthesize(
    request: TtsSynthesizeRequest,
    config: TtsProviderConfig
  ): Promise<TtsSynthesizeResponse> {
    const baseUrl = config.baseUrl.replace(/\/$/, '')

    // 换算语速：CloneTTS 以 10 代表 1.0x 语速，12 代表 1.2x，8 代表 0.8x
    const rawSpeed = request.settings.speed ?? 1.0
    const speedParam = Math.round(rawSpeed * 10)

    const params = new URLSearchParams({
      text: request.text,
      speed: String(speedParam),
      voice: request.settings.voice || request.modelId || ''
    })

    const endpoint = `${baseUrl}/api/tts?${params.toString()}`

    const response = await fetch(endpoint, {
      method: 'GET'
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new TtsApiError(`CloneTTS API 合成失败: ${errText}`, response.status, this.id)
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
