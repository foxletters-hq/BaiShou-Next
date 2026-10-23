export type VisionExtractHintReason = 'empty-text-layer' | 'garbled-text-layer'

export interface KnowledgeExtractHint {
  recommendVision: boolean
  reason: VisionExtractHintReason | null
  sampledPages: number
  usableTextPages: number
  garbledPages: number
  emptyPages: number
  fileName: string
  visionConfigured: boolean
  visionModelId?: string | null
}

export type KnowledgeExtractHintChoice = 'vision' | 'ocr' | 'keep' | 'cancel'

export function collectVisionExtractHints(hints: KnowledgeExtractHint[]): KnowledgeExtractHint[] {
  return hints.filter((row) => row.recommendVision)
}

export function pickVisionExtractHintReason(
  hints: KnowledgeExtractHint[]
): VisionExtractHintReason | null {
  if (hints.some((row) => row.reason === 'garbled-text-layer')) return 'garbled-text-layer'
  if (hints.some((row) => row.reason === 'empty-text-layer')) return 'empty-text-layer'
  return null
}
