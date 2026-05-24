import {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderConfig
} from '../types/tts.types'
import { TtsApiError } from './tts.errors'

export class GptSovitsProvider implements TtsProvider {
  readonly id = 'gpt-sovits'
  readonly name = 'GPT-SoVITS 本地服务'

  supportsModel(_modelId: string): boolean {
    return true
  }

  async synthesize(
    request: TtsSynthesizeRequest,
    config: TtsProviderConfig
  ): Promise<TtsSynthesizeResponse> {
    const baseUrl = config.baseUrl.replace(/\/$/, '')

    // GPT-SoVITS 参数映射
    const speed = request.settings.speed ?? 1.0
    const refAudioPath = (request.settings.refAudioPath as string) || ''
    const promptText = (request.settings.promptText as string) || ''
    const promptLang = ((request.settings.promptLang as string) || 'zh').toLowerCase()
    const textLang = ((request.settings.textLang as string) || 'zh').toLowerCase()

    if (!refAudioPath) {
      throw new TtsApiError('GPT-SoVITS 需要指定参考音频路径 (refAudioPath)', 400, this.id)
    }

    const v2Params = new URLSearchParams({
      text: request.text,
      text_lang: textLang,
      ref_audio_path: refAudioPath,
      prompt_text: promptText,
      prompt_lang: promptLang,
      speed_factor: String(speed),
      media_type: request.settings.responseFormat || 'wav'
    })

    const v2Url = `${baseUrl}/tts?${v2Params.toString()}`
    let response: Response

    try {
      response = await fetch(v2Url, { method: 'GET' })
    } catch (error) {
      throw new TtsApiError(`GPT-SoVITS 无法连接到服务: ${(error as Error).message}`, 500, this.id)
    }

    // 如果返回 404，可能是 api.py (v1) 服务，回退到根路径 GET /
    if (response.status === 404) {
      const v1Params = new URLSearchParams({
        text: request.text,
        text_language: textLang,
        refer_wav_path: refAudioPath,
        prompt_text: promptText,
        prompt_language: promptLang,
        speed: String(speed)
      })

      const v1Url = `${baseUrl}/?${v1Params.toString()}`
      try {
        response = await fetch(v1Url, { method: 'GET' })
      } catch (error) {
        throw new TtsApiError(
          `GPT-SoVITS 无法连接到服务: ${(error as Error).message}`,
          500,
          this.id
        )
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new TtsApiError(`GPT-SoVITS API 合成失败: ${errText}`, response.status, this.id)
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
      format: request.settings.responseFormat || 'wav'
    }
  }
}
