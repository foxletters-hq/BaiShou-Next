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
