import { hexToUint8Array } from './bytes-hex'
import { TtsApiError } from './tts.errors'

type MinimaxT2aStreamChunk = {
  data?: {
    audio?: string
    status?: number
  } | null
  base_resp?: {
    status_code?: number
    status_msg?: string
  }
}

function appendHexChunks(chunks: string[], hex: string): void {
  const trimmed = hex.trim()
  if (trimmed) {
    chunks.push(trimmed)
  }
}

function mergeHexChunks(chunks: string[]): Uint8Array {
  if (!chunks.length) {
    throw new Error('MiniMax TTS 流式响应未包含音频数据')
  }

  const totalLength = chunks.reduce((sum, hex) => sum + hex.length, 0)
  const mergedHex = totalLength === chunks[0]!.length ? chunks[0]! : chunks.join('')
  return hexToUint8Array(mergedHex)
}

function parseMinimaxStreamPayload(raw: string): MinimaxT2aStreamChunk | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === '[DONE]') return null

  try {
    return JSON.parse(trimmed) as MinimaxT2aStreamChunk
  } catch {
    return null
  }
}

function consumeMinimaxStreamChunk(
  payload: MinimaxT2aStreamChunk,
  partialHexChunks: string[],
  finalHexRef: { value: string | null }
): void {
  const statusCode = payload.base_resp?.status_code
  if (statusCode !== undefined && statusCode !== 0) {
    const statusMsg = payload.base_resp?.status_msg || 'unknown error'
    throw new TtsApiError(`MiniMax TTS API 错误 (${statusCode}): ${statusMsg}`, 200, 'minimax-tts')
  }

  const audio = payload.data?.audio
  if (!audio) return

  const status = payload.data?.status
  if (status === 2) {
    finalHexRef.value = audio
    return
  }

  appendHexChunks(partialHexChunks, audio)
}

/** 解析 MiniMax T2A 流式响应（SSE data 行或逐行 JSON）并拼接音频字节 */
export async function collectMinimaxTtsStreamAudio(response: Response): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) {
    throw new Error('MiniMax TTS 流式响应无 body')
  }

  const decoder = new TextDecoder()
  let buffer = ''
  const partialHexChunks: string[] = []
  const finalHexRef = { value: null as string | null }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''

    for (const rawLine of lines) {
      const line = rawLine.trim()
      if (!line) continue

      const payloadText = line.startsWith('data:') ? line.slice(5).trim() : line
      const payload = parseMinimaxStreamPayload(payloadText)
      if (payload) {
        consumeMinimaxStreamChunk(payload, partialHexChunks, finalHexRef)
      }
    }
  }

  const tail = buffer.trim()
  if (tail) {
    const payloadText = tail.startsWith('data:') ? tail.slice(5).trim() : tail
    const payload = parseMinimaxStreamPayload(payloadText)
    if (payload) {
      consumeMinimaxStreamChunk(payload, partialHexChunks, finalHexRef)
    }
  }

  if (finalHexRef.value) {
    return hexToUint8Array(finalHexRef.value)
  }

  return mergeHexChunks(partialHexChunks)
}
