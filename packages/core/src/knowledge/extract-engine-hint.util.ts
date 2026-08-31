import { isGarbledExtractText, type VisionExtractHintReason } from '@baishou/shared'
import { MIN_TEXT_LAYER_CHARS } from './knowledge-extract'

export interface VisionExtractHint {
  recommendVision: boolean
  reason: VisionExtractHintReason | null
  sampledPages: number
  usableTextPages: number
  garbledPages: number
  emptyPages: number
}

export function classifyExtractPageText(
  text: string
): 'usable' | 'garbled' | 'empty' {
  const trimmed = text.trim()
  if (trimmed.length < MIN_TEXT_LAYER_CHARS) return 'empty'
  if (isGarbledExtractText(trimmed)) return 'garbled'
  return 'usable'
}

/**
 * 根据文字层抽样判断是否应在抽取前提示改用视觉模型。
 * 可用页占比达到 60% 时不提示；损坏页达到 30% 时优先标为损坏文本层。
 */
export function recommendVisionExtract(pageTexts: string[]): VisionExtractHint {
  const sampledPages = pageTexts.length
  if (sampledPages === 0) {
    return {
      recommendVision: true,
      reason: 'empty-text-layer',
      sampledPages: 0,
      usableTextPages: 0,
      garbledPages: 0,
      emptyPages: 0
    }
  }

  let usableTextPages = 0
  let garbledPages = 0
  let emptyPages = 0
  for (const page of pageTexts) {
    const kind = classifyExtractPageText(page)
    if (kind === 'usable') usableTextPages += 1
    else if (kind === 'garbled') garbledPages += 1
    else emptyPages += 1
  }

  const usableRatio = usableTextPages / sampledPages
  const garbledRatio = garbledPages / sampledPages
  if (usableRatio >= 0.6) {
    return {
      recommendVision: false,
      reason: null,
      sampledPages,
      usableTextPages,
      garbledPages,
      emptyPages
    }
  }
  return {
    recommendVision: true,
    reason: garbledRatio >= 0.3 ? 'garbled-text-layer' : 'empty-text-layer',
    sampledPages,
    usableTextPages,
    garbledPages,
    emptyPages
  }
}
