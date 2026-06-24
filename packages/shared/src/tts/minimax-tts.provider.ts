import {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderConfig
} from '../types/tts.types'
import { TtsApiError, TtsInvalidResponseError } from './tts.errors'
import { buildTtsAuthHeaders } from './tts-http'
import { uint8ArrayToBase64 } from './bytes-base64'
import { hexToUint8Array } from './bytes-hex'
import { collectMinimaxTtsStreamAudio } from './minimax-tts-stream.util'
import {
  MINIMAX_TTS_DEFAULT_VOICE,
  clampMinimaxTtsSpeed,
  isMinimaxTtsModel,
  resolveMinimaxTtsAudioFormat,
  shouldUseMinimaxTtsStreaming
} from './minimax-tts.util'

type MinimaxT2aV2Response = {
  data?: {
    audio?: string
    status?: number
  } | null
  base_resp?: {
    status_code?: number
    status_msg?: string
  }
}

function buildMinimaxTtsRequestBody(
  request: TtsSynthesizeRequest,
  stream: boolean
): Record<string, unknown> {
  const audioFormat = resolveMinimaxTtsAudioFormat(request.settings.responseFormat)

  return {
    model: request.modelId,
    text: request.text,
    stream,
    ...(stream
      ? {
          stream_options: {
            exclude_aggregated_audio: false
          }
        }
      : {}),
    voice_setting: {
      voice_id: request.settings.voice?.trim() || MINIMAX_TTS_DEFAULT_VOICE,
      speed: clampMinimaxTtsSpeed(request.settings.speed),
      vol: 1,
      pitch: 0
    },
    audio_setting: {
      sample_rate: 32000,
      bitrate: 128000,
      format: audioFormat,
      channel: 1
    }
  }
}

function parseMinimaxSyncResponse(
  resJson: MinimaxT2aV2Response,
  httpStatus: number
): Uint8Array {
  const statusCode = resJson.base_resp?.status_code
  if (statusCode !== undefined && statusCode !== 0) {
    const statusMsg = resJson.base_resp?.status_msg || 'unknown error'
    throw new TtsApiError(
      `MiniMax TTS API 错误 (${statusCode}): ${statusMsg}`,
      httpStatus,
      'minimax-tts'
    )
  }

  const hexAudio = resJson.data?.audio
  if (!hexAudio) {
    throw new TtsInvalidResponseError('minimax-tts')
  }

  return hexToUint8Array(hexAudio)
}

export class MinimaxTtsProvider implements TtsProvider {
  readonly id = 'minimax-tts'
  readonly name = 'MiniMax TTS'

  supportsModel(modelId: string): boolean {
    return isMinimaxTtsModel(modelId)
  }

  async synthesize(
    request: TtsSynthesizeRequest,
    config: TtsProviderConfig
  ): Promise<TtsSynthesizeResponse> {
    const baseUrl = config.baseUrl.replace(/\/$/, '')
    const endpoint = `${baseUrl}/t2a_v2`
    const audioFormat = resolveMinimaxTtsAudioFormat(request.settings.responseFormat)
    const stream = shouldUseMinimaxTtsStreaming(request.settings.stream as boolean | undefined)

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildTtsAuthHeaders(config.apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(buildMinimaxTtsRequestBody(request, stream))
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new TtsApiError(`MiniMax TTS API 调用失败: ${errText}`, response.status, this.id)
    }

    const audioBytes = stream
      ? await collectMinimaxTtsStreamAudio(response)
      : parseMinimaxSyncResponse((await response.json()) as MinimaxT2aV2Response, response.status)

    return {
      audioBase64: uint8ArrayToBase64(audioBytes),
      format: audioFormat
    }
  }
}
