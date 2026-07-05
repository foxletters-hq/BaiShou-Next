import { base64ToUint8Array, uint8ArrayToBase64 } from './bytes-base64'

export const MIMO_TTS_PCM16_SAMPLE_RATE = 24_000

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) {
    view.setUint8(offset + i, text.charCodeAt(i))
  }
}

/** 将 MiMo 流式 pcm16（24kHz mono LE）拼成 WAV base64，供现有播放器使用 */
export function pcm16ToWavBase64(
  pcm: Uint8Array,
  sampleRate: number = MIMO_TTS_PCM16_SAMPLE_RATE
): string {
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  writeAscii(view, 0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  writeAscii(view, 8, 'WAVE')
  writeAscii(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeAscii(view, 36, 'data')
  view.setUint32(40, pcm.length, true)

  const wav = new Uint8Array(44 + pcm.length)
  wav.set(new Uint8Array(header), 0)
  wav.set(pcm, 44)
  return uint8ArrayToBase64(wav)
}

function appendPcmChunk(chunks: Uint8Array[], chunk: Uint8Array): void {
  if (chunk.length > 0) {
    chunks.push(chunk)
  }
}

function extractStreamAudioBase64(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null
  const record = payload as {
    choices?: Array<{
      delta?: { audio?: { data?: string } }
      message?: { audio?: { data?: string } }
    }>
  }
  const choice = record.choices?.[0]
  const data = choice?.delta?.audio?.data || choice?.message?.audio?.data
  return typeof data === 'string' && data.trim() ? data : null
}

function collectMimoTtsStreamFromText(text: string): Uint8Array {
  const pcmChunks: Uint8Array[] = []

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line.startsWith('data:')) continue

    const data = line.slice(5).trim()
    if (!data || data === '[DONE]') continue

    try {
      const json = JSON.parse(data) as unknown
      const audioBase64 = extractStreamAudioBase64(json)
      if (audioBase64) {
        appendPcmChunk(pcmChunks, base64ToUint8Array(audioBase64))
      }
    } catch {
      /* 忽略非 JSON 行 */
    }
  }

  if (!pcmChunks.length) {
    throw new Error('MiMo TTS 流式响应未包含音频数据')
  }

  const total = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of pcmChunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

/** 解析 MiMo TTS SSE（OpenAI chat/completions 流式格式）并拼接 pcm16 */
export async function collectMimoTtsStreamPcm16(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  // React Native 默认 fetch 不提供 ReadableStream body，回退整包 text 解析
  if (!reader) {
    return collectMimoTtsStreamFromText(await response.text())
  }

  const decoder = new TextDecoder()
  let buffer = ''
  const pcmChunks: Uint8Array[] = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line.startsWith('data:')) continue

      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue

      try {
        const json = JSON.parse(data) as unknown
        const audioBase64 = extractStreamAudioBase64(json)
        if (audioBase64) {
          appendPcmChunk(pcmChunks, base64ToUint8Array(audioBase64))
        }
      } catch {
        /* 忽略非 JSON 行 */
      }
    }
  }

  const tail = buffer.trim()
  if (tail.startsWith('data:')) {
    const data = tail.slice(5).trim()
    if (data && data !== '[DONE]') {
      try {
        const json = JSON.parse(data) as unknown
        const audioBase64 = extractStreamAudioBase64(json)
        if (audioBase64) {
          appendPcmChunk(pcmChunks, base64ToUint8Array(audioBase64))
        }
      } catch {
        /* ignore */
      }
    }
  }

  if (!pcmChunks.length) {
    throw new Error('MiMo TTS 流式响应未包含音频数据')
  }

  const total = pcmChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of pcmChunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}
