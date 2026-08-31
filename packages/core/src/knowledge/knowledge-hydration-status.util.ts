const LIVE_STATUSES = new Set(['extracting', 'embedding'])
const COMPLETE_STATUSES = new Set(['ready', 'partial'])

export interface HydrationSourceDecision {
  /** 写入 upsert / 保留的 status */
  status: string
  /** 是否应排 embed job（进行中的 live 状态为 false） */
  needsEmbed: boolean
}

/**
 * 水合不得把半成品标 ready，也不得覆盖正在 extract/embed 的行。
 * 仅 ready/partial 且已有齐全 chunk、hash 未变时视为嵌入完成。
 */
export function resolveHydrationSourceDecision(input: {
  existingStatus?: string | null
  extractedHash: string | null
  hashChanged: boolean
  chunkCount: number
  /** 由正文 split 得到的应有块数；缺省时退回「有任意 chunk」 */
  expectedChunkCount?: number
}): HydrationSourceDecision {
  const existing = (input.existingStatus ?? '').trim()
  const hasText = Boolean(input.extractedHash)
  const hasChunks = input.chunkCount > 0
  const expected = input.expectedChunkCount
  const chunksComplete =
    expected == null || expected <= 0 || input.chunkCount >= expected
  const embedComplete =
    hasText &&
    hasChunks &&
    chunksComplete &&
    !input.hashChanged &&
    COMPLETE_STATUSES.has(existing)

  if (LIVE_STATUSES.has(existing)) {
    return { status: existing, needsEmbed: false }
  }

  if (embedComplete) {
    return { status: existing, needsEmbed: false }
  }

  if (existing === 'failed' && hasText && hasChunks && chunksComplete && !input.hashChanged) {
    return { status: 'failed', needsEmbed: false }
  }

  if (existing === 'needs_ocr' && !hasText) {
    return { status: 'needs_ocr', needsEmbed: false }
  }

  if (existing === 'stored' && !hasText) {
    return { status: 'stored', needsEmbed: false }
  }

  return {
    status: hasText ? 'pending' : existing === 'needs_ocr' ? 'needs_ocr' : 'pending',
    needsEmbed: hasText
  }
}

/** extracted 在而 extract-state 缺失 / hash 变了 / 窗口未完成 → 排 graph job */
export function resolveHydrationGraphDecision(input: {
  extractedHash: string | null
  extractState: {
    extractedTextHash: string
    windowsDone: number
    windowsTotal: number
  } | null
}): boolean {
  if (!input.extractedHash) return false
  const state = input.extractState
  if (!state) return true
  if (state.extractedTextHash !== input.extractedHash) return true
  return state.windowsTotal <= 0 || state.windowsDone < state.windowsTotal
}
