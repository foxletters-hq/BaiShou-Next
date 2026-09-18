import type { IAIProvider } from '@baishou/ai'
import type { ReasoningEffortSetting } from '@baishou/shared'

export interface GraphExtractLlmDeps {
  provider: IAIProvider
  modelId: string
  reasoningEffort?: ReasoningEffortSetting
}

export type GraphExtractLlmFn = (prompt: {
  system: string
  user: string
  signal?: AbortSignal
  onDelta?: (chars: number) => void
  onReasoning?: (chars: number) => void
}) => Promise<string | null>

export interface ExtractDiariesOptions {
  /** 稳定仓库身份（GraphRepository 键） */
  vaultId: string
  /** 写入 JSONL 的显示名快照 */
  vaultName: string
  /**
   * 日记第一人称/作者自称（须已由用户确认；空则拒绝抽取）。
   * 禁止使用「日记的主人」等占位称呼。
   */
  selfName: string
  /** Empty = all pending-reextract */
  filePaths?: string[]
  onProgress?: (p: { current: number; total: number; filePath: string }) => void
  /** Cancel mid-batch: abort in-flight model streams; already-written diaries stay committed. */
  signal?: AbortSignal
}

export interface ExtractDiariesResult {
  done: number
  failed: number
  cancelled?: boolean
  errors: Array<{ filePath: string; message: string }>
}

export type GraphExtractAlignDeps = {
  embedQuery?: (text: string) => Promise<number[] | null>
  modelId?: string
  isEmbeddingConfigured?: () => boolean | Promise<boolean>
  isDiaryEmbedded?: (filePath: string) => boolean | Promise<boolean>
}

export type GraphExtractDraftEntity = {
  name: string
  type: string
  aliases: string[]
  summary: string
  confidence: number
}

export type GraphExtractDraftEdge = {
  from: string
  to: string
  type: string
  excerpt: string
  confidence: number
}

export type GraphExtractDraft = {
  vaultId: string
  vaultName: string
  filePath: string
  contentHash: string
  hash: string
  dateStr: string | null
  shardMonth: string
  validFrom: number
  entities: GraphExtractDraftEntity[]
  edges: GraphExtractDraftEdge[]
  /** 本篇原文前 800 字，只给同名多候选判定用。 */
  sourceContext?: string
}

/** Conservative (overestimate) time for first-run graph extraction guide. */
export interface ExtractionCostEstimate {
  entryCount: number
  estimatedTokens: number
  estimatedMinutesLow: number
  estimatedMinutesHigh: number
}
