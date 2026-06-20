import { TtsApiError } from './tts.errors'
import { normalizeRefAudioPath } from './ref-audio-path.util'
import { base64ToUint8Array, uint8ArrayToBase64 } from './bytes-base64'
import { assertSupportedRefAudioBytes, resolveRefAudioMimeFromBytes } from './ref-audio-format.util'

export type TtsRefAudioReader = (path: string) => Promise<Uint8Array>
export type TtsRefAudioBase64Reader = (path: string) => Promise<string>

let ttsRefAudioReader: TtsRefAudioReader | null = null
let ttsRefAudioBase64Reader: TtsRefAudioBase64Reader | null = null

/** 注册平台侧参考音频读取器（移动端外部存储等）；桌面端默认走 node:fs */
export function registerTtsRefAudioReader(reader: TtsRefAudioReader | null): void {
  ttsRefAudioReader = reader
}

/** 注册平台侧 base64 直读（避免字节往返）；移动端优先使用 */
export function registerTtsRefAudioBase64Reader(reader: TtsRefAudioBase64Reader | null): void {
  ttsRefAudioBase64Reader = reader
}

function mapRefAudioReadError(error: unknown, normalizedPath: string, providerId: string): never {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: string }).code)
      : ''
  if (code === 'ENOENT') {
    throw new TtsApiError(`参考音频文件不存在: ${normalizedPath}`, 404, providerId)
  }
  const message = error instanceof Error ? error.message : String(error)
  throw new TtsApiError(`读取参考音频失败: ${message}`, 500, providerId)
}

/** 按路径读取参考音频字节；优先使用平台注册的读取器 */
export async function readTtsRefAudioBytes(path: string, providerId: string): Promise<Uint8Array> {
  const normalizedPath = normalizeRefAudioPath(path)
  if (!normalizedPath) {
    throw new TtsApiError('需要指定参考音频路径 (refAudioPath)', 400, providerId)
  }

  if (ttsRefAudioReader) {
    try {
      return await ttsRefAudioReader(normalizedPath)
    } catch (error: unknown) {
      mapRefAudioReadError(error, normalizedPath, providerId)
    }
  }

  const { readFile } = await import('node:fs/promises')
  try {
    return new Uint8Array(await readFile(normalizedPath))
  } catch (error: unknown) {
    mapRefAudioReadError(error, normalizedPath, providerId)
  }
}

/** 读取参考音频并构造 MiMo / Gradio 所需的 data URI */
export async function readTtsRefAudioAsDataUri(path: string, providerId: string): Promise<string> {
  const normalizedPath = normalizeRefAudioPath(path)
  if (!normalizedPath) {
    throw new TtsApiError('需要指定参考音频路径 (refAudioPath)', 400, providerId)
  }

  if (ttsRefAudioBase64Reader) {
    try {
      const base64 = (await ttsRefAudioBase64Reader(normalizedPath)).trim()
      if (!base64) {
        throw new TtsApiError('参考音频文件为空或读取失败', 400, providerId)
      }
      const pure = base64.replace(/^data:[^;]+;base64,/, '')
      const bytes = base64BytesOrThrow(pure, providerId)
      const mime = resolveRefAudioMimeFromBytes(bytes, normalizedPath)
      return `data:${mime};base64,${pure}`
    } catch (error: unknown) {
      mapRefAudioReadError(error, normalizedPath, providerId)
    }
  }

  const bytes = await readTtsRefAudioBytes(normalizedPath, providerId)
  if (bytes.length === 0) {
    throw new TtsApiError('参考音频文件为空或读取失败', 400, providerId)
  }
  assertSupportedRefAudioBytes(bytes, providerId)
  const mime = resolveRefAudioMimeFromBytes(bytes, normalizedPath)
  return `data:${mime};base64,${uint8ArrayToBase64(bytes)}`
}

function base64BytesOrThrow(pureBase64: string, providerId: string): Uint8Array {
  const bytes = base64ToUint8Array(pureBase64)
  assertSupportedRefAudioBytes(bytes, providerId)
  return bytes
}
