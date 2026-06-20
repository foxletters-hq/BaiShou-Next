import { TtsApiError } from './tts.errors'
import { base64ToUint8Array } from './bytes-base64'
import { resolveRefAudioMimeType } from './ref-audio-path.util'

export type RefAudioSniffedFormat = 'wav' | 'mp3' | 'unknown'

export function sniffRefAudioFormat(bytes: Uint8Array): RefAudioSniffedFormat {
  if (bytes.length >= 12) {
    const riff = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)
    const wave = String.fromCharCode(bytes[8]!, bytes[9]!, bytes[10]!, bytes[11]!)
    if (riff === 'RIFF' && wave === 'WAVE') {
      return 'wav'
    }
  }

  if (bytes.length >= 3) {
    const id3 = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!)
    if (id3 === 'ID3') {
      return 'mp3'
    }
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1]! & 0xe0) === 0xe0) {
    return 'mp3'
  }

  return 'unknown'
}

export function refAudioMimeForFormat(format: RefAudioSniffedFormat): string | null {
  if (format === 'wav') return 'audio/wav'
  if (format === 'mp3') return 'audio/mpeg'
  return null
}

/** 优先按文件头识别 MIME；MiMo 文档要求 data URI 的 MIME 与实际样本格式一致 */
export function resolveRefAudioMimeFromBytes(bytes: Uint8Array, pathOrName?: string): string {
  const sniffed = sniffRefAudioFormat(bytes)
  const mime = refAudioMimeForFormat(sniffed)
  if (mime) return mime
  return resolveRefAudioMimeType(pathOrName || 'audio.mp3')
}

export function describeRefAudioBytes(
  bytes: Uint8Array,
  pathOrName?: string
): {
  sniffedFormat: RefAudioSniffedFormat
  pathMime: string
  sniffedMime: string
  mimeMismatch: boolean
  byteLength: number
  magicHex: string
} {
  const sniffedFormat = sniffRefAudioFormat(bytes)
  const pathMime = resolveRefAudioMimeType(pathOrName || '')
  const sniffedMime = resolveRefAudioMimeFromBytes(bytes, pathOrName)
  const magicHex = Array.from(bytes.slice(0, Math.min(bytes.length, 8)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return {
    sniffedFormat,
    pathMime,
    sniffedMime,
    mimeMismatch: Boolean(pathOrName?.trim()) && pathMime !== sniffedMime,
    byteLength: bytes.length,
    magicHex
  }
}

export function assertSupportedRefAudioBytes(
  bytes: Uint8Array,
  providerId = 'mimo-tts'
): RefAudioSniffedFormat {
  const format = sniffRefAudioFormat(bytes)
  if (format === 'unknown') {
    throw new TtsApiError(
      '参考音频不是有效的 wav/mp3 文件，请重新选择清晰的人声样本（避免 m4a/aac 等格式）',
      400,
      providerId
    )
  }
  if (bytes.length < 1024) {
    throw new TtsApiError('参考音频过短，请选择至少约 1 秒的清晰人声样本', 400, providerId)
  }
  return format
}

export function assertSupportedRefAudioBase64(
  base64: string,
  _pathOrName?: string,
  providerId = 'mimo-tts'
): RefAudioSniffedFormat {
  const pure = base64.replace(/^data:[^;]+;base64,/, '').trim()
  if (!pure) {
    throw new TtsApiError('参考音频为空，请重新选择 wav/mp3 文件', 400, providerId)
  }
  return assertSupportedRefAudioBytes(base64ToUint8Array(pure), providerId)
}
