import type { TtsProviderRegistry } from './tts.registry'
import { prepareTtsSpeechChunks } from './tts-text-preprocess'
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

export interface TtsSpeechSynthesisOptions {
  isCancelled?: () => boolean
  onSegmentReady?: (segment: TtsSpeechSegment, index: number) => Promise<void>
  useCache?: boolean
}

/**
 * 将完整消息预处理为分片后逐段合成；下一段在播放当前段时预取。
 */
export async function synthesizeTtsSpeechContent(
  registry: TtsProviderRegistry,
  input: Omit<TtsSynthesizeFromSettingsInput, 'text'> & { content: string },
  options?: TtsSpeechSynthesisOptions
): Promise<TtsSpeechSynthesisResult> {
  const chunks = prepareTtsSpeechChunks(input.content)
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

    if (!result.success) {
      return result
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
