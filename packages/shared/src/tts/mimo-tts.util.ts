import type { TtsProviderSettings } from '../types/tts.types'
import { TtsApiError } from './tts.errors'
import {
  assertMimoVoiceCloneAudioPath,
  normalizeRefAudioPath,
  isMimoVoiceCloneAudioExtension,
  resolveRefAudioMimeType
} from './ref-audio-path.util'
import {
  assertSupportedRefAudioBytes,
  describeRefAudioBytes,
  resolveRefAudioMimeFromBytes
} from './ref-audio-format.util'
import { base64ToUint8Array } from './bytes-base64'
import { readTtsRefAudioAsDataUri, registerTtsRefAudioReader } from './tts-ref-audio.util'

export { registerTtsRefAudioReader }
export type { TtsRefAudioReader } from './tts-ref-audio.util'

const hydratedRefAudioBase64ByPath = new Map<string, string>()

export function clearMimoRefAudioHydrationCache(): void {
  hydratedRefAudioBase64ByPath.clear()
}

export type MimoTtsModelMode = 'preset' | 'voicedesign' | 'voiceclone'

export const MIMO_TTS_VOICECLONE_MODEL_ID = 'mimo-v2.5-tts-voiceclone' as const

export const MIMO_TTS_DEFAULT_MODELS = [
  'mimo-v2.5-tts',
  'mimo-v2.5-tts-voicedesign',
  MIMO_TTS_VOICECLONE_MODEL_ID
] as const

const DEFAULT_PRESET_STYLE = 'Natural, clear and professional speech style.'
const MAX_VOICE_CLONE_AUDIO_BYTES = 10 * 1024 * 1024

export function getMimoTtsModelMode(modelId: string): MimoTtsModelMode {
  const lower = modelId.toLowerCase()
  if (
    lower.includes('voiceclone') ||
    lower.includes('voice-clone') ||
    lower.includes('voice_clone')
  ) {
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

export { resolveRefAudioMimeType }

/** 有参考音频时应使用 voiceclone 模型；避免仍走 preset 导致 API 忽略参考音频 */
export function resolveMimoTtsSynthesisModelId(
  modelId: string | undefined,
  refAudioPath: string | undefined,
  refAudioBase64?: string | undefined
): string {
  const refPath = normalizeRefAudioPath(refAudioPath || '')
  const hasRefBase64 = Boolean(String(refAudioBase64 || '').trim())
  const hasRefAudio = hasRefBase64 || Boolean(refPath && isMimoVoiceCloneAudioExtension(refPath))
  const resolved = modelId?.trim() || ''

  if (hasRefAudio) {
    if (!resolved || isMimoPresetModel(resolved)) {
      return MIMO_TTS_VOICECLONE_MODEL_ID
    }
    if (isMimoVoiceCloneModel(resolved)) {
      return resolved
    }
  }

  return resolved || 'mimo-v2.5-tts'
}

function stripRefAudioDataUriPrefix(value: string): string {
  return value.replace(/^data:[^;]+;base64,/, '').trim()
}

/** 合成前补齐参考音频 base64，避免移动端仅保存路径时读盘失败或配置缓存滞后 */
export async function hydrateMimoTtsProviderSettings(
  settings: TtsProviderSettings,
  modelId: string
): Promise<TtsProviderSettings> {
  const resolvedModelId = resolveMimoTtsSynthesisModelId(
    modelId,
    String(settings.refAudioPath || ''),
    String(settings.refAudioBase64 || '')
  )
  if (!isMimoVoiceCloneModel(resolvedModelId)) {
    return settings
  }

  const existing = stripRefAudioDataUriPrefix(String(settings.refAudioBase64 || ''))
  const refAudioPath = normalizeRefAudioPath(String(settings.refAudioPath || ''))

  // 有路径时优先读盘，避免持久化 base64 与磁盘文件不一致导致复刻失效
  if (refAudioPath && isMimoVoiceCloneAudioExtension(refAudioPath)) {
    try {
      const dataUri = await readTtsRefAudioAsDataUri(refAudioPath, 'mimo-tts')
      const pure = stripRefAudioDataUriPrefix(dataUri)
      hydratedRefAudioBase64ByPath.set(refAudioPath, pure)
      return { ...settings, voice: '', refAudioBase64: pure }
    } catch {
      if (!existing) {
        throw new TtsApiError(`无法读取参考音频文件: ${refAudioPath}`, 404, 'mimo-tts')
      }
    }
  }

  if (existing) {
    assertSupportedRefAudioBytes(base64ToUint8Array(existing), 'mimo-tts')
    return {
      ...settings,
      voice: '',
      refAudioBase64: existing
    }
  }

  if (!refAudioPath || !isMimoVoiceCloneAudioExtension(refAudioPath)) {
    return settings
  }

  const cached = hydratedRefAudioBase64ByPath.get(refAudioPath)
  if (cached) {
    return { ...settings, voice: '', refAudioBase64: cached }
  }

  const dataUri = await readTtsRefAudioAsDataUri(refAudioPath, 'mimo-tts')
  const pure = stripRefAudioDataUriPrefix(dataUri)
  hydratedRefAudioBase64ByPath.set(refAudioPath, pure)
  return { ...settings, voice: '', refAudioBase64: pure }
}

export async function describeMimoVoiceCloneRefAudio(
  settings: TtsProviderSettings
): Promise<ReturnType<typeof describeRefAudioBytes>> {
  const dataUri = await resolveMimoVoiceCloneDataUri(settings)
  const pure = dataUri.replace(/^data:[^;]+;base64,/, '')
  const bytes = base64ToUint8Array(pure)
  return describeRefAudioBytes(bytes, String(settings.refAudioPath || ''))
}

export async function resolveMimoVoiceCloneDataUri(settings: TtsProviderSettings): Promise<string> {
  const refAudioPath = normalizeRefAudioPath(String(settings.refAudioPath || ''))
  const refAudioBase64 = String(settings.refAudioBase64 || '').trim()

  if (refAudioBase64) {
    return buildMimoVoiceCloneDataUri(refAudioBase64, refAudioPath || 'audio.mp3')
  }

  const voiceField = String(settings.voice || '').trim()
  if (voiceField.startsWith('data:')) {
    return voiceField
  }

  if (!refAudioPath) {
    throw new TtsApiError('MiMo 音色复刻需要指定参考音频路径 (refAudioPath)', 400, 'mimo-tts')
  }

  assertMimoVoiceCloneAudioPath(refAudioPath)
  const dataUri = await readTtsRefAudioAsDataUri(refAudioPath, 'mimo-tts')
  const pure = dataUri.replace(/^data:[^;]+;base64,/, '')
  return buildMimoVoiceCloneDataUri(pure, refAudioPath)
}

function buildMimoVoiceCloneDataUri(pureOrPrefixedBase64: string, pathOrName: string): string {
  const pure = stripRefAudioDataUriPrefix(pureOrPrefixedBase64)
  const bytes = base64ToUint8Array(pure)
  assertSupportedRefAudioBytes(bytes, 'mimo-tts')
  if (bytes.length > MAX_VOICE_CLONE_AUDIO_BYTES) {
    throw new TtsApiError('参考音频文件不能超过 10MB', 400, 'mimo-tts')
  }
  const mime = resolveRefAudioMimeFromBytes(bytes, pathOrName)
  return `data:${mime};base64,${pure}`
}

export interface MimoTtsChatCompletionBody extends Record<string, unknown> {
  model: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  audio: Record<string, unknown>
  stream?: boolean
}

/** 官方文档：流式调用时 audio.format 须为 pcm16；音色复刻非流式示例为 wav */
export function resolveMimoTtsAudioFormat(
  mode: MimoTtsModelMode,
  responseFormat: string | undefined,
  stream: boolean
): string {
  if (stream) {
    return 'pcm16'
  }
  if (mode === 'voiceclone') {
    return 'wav'
  }
  return responseFormat?.trim() || 'wav'
}

export function shouldUseMimoTtsStreaming(
  mode: MimoTtsModelMode,
  streamPreference: boolean | undefined
): boolean {
  if (streamPreference !== true) return false
  // 官方：预置音色支持真流式；复刻/设计为兼容模式（推理完成后一次返回）
  return mode === 'preset' || mode === 'voiceclone' || mode === 'voicedesign'
}

export interface MimoTtsFormSynthesisInput {
  modelId: string
  voice?: string
  speed?: number
  responseFormat?: string
  refAudioPath?: string
  refAudioBase64?: string
  promptText?: string
  promptLang?: string
  textLang?: string
  stream?: boolean
}

/** 设置页试听：统一规范化 MiMo 参数，避免预置音色/流式/参考音频互相污染 */
export async function prepareMimoTtsFormSynthesis(input: MimoTtsFormSynthesisInput): Promise<{
  modelId: string
  settings: TtsProviderSettings
}> {
  const initialSettings: TtsProviderSettings = {
    voice: input.voice || '',
    speed: input.speed,
    responseFormat: input.responseFormat || 'wav',
    refAudioPath: input.refAudioPath,
    refAudioBase64: input.refAudioBase64,
    promptText: input.promptText,
    promptLang: input.promptLang,
    textLang: input.textLang,
    stream: input.stream
  }

  const preliminaryModelId = resolveMimoTtsSynthesisModelId(
    input.modelId,
    String(input.refAudioPath || ''),
    String(input.refAudioBase64 || '')
  )

  const hydrated = await hydrateMimoTtsProviderSettings(initialSettings, preliminaryModelId)
  const modelId = resolveMimoTtsSynthesisModelId(
    preliminaryModelId,
    String(hydrated.refAudioPath || ''),
    String(hydrated.refAudioBase64 || '')
  )
  const mode = getMimoTtsModelMode(modelId)

  if (mode === 'voiceclone') {
    const refBase64 = String(hydrated.refAudioBase64 || '').trim()
    if (!refBase64) {
      throw new TtsApiError('参考音频未就绪，请重新选择 wav/mp3 参考音频后再试听', 400, 'mimo-tts')
    }
    return {
      modelId: MIMO_TTS_VOICECLONE_MODEL_ID,
      settings: {
        ...hydrated,
        voice: '',
        stream: false,
        responseFormat: 'wav',
        refAudioBase64: refBase64.replace(/^data:[^;]+;base64,/, ''),
        promptText: String(hydrated.promptText || '').trim()
      }
    }
  }

  if (mode === 'voicedesign') {
    return {
      modelId,
      settings: {
        ...hydrated,
        voice: '',
        stream: input.stream === true
      }
    }
  }

  return {
    modelId,
    settings: {
      ...hydrated,
      voice: String(hydrated.voice || '').trim() || '冰糖',
      stream: input.stream === true
    }
  }
}

export async function buildMimoTtsChatCompletionBody(input: {
  modelId: string
  text: string
  settings: TtsProviderSettings
}): Promise<MimoTtsChatCompletionBody> {
  const modelId = resolveMimoTtsSynthesisModelId(
    input.modelId,
    String(input.settings.refAudioPath || ''),
    String(input.settings.refAudioBase64 || '')
  )
  const mode = getMimoTtsModelMode(modelId)
  const stream = shouldUseMimoTtsStreaming(mode, input.settings.stream as boolean | undefined)
  const format = resolveMimoTtsAudioFormat(
    mode,
    String(input.settings.responseFormat || ''),
    stream
  )
  const stylePrompt = String(input.settings.promptText || '').trim()

  let userContent = ''
  if (mode === 'voicedesign') {
    userContent = stylePrompt || 'A natural, clear speaking voice.'
  } else if (mode === 'preset') {
    userContent = stylePrompt || DEFAULT_PRESET_STYLE
  } else {
    // voiceclone：官方示例 user.content 为空字符串；仅在有风格指令时传入
    userContent = stylePrompt
  }

  const audio: Record<string, unknown> = { format }

  if (mode === 'preset') {
    const presetVoice = String(input.settings.voice || '').trim()
    audio.voice = presetVoice || '冰糖'
  } else if (mode === 'voiceclone') {
    audio.voice = await resolveMimoVoiceCloneDataUri(input.settings)
  } else if (mode === 'voicedesign') {
    audio.optimize_text_preview = true
  }

  const body: MimoTtsChatCompletionBody = {
    model: modelId,
    messages: [
      { role: 'user', content: userContent },
      { role: 'assistant', content: input.text }
    ],
    audio
  }

  if (stream) {
    body.stream = true
  }

  return body
}

export function validateMimoTtsSettings(
  modelId: string,
  settings: Partial<Pick<TtsProviderSettings, 'refAudioPath' | 'refAudioBase64' | 'promptText'>>
): string | null {
  const mode = getMimoTtsModelMode(modelId)
  const refPath = normalizeRefAudioPath(String(settings.refAudioPath || ''))
  const hasRefBase64 = Boolean(String(settings.refAudioBase64 || '').trim())
  if (mode === 'voiceclone') {
    if (!refPath && !hasRefBase64) {
      return 'mimo_ref_audio_required'
    }
    if (refPath && !isMimoVoiceCloneAudioExtension(refPath)) {
      return 'mimo_ref_audio_unsupported_format'
    }
  }
  if (mode === 'voicedesign' && !String(settings.promptText || '').trim()) {
    return 'mimo_voice_design_required'
  }
  return null
}
