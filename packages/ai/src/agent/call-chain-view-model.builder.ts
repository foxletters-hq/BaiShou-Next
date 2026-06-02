import type { MessageWithParts } from './message.adapter'
import {
  type DisplayContextMessage,
  formatMessageWithPartsForChain
} from './model-message-display.formatter'

export interface CallChainRound {
  roundIndex: number
  items: DisplayContextMessage[]
}

export interface CallChainRoundUsage {
  inputTokens: number
  outputTokens: number
  costMicros: number
}

export interface NextRequestEstimate {
  /** 下次请求预计上下文 token（系统提示词 + 历史，粗估） */
  estimatedInputTokens: number
  /** 上下文窗口配置的对话轮数上限（≤0 表示不截断） */
  contextRoundLimit: number
  /** 当前窗口内实际包含的对话轮数 */
  contextRoundCount: number
}

export const COMPACTION_SUMMARY_PREFIX = '[往期对话摘要压缩]'

export type CallChainFlatEntry =
  | { kind: 'system-prompt'; item: DisplayContextMessage }
  | { kind: 'compression-summary'; summaryText: string }
  | { kind: 'round-header'; roundIndex: number }
  | { kind: 'message'; item: DisplayContextMessage; roundIndex: number }

export interface CallChainViewModel {
  systemPrompt: string
  compressionSummary?: string
  rounds: CallChainRound[]
  flatEntries: CallChainFlatEntry[]
  activeRoundIndex: number
  roundUsage: CallChainRoundUsage | null
  nextRequest: NextRequestEstimate
}

export function estimateTextTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 3)
}

export function isCompactionSummaryMessage(item: DisplayContextMessage): boolean {
  return (
    item.role === 'system' &&
    typeof item.content === 'string' &&
    item.content.includes(COMPACTION_SUMMARY_PREFIX)
  )
}

export function extractCompactionSummaryText(content: string): string {
  const idx = content.indexOf(COMPACTION_SUMMARY_PREFIX)
  if (idx < 0) return content.trim()
  let rest = content.slice(idx + COMPACTION_SUMMARY_PREFIX.length).trim()
  if (rest.startsWith('：') || rest.startsWith(':')) {
    rest = rest.slice(1).trim()
  }
  return rest
}

/** 从调用链中拆出系统提示词、压缩摘要、压缩点之后的对话项 */
export function splitChainForCallChainView(chain: DisplayContextMessage[]): {
  historyAfterCompaction: DisplayContextMessage[]
  inlineCompactionSummary?: string
} {
  const historyAfterCompaction: DisplayContextMessage[] = []
  let inlineCompactionSummary: string | undefined

  for (const item of chain) {
    if (item.label === '系统提示词') continue
    if (isCompactionSummaryMessage(item)) {
      inlineCompactionSummary = extractCompactionSummaryText(item.content)
      continue
    }
    historyAfterCompaction.push(item)
  }

  return { historyAfterCompaction, inlineCompactionSummary }
}

export function groupChainIntoRounds(items: DisplayContextMessage[]): CallChainRound[] {
  const rounds: CallChainRound[] = []
  let current: DisplayContextMessage[] = []
  let roundIndex = 0

  const flush = () => {
    if (current.length === 0) return
    roundIndex++
    rounds.push({ roundIndex, items: [...current] })
    current = []
  }

  for (const item of items) {
    if (item.label === '系统提示词' || isCompactionSummaryMessage(item)) {
      continue
    }

    if (item.role === 'user') {
      if (current.some((x) => x.role === 'user')) {
        flush()
      }
      current.push(item)
    } else {
      current.push(item)
    }
  }

  flush()
  return rounds
}

/**
 * 仅将压缩锚点之后、且已进入上下文窗口的消息格式化为调用链轮次素材。
 * 避免把压缩前历史也算进「第 1 轮」。
 */
export function buildPostCompactionDisplayHistory(
  windowMessages: MessageWithParts[],
  compactionCutoffOrderIndex?: number
): DisplayContextMessage[] {
  const items: DisplayContextMessage[] = []

  for (const msg of windowMessages) {
    if (msg.isSummary) continue
    if (msg.role === 'system') continue
    if (
      compactionCutoffOrderIndex != null &&
      msg.orderIndex <= compactionCutoffOrderIndex
    ) {
      continue
    }
    items.push(...formatMessageWithPartsForChain(msg))
  }

  return items
}

function buildFlatEntries(
  systemPrompt: string,
  compressionSummary: string | undefined,
  rounds: CallChainRound[]
): CallChainFlatEntry[] {
  const entries: CallChainFlatEntry[] = []

  if (systemPrompt.trim()) {
    entries.push({
      kind: 'system-prompt',
      item: {
        role: 'system',
        content: systemPrompt,
        label: '系统提示词'
      }
    })
  }

  if (compressionSummary?.trim()) {
    entries.push({
      kind: 'compression-summary',
      summaryText: compressionSummary.trim()
    })
  }

  for (const round of rounds) {
    entries.push({ kind: 'round-header', roundIndex: round.roundIndex })
    for (const item of round.items) {
      entries.push({ kind: 'message', item, roundIndex: round.roundIndex })
    }
  }

  return entries
}

function resolveActiveRoundIndex(
  rounds: CallChainRound[],
  targetRole: string,
  targetOrderIndex: number,
  allMessages: Array<{ role: string; orderIndex: number; id?: string }>,
  compactionCutoffOrderIndex?: number
): number {
  if (rounds.length === 0) return 0

  let referenceUserOrderIndex = targetOrderIndex
  if (targetRole === 'assistant') {
    for (let i = allMessages.length - 1; i >= 0; i--) {
      const m = allMessages[i]!
      if (m.orderIndex < targetOrderIndex && m.role === 'user') {
        referenceUserOrderIndex = m.orderIndex
        break
      }
    }
  }

  const postCompactionUsers = allMessages
    .filter(
      (m) =>
        m.role === 'user' &&
        (compactionCutoffOrderIndex == null || m.orderIndex > compactionCutoffOrderIndex)
    )
    .sort((a, b) => a.orderIndex - b.orderIndex)

  let activeRound = 1
  for (let i = 0; i < postCompactionUsers.length; i++) {
    if (postCompactionUsers[i]!.orderIndex <= referenceUserOrderIndex) {
      activeRound = i + 1
    }
  }

  return Math.min(Math.max(activeRound, 1), rounds.length)
}

function resolveRoundUsage(
  target: {
    role: string
    orderIndex: number
    inputTokens?: number
    outputTokens?: number
    costMicros?: number
  },
  allMessages: Array<{
    role: string
    orderIndex: number
    inputTokens?: number
    outputTokens?: number
    costMicros?: number
  }>
): CallChainRoundUsage | null {
  if (target.role === 'assistant') {
    return {
      inputTokens: target.inputTokens ?? 0,
      outputTokens: target.outputTokens ?? 0,
      costMicros: target.costMicros ?? 0
    }
  }

  if (target.role === 'user') {
    const reply = allMessages
      .filter((m) => m.role === 'assistant' && m.orderIndex > target.orderIndex)
      .sort((a, b) => a.orderIndex - b.orderIndex)[0]
    if (!reply) return null
    return {
      inputTokens: reply.inputTokens ?? 0,
      outputTokens: reply.outputTokens ?? 0,
      costMicros: reply.costMicros ?? 0
    }
  }

  return null
}

export function buildCallChainViewModel(params: {
  chain: DisplayContextMessage[]
  systemPrompt: string
  recentCount: number
  target: {
    role: string
    orderIndex: number
    id?: string
    inputTokens?: number
    outputTokens?: number
    costMicros?: number
  }
  allMessages: Array<{
    role: string
    orderIndex: number
    id?: string
    inputTokens?: number
    outputTokens?: number
    costMicros?: number
  }>
  compressionSummary?: string
  compactionCutoffOrderIndex?: number
  /** 与发给模型一致的窗口消息（含快照注入），用于按锚点切分轮次 */
  windowMessages?: MessageWithParts[]
}): CallChainViewModel {
  const { inlineCompactionSummary } = splitChainForCallChainView(params.chain)
  const compressionSummary =
    params.compressionSummary?.trim() || inlineCompactionSummary?.trim() || undefined

  const historyForRounds = params.windowMessages?.length
    ? buildPostCompactionDisplayHistory(
        params.windowMessages,
        compressionSummary ? params.compactionCutoffOrderIndex : undefined
      )
    : splitChainForCallChainView(params.chain).historyAfterCompaction

  const rounds = groupChainIntoRounds(historyForRounds)
  const flatEntries = buildFlatEntries(params.systemPrompt, compressionSummary, rounds)

  const contextText = [
    params.systemPrompt,
    compressionSummary ?? '',
    ...historyForRounds.map((i) => i.content || '')
  ].join('\n')

  const nextRequest: NextRequestEstimate = {
    estimatedInputTokens: estimateTextTokens(contextText),
    contextRoundLimit: params.recentCount,
    contextRoundCount: rounds.length
  }

  return {
    systemPrompt: params.systemPrompt,
    compressionSummary,
    rounds,
    flatEntries,
    activeRoundIndex: resolveActiveRoundIndex(
      rounds,
      params.target.role,
      params.target.orderIndex,
      params.allMessages,
      params.compactionCutoffOrderIndex
    ),
    roundUsage: resolveRoundUsage(params.target, params.allMessages),
    nextRequest
  }
}
