const LIVE_STATUSES = new Set(['extracting', 'embedding'])
const COMPLETE_STATUSES = new Set(['ready', 'partial'])

export interface HydrationSourceDecision {
  /** 写入 upsert / 保留的 status */
  status: string
  /** 是否应排 embed job（进行中的 live 状态为 false） */
  needsEmbed: boolean
}

export type HydrationEmbedLedger = {
  contentHash: string
  modelId: string
  dimension: number
  status: string
}

/**
 * 水合不得把半成品标 ready，也不得覆盖正在 extract/embed 的行。
 * 传入 ledger 时：ready|partial 且账本为当前版本 embedded 才算完成。
 * failed 账本计入待嵌入，但不自动重试。
 * 未传入 ledger 时沿用 chunk 齐全口径，兼容旧调用方。
 */
export function resolveHydrationSourceDecision(input: {
  existingStatus?: string | null
  extractedHash: string | null
  hashChanged: boolean
  chunkCount: number
  /** 由正文 split 得到的应有块数；缺省时退回「有任意 chunk」 */
  expectedChunkCount?: number
  ledger?: HydrationEmbedLedger | null
  extractedContentHash?: string
  currentModelId?: string
  currentDimension?: number
}): HydrationSourceDecision {
  const existing = (input.existingStatus ?? '').trim()
  const hasText = Boolean(input.extractedHash)

  if (LIVE_STATUSES.has(existing)) {
    return { status: existing, needsEmbed: false }
  }

  if (existing === 'needs_ocr' && !hasText) {
    return { status: 'needs_ocr', needsEmbed: false }
  }

  if (existing === 'stored' && !hasText) {
    return { status: 'stored', needsEmbed: false }
  }

  if ('ledger' in input) {
    const ledger = input.ledger
    if (ledger?.status === 'failed' || existing === 'failed') {
      return { status: existing === 'failed' ? 'failed' : existing || 'failed', needsEmbed: false }
    }
    const ledgerMatch =
      !!ledger &&
      ledger.status === 'embedded' &&
      (!input.extractedContentHash || ledger.contentHash === input.extractedContentHash) &&
      (!input.currentModelId || ledger.modelId === input.currentModelId) &&
      (input.currentDimension == null ||
        input.currentDimension <= 0 ||
        ledger.dimension === input.currentDimension)
    const embedComplete =
      hasText &&
      !input.hashChanged &&
      COMPLETE_STATUSES.has(existing) &&
      ledgerMatch
    if (embedComplete) {
      return { status: existing, needsEmbed: false }
    }
    return {
      status: hasText ? 'pending' : existing === 'needs_ocr' ? 'needs_ocr' : 'pending',
      needsEmbed: hasText
    }
  }

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

  if (embedComplete) {
    return { status: existing, needsEmbed: false }
  }

  if (existing === 'failed' && hasText && hasChunks && chunksComplete && !input.hashChanged) {
    return { status: 'failed', needsEmbed: false }
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
