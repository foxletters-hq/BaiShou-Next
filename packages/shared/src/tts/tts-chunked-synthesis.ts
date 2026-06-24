import type { GlobalModelsConfig } from '../types/settings.types'
import type { TtsProviderRegistry } from './tts.registry'
import {
  normalizeTtsWhitespace,
  prepareTtsSpeechChunks,
  stripFencedCodeBlocks
} from './tts-text-preprocess'
import { resolveTtsSynthesisSettings } from './tts-defaults'
import { isMimoVoiceCloneModel, resolveMimoTtsSynthesisModelId } from './mimo-tts.util'
import { resolveTtsStreamingEnabled } from './tts-stream.util'
import {
  synthesizeTtsFromSettings,
  type TtsSynthesizeFromSettingsInput,
  type TtsSynthesizeFromSettingsResult
} from './synthesize-from-settings'

export interface TtsSpeechSegment {
  text: string
  audioBase64: string
  format: string
  fromCache: boolean
}

export type TtsSpeechSynthesisFailure = Extract<TtsSynthesizeFromSettingsResult, { success: false }>

export type TtsSpeechSynthesisResult =
  | { success: true; segmentCount: number }
  | TtsSpeechSynthesisFailure

export type TtsSpeechSegmentsResult =
  | { success: true; segments: TtsSpeechSegment[] }
  | TtsSpeechSynthesisFailure

function toTtsSpeechFailure(result: TtsSpeechSynthesisFailure): TtsSpeechSynthesisFailure {
  return {
    success: false,
    errorCode: result.errorCode,
    error: result.error,
    statusCode: result.statusCode
  }
}

export interface TtsSpeechSynthesisOptions {
  isCancelled?: () => boolean
  onSegmentReady?: (segment: TtsSpeechSegment, index: number) => Promise<void>
  useCache?: boolean
}

/**
 * MiMo 音色复刻每次独立请求会导致音色漂移；官方要求整段 assistant 文本一次合成。
 * 复刻模式整段朗读，预置音色仍按句分片。
 */
export function prepareTtsSpeechChunksForInput(
  content: string,
  globalModels: GlobalModelsConfig | null | undefined,
  providerId?: string
): string[] {
  const activeProviderId = providerId || globalModels?.globalTtsProviderId || ''
  if (activeProviderId === 'mimo-tts' && globalModels) {
    const merged = resolveTtsSynthesisSettings(globalModels, 'mimo-tts')
    const modelId = resolveMimoTtsSynthesisModelId(
      merged.modelId || globalModels.globalTtsModelId,
      merged.refAudioPath,
      merged.refAudioBase64
    )
    if (isMimoVoiceCloneModel(modelId)) {
      const single = normalizeTtsWhitespace(stripFencedCodeBlocks(content))
      return single ? [single] : []
    }
  }

  if (activeProviderId === 'minimax-tts' && globalModels) {
    const merged = resolveTtsSynthesisSettings(globalModels, 'minimax-tts')
    const streamEnabled = resolveTtsStreamingEnabled(
      'minimax-tts',
      merged.stream as boolean | undefined,
      merged.modelId || globalModels.globalTtsModelId
    )
    if (streamEnabled) {
      const single = normalizeTtsWhitespace(stripFencedCodeBlocks(content))
      return single ? [single] : []
    }
  }

  return prepareTtsSpeechChunks(content)
}

/**
 * 将完整消息预处理为分片后逐段合成；下一段在播放当前段时预取。
 */
export async function synthesizeTtsSpeechContent(
  registry: TtsProviderRegistry,
  input: Omit<TtsSynthesizeFromSettingsInput, 'text'> & { content: string },
  options?: TtsSpeechSynthesisOptions
): Promise<TtsSpeechSynthesisResult> {
  const chunks = prepareTtsSpeechChunksForInput(input.content, input.globalModels, input.providerId)
  if (!chunks.length) {
    return { success: false, errorCode: 'tts_empty_content' }
  }

  const { content: _content, ...baseInput } = input
  const synthOptions = { useCache: options?.useCache }

  async function synthChunk(text: string) {
    return synthesizeTtsFromSettings(registry, { ...baseInput, text }, synthOptions)
  }

  let prefetch: ReturnType<typeof synthChunk> | null = synthChunk(chunks[0]!)

  for (let i = 0; i < chunks.length; i++) {
    if (options?.isCancelled?.()) {
      return { success: false, errorCode: 'tts_cancelled' }
    }

    const result = await prefetch!
    prefetch = i + 1 < chunks.length ? synthChunk(chunks[i + 1]!) : null

    if (result.success === false) {
      return toTtsSpeechFailure(result)
    }

    const segment: TtsSpeechSegment = {
      text: chunks[i]!,
      audioBase64: result.audioBase64,
      format: result.format,
      fromCache: result.fromCache ?? false
    }

    if (options?.onSegmentReady) {
      await options.onSegmentReady(segment, i)
      if (options.isCancelled?.()) {
        return { success: false, errorCode: 'tts_cancelled' }
      }
    }
  }

  return { success: true, segmentCount: chunks.length }
}

/**
 * 并行合成全部分片后再播放，避免后台时 JS 无法衔接下一段。
 */
export async function synthesizeAllTtsSpeechSegments(
  registry: TtsProviderRegistry,
  input: Omit<TtsSynthesizeFromSettingsInput, 'text'> & { content: string },
  options?: Pick<TtsSpeechSynthesisOptions, 'isCancelled' | 'useCache'>
): Promise<TtsSpeechSegmentsResult> {
  const chunks = prepareTtsSpeechChunksForInput(input.content, input.globalModels, input.providerId)
  if (!chunks.length) {
    return { success: false, errorCode: 'tts_empty_content' }
  }

  if (options?.isCancelled?.()) {
    return { success: false, errorCode: 'tts_cancelled' }
  }

  const { content: _content, ...baseInput } = input
  const synthOptions = { useCache: options?.useCache }

  async function synthChunk(text: string) {
    return synthesizeTtsFromSettings(registry, { ...baseInput, text }, synthOptions)
  }

  const settled = await Promise.all(
    chunks.map(async (text, index) => {
      const result = await synthChunk(text)
      return { index, text, result }
    })
  )

  if (options?.isCancelled?.()) {
    return { success: false, errorCode: 'tts_cancelled' }
  }

  settled.sort((a, b) => a.index - b.index)

  const segments: TtsSpeechSegment[] = []
  for (const item of settled) {
    if (item.result.success === false) {
      return toTtsSpeechFailure(item.result)
    }

    segments.push({
      text: item.text,
      audioBase64: item.result.audioBase64,
      format: item.result.format,
      fromCache: item.result.fromCache ?? false
    })
  }

  return { success: true, segments }
}
