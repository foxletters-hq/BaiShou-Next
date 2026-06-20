import { TtsApiError } from './tts.errors'

const MIMO_VOICE_CLONE_EXTENSIONS = ['.wav', '.mp3', '.mpeg'] as const

/** 清理用户粘贴路径中多余的引号与空白 */
export function normalizeRefAudioPath(raw: string): string {
  let path = raw.trim()
  while (
    (path.startsWith('"') && path.endsWith('"')) ||
    (path.startsWith("'") && path.endsWith("'"))
  ) {
    path = path.slice(1, -1).trim()
  }
  return path
}

export function isMimoVoiceCloneAudioExtension(path: string): boolean {
  const lower = normalizeRefAudioPath(path).toLowerCase()
  return MIMO_VOICE_CLONE_EXTENSIONS.some((ext) => lower.endsWith(ext))
}

export function assertMimoVoiceCloneAudioPath(path: string): void {
  const normalized = normalizeRefAudioPath(path)
  if (!normalized) {
    throw new TtsApiError('MiMo 音色复刻需要指定参考音频路径 (refAudioPath)', 400, 'mimo-tts')
  }
  if (!isMimoVoiceCloneAudioExtension(normalized)) {
    throw new TtsApiError(
      'MiMo 音色复刻仅支持 wav/mp3 参考音频，请将文件转换后再试',
      400,
      'mimo-tts'
    )
  }
}

export function resolveRefAudioMimeType(pathOrName: string): string {
  const lower = normalizeRefAudioPath(pathOrName).toLowerCase()
  if (lower.endsWith('.wav')) {
    return 'audio/wav'
  }
  // 官方文档示例使用 audio/mpeg；亦支持 audio/mp3
  return 'audio/mpeg'
}
