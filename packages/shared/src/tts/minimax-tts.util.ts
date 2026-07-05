export const MINIMAX_TTS_DEFAULT_MODELS = [
  'speech-2.8-hd',
  'speech-2.8-turbo',
  'speech-2.6-hd',
  'speech-2.6-turbo',
  'speech-02-hd',
  'speech-02-turbo',
  'speech-01-hd',
  'speech-01-turbo'
] as const

export const MINIMAX_TTS_DEFAULT_VOICE = 'male-qn-qingse'

export const MINIMAX_TTS_SUPPORTED_FORMATS = ['mp3', 'wav', 'flac', 'pcm', 'opus'] as const

export type MinimaxTtsAudioFormat = (typeof MINIMAX_TTS_SUPPORTED_FORMATS)[number]

export function isMinimaxTtsModel(modelId: string): boolean {
  const lower = modelId.trim().toLowerCase()
  return lower.startsWith('speech-')
}

export function resolveMinimaxTtsAudioFormat(format: string | undefined): MinimaxTtsAudioFormat {
  const normalized = (format || 'mp3').trim().toLowerCase()
  if ((MINIMAX_TTS_SUPPORTED_FORMATS as readonly string[]).includes(normalized)) {
    return normalized as MinimaxTtsAudioFormat
  }
  return 'mp3'
}

export function clampMinimaxTtsSpeed(speed: number | undefined): number {
  const value = speed ?? 1
  return Math.min(2, Math.max(0.5, value))
}

export function shouldUseMinimaxTtsStreaming(streamPreference: boolean | undefined): boolean {
  return streamPreference === true
}
