import {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderConfig
} from '../types/tts.types'
import { TtsApiError, TtsInvalidResponseError } from './tts.errors'
import { buildMimoTtsAuthHeaders } from './tts-http'
import {
  buildMimoTtsChatCompletionBody,
  describeMimoVoiceCloneRefAudio,
  getMimoTtsModelMode
} from './mimo-tts.util'
import { collectMimoTtsStreamPcm16, pcm16ToWavBase64 } from './mimo-tts-stream.util'

function stableHash(value: string): string {
  let hash = 2166136261
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function describeAudioVoice(voice: unknown): Record<string, unknown> {
  if (typeof voice !== 'string' || !voice.trim()) {
    return { voiceKind: 'empty' }
  }

  if (!voice.startsWith('data:')) {
    return {
      voiceKind: 'preset',
      voice
    }
  }

  const match = /^data:([^;]+);base64,(.*)$/s.exec(voice)
  const mime = match?.[1] || 'unknown'
  const pureBase64 = match?.[2] || ''
  return {
    voiceKind: 'data-uri',
    voiceMime: mime,
    voiceBase64Length: pureBase64.length,
    voiceBase64Hash: stableHash(pureBase64)
  }
}

function describeMimoRequest(body: Record<string, unknown>, text: string): Record<string, unknown> {
  const audio =
    body.audio && typeof body.audio === 'object' ? (body.audio as Record<string, unknown>) : {}
  const messages = Array.isArray(body.messages) ? body.messages : []
  const userMessage = messages.find(
    (item) => item && typeof item === 'object' && (item as { role?: string }).role === 'user'
  ) as { content?: unknown } | undefined
  const assistantMessage = messages.find(
    (item) => item && typeof item === 'object' && (item as { role?: string }).role === 'assistant'
  ) as { content?: unknown } | undefined
  const userContent = typeof userMessage?.content === 'string' ? userMessage.content : ''
  const assistantContent =
    typeof assistantMessage?.content === 'string' ? assistantMessage.content : text

  return {
    model: body.model,
    stream: body.stream === true,
    audioFormat: audio.format,
    ...describeAudioVoice(audio.voice),
    userContentLength: userContent.length,
    userContentHash: userContent ? stableHash(userContent) : '',
    assistantTextLength: assistantContent.length,
    assistantTextHash: stableHash(assistantContent)
  }
}

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

    console.info('[MiMo TTS] request', describeMimoRequest(body, request.text))

    if (getMimoTtsModelMode(String(body.model || '')) === 'voiceclone') {
      try {
        const refInfo = await describeMimoVoiceCloneRefAudio(request.settings)
        console.info('[MiMo TTS] ref_audio', refInfo)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.warn('[MiMo TTS] ref_audio_describe_failed', { message })
      }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: buildMimoTtsAuthHeaders(config.apiKey, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      console.warn('[MiMo TTS] response_error', {
        status: response.status,
        bodyLength: errText.length,
        bodyHash: errText ? stableHash(errText) : ''
      })
      throw new TtsApiError(`TTS API 调用失败: ${errText}`, response.status, this.id)
    }

    if (body.stream === true) {
      const pcm = await collectMimoTtsStreamPcm16(response)
      console.info('[MiMo TTS] response_stream', {
        pcmBytes: pcm.byteLength,
        pcmHash: stableHash(String.fromCharCode(...pcm.slice(0, Math.min(pcm.length, 4096))))
      })
      return {
        audioBase64: pcm16ToWavBase64(pcm),
        format: 'wav'
      }
    }

    const resJson = await response.json()
    const base64Audio = resJson.choices?.[0]?.message?.audio?.data

    if (!base64Audio) {
      throw new TtsInvalidResponseError(this.id)
    }

    const audio =
      body.audio && typeof body.audio === 'object' ? (body.audio as Record<string, unknown>) : {}
    const responseFormat = String(audio.format || request.settings.responseFormat || 'wav')

    console.info('[MiMo TTS] response', {
      responseFormat,
      audioBase64Length: String(base64Audio).length,
      audioBase64Hash: stableHash(String(base64Audio))
    })

    return {
      audioBase64: base64Audio,
      format: responseFormat
    }
  }
}
