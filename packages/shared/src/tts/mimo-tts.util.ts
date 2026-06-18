import type { TtsProviderSettings } from '../types/tts.types'
import { TtsApiError } from './tts.errors'
import {
  assertMimoVoiceCloneAudioPath,
  normalizeRefAudioPath,
  isMimoVoiceCloneAudioExtension
} from './ref-audio-path.util'

export type MimoTtsModelMode = 'preset' | 'voicedesign' | 'voiceclone'

export const MIMO_TTS_DEFAULT_MODELS = [
  'mimo-v2.5-tts',
  'mimo-v2.5-tts-voicedesign',
  'mimo-v2.5-tts-voiceclone'
] as const

const DEFAULT_PRESET_STYLE = 'Natural, clear and professional speech style.'
const MAX_VOICE_CLONE_AUDIO_BYTES = 10 * 1024 * 1024

export function getMimoTtsModelMode(modelId: string): MimoTtsModelMode {
  const lower = modelId.toLowerCase()
  if (lower.includes('voiceclone')) {
    return 'voiceclone'
  }
  if (lower.includes('voicedesign')) {
    return 'voicedesign'
  }
  return 'preset'
}

export function isMimoVoiceCloneModel(modelId: string): boolean {
  return getMimoTtsModelMode(modelId) === 'voiceclone'
}

export function isMimoVoiceDesignModel(modelId: string): boolean {
  return getMimoTtsModelMode(modelId) === 'voicedesign'
}

export function isMimoPresetModel(modelId: string): boolean {
  return getMimoTtsModelMode(modelId) === 'preset'
}

export function resolveRefAudioMimeType(pathOrName: string): string {
  const lower = pathOrName.toLowerCase()
  if (lower.endsWith('.wav')) {
    return 'audio/wav'
  }
  return 'audio/mpeg'
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

async function readRefAudioFile(path: string): Promise<Uint8Array> {
  const normalizedPath = normalizeRefAudioPath(path)
  assertMimoVoiceCloneAudioPath(normalizedPath)

  const { readFile } = await import('node:fs/promises')
  try {
    return new Uint8Array(await readFile(normalizedPath))
  } catch (error: unknown) {
    const code =
      error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: string }).code)
        : ''
    if (code === 'ENOENT') {
      throw new TtsApiError(`参考音频文件不存在: ${normalizedPath}`, 404, 'mimo-tts')
    }
    const message = error instanceof Error ? error.message : String(error)
    throw new TtsApiError(`读取参考音频失败: ${message}`, 500, 'mimo-tts')
  }
}

export async function resolveMimoVoiceCloneDataUri(settings: TtsProviderSettings): Promise<string> {
  const voiceField = String(settings.voice || '').trim()
  if (voiceField.startsWith('data:')) {
    return voiceField
  }

  const refAudioBase64 = String(settings.refAudioBase64 || '').trim()
  if (refAudioBase64) {
    const mime = resolveRefAudioMimeType(String(settings.refAudioPath || 'audio.mp3'))
    const pure = refAudioBase64.replace(/^data:[^;]+;base64,/, '')
    return `data:${mime};base64,${pure}`
  }

  const refAudioPath = normalizeRefAudioPath(String(settings.refAudioPath || ''))
  if (!refAudioPath) {
    throw new TtsApiError('MiMo 音色复刻需要指定参考音频路径 (refAudioPath)', 400, 'mimo-tts')
  }

  const bytes = await readRefAudioFile(refAudioPath)
  if (bytes.length > MAX_VOICE_CLONE_AUDIO_BYTES) {
    throw new TtsApiError('参考音频文件不能超过 10MB', 400, 'mimo-tts')
  }

  const mime = resolveRefAudioMimeType(refAudioPath)
  return `data:${mime};base64,${uint8ArrayToBase64(bytes)}`
}

export interface MimoTtsChatCompletionBody {
  model: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  audio: Record<string, unknown>
}

export async function buildMimoTtsChatCompletionBody(input: {
  modelId: string
  text: string
  settings: TtsProviderSettings
}): Promise<MimoTtsChatCompletionBody> {
  const mode = getMimoTtsModelMode(input.modelId)
  const format = input.settings.responseFormat || 'wav'
  const stylePrompt = String(input.settings.promptText || '').trim()

  const userContent =
    mode === 'voicedesign'
      ? stylePrompt || 'A natural, clear speaking voice.'
      : stylePrompt || (mode === 'preset' ? DEFAULT_PRESET_STYLE : '')

  const audio: Record<string, unknown> = { format }

  if (mode === 'preset') {
    audio.voice = input.settings.voice || '冰糖'
  } else if (mode === 'voiceclone') {
    audio.voice = await resolveMimoVoiceCloneDataUri(input.settings)
  }

  return {
    model: input.modelId,
    messages: [
      { role: 'user', content: userContent },
      { role: 'assistant', content: input.text }
    ],
    audio
  }
}

export function validateMimoTtsSettings(
  modelId: string,
  settings: Pick<TtsProviderSettings, 'refAudioPath' | 'promptText'>
): string | null {
  const mode = getMimoTtsModelMode(modelId)
  const refPath = normalizeRefAudioPath(String(settings.refAudioPath || ''))
  if (mode === 'voiceclone') {
    if (!refPath) {
      return 'mimo_ref_audio_required'
    }
    if (!isMimoVoiceCloneAudioExtension(refPath)) {
      return 'mimo_ref_audio_unsupported_format'
    }
  }
  if (mode === 'voicedesign' && !String(settings.promptText || '').trim()) {
    return 'mimo_voice_design_required'
  }
  return null
}
