import {
  TtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  TtsProviderConfig
} from '../types/tts.types'
import { TtsApiError } from './tts.errors'
import { normalizeRefAudioPath } from './ref-audio-path.util'
import { uint8ArrayToBase64 } from './bytes-base64'
import { readTtsRefAudioBytes } from './tts-ref-audio.util'
import { resolveRefAudioMimeFromBytes } from './ref-audio-format.util'

const GPT_SOVITS_GRADIO_FN_INDEX = 1
const GPT_SOVITS_GRADIO_CUT_METHOD = '凑四句一切'
const GPT_SOVITS_GRADIO_TOP_K = 15
const GPT_SOVITS_GRADIO_TOP_P = 1
const GPT_SOVITS_GRADIO_TEMPERATURE = 1
const GPT_SOVITS_GRADIO_PAUSE_SECOND = 0.3
const GPT_SOVITS_GRADIO_UPLOAD_FILENAME = 'reference.wav'

function toUploadFileUri(path: string): string {
  if (/^file:\/\//i.test(path)) {
    return path
  }
  // React Native FormData file parts expect a file:// URI.
  return `file://${path.replace(/\\/g, '/')}`
}

function isUnsupportedBlobPartError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return /Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported/i.test(message)
}

function createGradioUploadFormData(refAudioPath: string, audioBytes: Uint8Array): FormData {
  const formData = new FormData()
  const mime = resolveRefAudioMimeFromBytes(audioBytes, refAudioPath)
  try {
    const audioBuffer = audioBytes.buffer.slice(
      audioBytes.byteOffset,
      audioBytes.byteOffset + audioBytes.byteLength
    ) as ArrayBuffer
    formData.append('files', new Blob([audioBuffer], { type: mime }), GPT_SOVITS_GRADIO_UPLOAD_FILENAME)
    return formData
  } catch (error) {
    if (!isUnsupportedBlobPartError(error)) {
      throw error
    }
  }

  formData.append('files', {
    uri: toUploadFileUri(refAudioPath),
    name: GPT_SOVITS_GRADIO_UPLOAD_FILENAME,
    type: mime
  } as unknown as Blob)
  return formData
}

function normalizePositiveInt(value: unknown, fallback: number): number {
  const parsed = typeof value === 'string' ? Number.parseInt(value, 10) : Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback
}

function mapToGradioLanguageLabel(value: unknown): string {
  const normalized = String(value || 'zh')
    .trim()
    .toLowerCase()
  switch (normalized) {
    case 'all_zh':
    case 'zh':
    case 'zh-cn':
    case 'zh-hans':
      return '中文'
    case 'all_ja':
    case 'ja':
    case 'jp':
      return '日文'
    case 'all_ko':
    case 'ko':
      return '韩文'
    case 'all_yue':
    case 'yue':
      return '粤语'
    case 'en':
      return '英文'
    default:
      return '中文'
  }
}

function isAudioContentType(contentType: string | null): boolean {
  if (!contentType) {
    return true
  }
  const lower = contentType.toLowerCase()
  return (
    lower.includes('audio/') ||
    lower.includes('application/octet-stream') ||
    lower.includes('binary/octet-stream')
  )
}

async function responseToAudioBase64(response: Response): Promise<string> {
  const arrayBuffer = await response.arrayBuffer()
  return uint8ArrayToBase64(new Uint8Array(arrayBuffer))
}

function resolveGradioAudioUrl(baseUrl: string, payload: unknown): string | null {
  const firstItem = Array.isArray(payload) ? payload[0] : payload
  if (!firstItem) {
    return null
  }

  if (typeof firstItem === 'string') {
    if (/^https?:\/\//i.test(firstItem)) {
      return firstItem
    }
    if (firstItem.startsWith('/')) {
      return new URL(firstItem, `${baseUrl}/`).toString()
    }
    return `${baseUrl}/file=${encodeURIComponent(firstItem)}`
  }

  if (typeof firstItem !== 'object') {
    return null
  }

  const record = firstItem as Record<string, unknown>
  const rawUrl =
    (typeof record.url === 'string' && record.url) ||
    (typeof record.path === 'string' && record.path) ||
    (typeof record.name === 'string' && record.name) ||
    ''

  if (!rawUrl) {
    return null
  }

  if (/^https?:\/\//i.test(rawUrl)) {
    return rawUrl
  }
  if (rawUrl.startsWith('/')) {
    return new URL(rawUrl, `${baseUrl}/`).toString()
  }
  return `${baseUrl}/file=${encodeURIComponent(rawUrl)}`
}

async function waitForGradioQueueOutput(
  baseUrl: string,
  sessionHash: string,
  eventId: string
): Promise<Record<string, unknown>> {
  const queueUrl = new URL(`${baseUrl}/queue/data`)
  queueUrl.searchParams.set('session_hash', sessionHash)

  const response = await fetch(queueUrl.toString(), {
    headers: {
      Accept: 'text/event-stream'
    }
  })

  if (!response.ok) {
    throw new Error(`queue stream failed: ${response.status}`)
  }

  if (!response.body) {
    const sseText = await response.text()
    return extractGradioQueueOutputFromSseText(sseText, eventId)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let lastOutput: Record<string, unknown> | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) {
      throw new Error('queue stream ended before completion')
    }

    buffer += decoder.decode(value, { stream: true })
    while (buffer.includes('\n\n')) {
      const separatorIndex = buffer.indexOf('\n\n')
      const block = buffer.slice(0, separatorIndex)
      buffer = buffer.slice(separatorIndex + 2)

      const dataLine = block.split(/\r?\n/).find((line) => line.startsWith('data:'))
      if (!dataLine) {
        continue
      }

      const payload = JSON.parse(dataLine.slice(5)) as Record<string, unknown>
      if (payload.msg === 'heartbeat') {
        continue
      }
      if (payload.event_id !== eventId) {
        continue
      }

      const output =
        payload.output && typeof payload.output === 'object'
          ? (payload.output as Record<string, unknown>)
          : null

      if (output && Array.isArray(output.data)) {
        lastOutput = output
      }

      if (payload.msg === 'process_completed') {
        if (output && Array.isArray(output.data)) {
          return output
        }
        if (lastOutput) {
          return lastOutput
        }
        throw new Error(`queue completed without data: ${JSON.stringify(payload)}`)
      }
    }
  }
}

function extractGradioQueueOutputFromSseText(
  sseText: string,
  eventId: string
): Record<string, unknown> {
  let lastOutput: Record<string, unknown> | null = null
  const blocks = sseText.split(/\r?\n\r?\n/)

  for (const block of blocks) {
    const dataLine = block.split(/\r?\n/).find((line) => line.startsWith('data:'))
    if (!dataLine) {
      continue
    }

    const payload = JSON.parse(dataLine.slice(5)) as Record<string, unknown>
    if (payload.msg === 'heartbeat') {
      continue
    }
    if (payload.event_id !== eventId) {
      continue
    }

    const output =
      payload.output && typeof payload.output === 'object'
        ? (payload.output as Record<string, unknown>)
        : null

    if (output && Array.isArray(output.data)) {
      lastOutput = output
    }

    if (payload.msg === 'process_completed') {
      if (output && Array.isArray(output.data)) {
        return output
      }
      if (lastOutput) {
        return lastOutput
      }
      throw new Error(`queue completed without data: ${JSON.stringify(payload)}`)
    }
  }

  if (lastOutput) {
    return lastOutput
  }

  throw new Error('queue stream ended before completion')
}

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
    const refAudioPath = normalizeRefAudioPath((request.settings.refAudioPath as string) || '')
    const promptText = (request.settings.promptText as string) || ''
    const promptLang = ((request.settings.promptLang as string) || 'zh').toLowerCase()
    const textLang = ((request.settings.textLang as string) || 'zh').toLowerCase()
    const sampleSteps = normalizePositiveInt(request.settings.sampleSteps, 8)
    const format = request.settings.responseFormat || 'wav'

    if (!refAudioPath) {
      throw new TtsApiError('GPT-SoVITS 需要指定参考音频路径 (refAudioPath)', 400, this.id)
    }

    let lastConnectionError = ''
    try {
      const v2Url = `${baseUrl}/tts`
      const v2Payload = {
        text: request.text,
        text_lang: textLang,
        ref_audio_path: refAudioPath,
        prompt_text: promptText,
        prompt_lang: promptLang,
        speed_factor: speed,
        media_type: format,
        sample_steps: sampleSteps,
        streaming_mode: false
      }
      let response = await fetch(v2Url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v2Payload)
      })

      if (response.ok && isAudioContentType(response.headers.get('content-type'))) {
        return {
          audioBase64: await responseToAudioBase64(response),
          format
        }
      }

      // 如果返回 404，可能是 api.py (v1) 服务，回退到根路径 GET /
      if (response.status === 404 || !response.ok) {
        const v1Params = new URLSearchParams({
          text: request.text,
          text_language: textLang,
          refer_wav_path: refAudioPath,
          prompt_text: promptText,
          prompt_language: promptLang,
          speed: String(speed)
        })

        const v1Url = `${baseUrl}/?${v1Params.toString()}`

        response = await fetch(v1Url, { method: 'GET' })

        if (response.ok && isAudioContentType(response.headers.get('content-type'))) {
          return {
            audioBase64: await responseToAudioBase64(response),
            format
          }
        }
      }

      if (!response.ok) {
        await response.text().catch(() => '')
      }
    } catch (error) {
      lastConnectionError = error instanceof Error ? error.message : String(error)
    }

    try {
      const configUrl = `${baseUrl}/config`
      const configResponse = await fetch(configUrl, { method: 'GET' })

      if (!configResponse.ok) {
        if (lastConnectionError) {
          throw new TtsApiError(`GPT-SoVITS 无法连接到服务: ${lastConnectionError}`, 500, this.id)
        }
        throw new TtsApiError(
          'GPT-SoVITS 服务未暴露兼容接口（支持 api_v2 / api.py / Gradio WebUI）',
          500,
          this.id
        )
      }

      if (!promptText.trim()) {
        throw new TtsApiError(
          'GPT-SoVITS WebUI 模式需要填写参考音频文本 (promptText)',
          400,
          this.id
        )
      }

      const audioBytes = await readTtsRefAudioBytes(refAudioPath, 'gpt-sovits')
      const formData = createGradioUploadFormData(refAudioPath, audioBytes)

      const uploadUrl = `${baseUrl}/upload`
      const uploadResponse = await fetch(uploadUrl, { method: 'POST', body: formData })
      const uploadPayload = (await uploadResponse.json().catch(() => null)) as unknown
      const uploadedRefPath =
        Array.isArray(uploadPayload) && typeof uploadPayload[0] === 'string' ? uploadPayload[0] : ''

      if (!uploadResponse.ok || !uploadedRefPath) {
        throw new TtsApiError('GPT-SoVITS WebUI 上传参考音频失败', uploadResponse.status, this.id)
      }

      const sessionHash = `tts-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
      const queueJoinUrl = `${baseUrl}/queue/join`
      const gradioPayload = {
        data: [
          {
            path: uploadedRefPath,
            orig_name: GPT_SOVITS_GRADIO_UPLOAD_FILENAME
          },
          promptText,
          mapToGradioLanguageLabel(promptLang),
          request.text,
          mapToGradioLanguageLabel(textLang),
          GPT_SOVITS_GRADIO_CUT_METHOD,
          GPT_SOVITS_GRADIO_TOP_K,
          GPT_SOVITS_GRADIO_TOP_P,
          GPT_SOVITS_GRADIO_TEMPERATURE,
          false,
          speed,
          false,
          [],
          sampleSteps,
          false,
          GPT_SOVITS_GRADIO_PAUSE_SECOND
        ],
        fn_index: GPT_SOVITS_GRADIO_FN_INDEX,
        session_hash: sessionHash
      }
      const callResponse = await fetch(queueJoinUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gradioPayload)
      })
      const callPayload = (await callResponse.json().catch(() => null)) as {
        event_id?: string
      } | null
      const eventId = callPayload?.event_id || ''

      if (!callResponse.ok || !eventId) {
        throw new TtsApiError('GPT-SoVITS WebUI 调用失败', callResponse.status, this.id)
      }

      const queueOutput = await waitForGradioQueueOutput(baseUrl, sessionHash, eventId)

      if (queueOutput.error) {
        throw new TtsApiError(
          `GPT-SoVITS WebUI 合成失败: ${String(queueOutput.error)}`,
          500,
          this.id
        )
      }

      const audioUrl = resolveGradioAudioUrl(baseUrl, queueOutput.data)
      if (!audioUrl) {
        throw new TtsApiError('GPT-SoVITS WebUI 未返回可下载音频地址', 500, this.id)
      }

      const audioResponse = await fetch(audioUrl, { method: 'GET' })
      if (!audioResponse.ok) {
        throw new TtsApiError('GPT-SoVITS WebUI 音频下载失败', audioResponse.status, this.id)
      }

      return {
        audioBase64: await responseToAudioBase64(audioResponse),
        format
      }
    } catch (error) {
      if (error instanceof TtsApiError) {
        throw error
      }
      throw new TtsApiError(
        `GPT-SoVITS 无法连接到服务: ${error instanceof Error ? error.message : String(error)}`,
        500,
        this.id
      )
    }
  }
}
