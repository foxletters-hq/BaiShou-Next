import { estimateTextTokens } from './call-chain-view-model.builder'
import type { MessageWithParts } from './message.adapter'
import type {
  CompressionBatchResult,
  CompressionSnapshotRef,
  SessionCompressionConfig
} from './context-compression.types'
import { estimateMessagesTokens, hasEnoughMessagesForRecompress } from './context-compression-text'

/**
 * 触发压缩时的上下文 token 估算：与 ContextWindowBuilder 对齐——
 * 摘要 + 快照保留区 + recentCount 截断 + 系统提示词（粗估）。
 */
export function estimateContextTokensForTrigger(
  allMessages: MessageWithParts[],
  latestSnapshot: CompressionSnapshotRef | null,
  options?: { recentCount?: number; systemPrompt?: string }
): number {
  const retain = latestSnapshot
    ? resolveRetainMessagesAfterSnapshot(allMessages, latestSnapshot)
    : trimLeadingOrphanMessagesAfterSnapshot([...allMessages])

  const windowMessages =
    options?.recentCount != null && options.recentCount > 0
      ? sliceMessagesByRecentTurns(retain, options.recentCount)
      : retain

  let tokens = estimateMessagesTokens(windowMessages, true)
  const summary = latestSnapshot?.summaryText?.trim()
  if (summary) {
    tokens += estimateTextTokens(summary)
  }
  if (options?.systemPrompt?.trim()) {
    tokens += estimateTextTokens(options.systemPrompt.trim())
  }
  return tokens
}

/** 重发：只估上一张快照之后的消息，不含摘要、系统提示、recentCount */
export function estimateTokensSinceLastSnapshot(
  allMessages: MessageWithParts[],
  latestSnapshot: CompressionSnapshotRef
): number {
  return estimateMessagesTokens(resolveRetainMessagesAfterSnapshot(allMessages, latestSnapshot), true)
}

/** 解析快照之后应保留的消息（优先 tailStartMessageId，其次 coveredUpTo） */
export function resolveRetainMessagesAfterSnapshot(
  messages: MessageWithParts[],
  snapshot: CompressionSnapshotRef
): MessageWithParts[] {
  if (snapshot.tailStartMessageId) {
    const tailIdx = messages.findIndex((m) => m.id === snapshot.tailStartMessageId)
    if (tailIdx >= 0) {
      return trimLeadingOrphanMessagesAfterSnapshot(messages.slice(tailIdx))
    }
  }

  const cutoffIndex = resolveSnapshotCutoffIndex(messages, snapshot)
  if (cutoffIndex >= 0) {
    return trimLeadingOrphanMessagesAfterSnapshot(messages.slice(cutoffIndex + 1))
  }

  // 快照存在但锚点丢失时，不应把整段历史当作保留区（否则会误触发压缩）
  return trimLeadingOrphanMessagesAfterSnapshot([])
}

/** 与 ContextWindowBuilder 一致的按用户轮次截断（不含摘要占位消息） */
export function sliceMessagesByRecentTurns(
  messages: MessageWithParts[],
  recentCount: number
): MessageWithParts[] {
  if (recentCount <= 0 || messages.length === 0) return messages

  let startIndex = 0
  let rounds = 0

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]!
    const nextMsgInTimeline = i < messages.length - 1 ? messages[i + 1] : null
    const isUser = msg.role === 'user'

    if (isUser && (!nextMsgInTimeline || nextMsgInTimeline.role !== 'user')) {
      rounds++
    }

    if (rounds === recentCount && isUser) {
      startIndex = i
    } else if (rounds > recentCount) {
      break
    }
  }

  while (startIndex > 0 && startIndex < messages.length && messages[startIndex]!.role === 'tool') {
    startIndex--
  }

  return messages.slice(Math.max(0, startIndex))
}

function resolveSnapshotCutoffByIdOrOrder(
  allMessages: MessageWithParts[],
  snapshot: CompressionSnapshotRef
): number {
  const byId = allMessages.findIndex((m) => m.id === snapshot.coveredUpToMessageId)
  if (byId >= 0) return byId

  const orderIdx = Number(snapshot.coveredUpToMessageId)
  if (!Number.isNaN(orderIdx)) {
    return allMessages.findIndex((m) => m.orderIndex === orderIdx)
  }

  return -1
}

/** 解析快照截止点（兼容历史误存 orderIndex、锚点消息已删） */
export function resolveSnapshotCutoffIndex(
  allMessages: MessageWithParts[],
  snapshot: CompressionSnapshotRef | null,
  previousSnapshot?: CompressionSnapshotRef | null
): number {
  if (!snapshot) return -1

  const direct = resolveSnapshotCutoffByIdOrOrder(allMessages, snapshot)
  if (direct >= 0) return direct

  if (snapshot.messageCount != null && snapshot.messageCount > 0) {
    const prevCount = previousSnapshot?.messageCount ?? 0
    const spanLen = snapshot.messageCount - prevCount
    if (spanLen > 0) {
      const prevIdx = previousSnapshot
        ? resolveSnapshotCutoffByIdOrOrder(allMessages, previousSnapshot)
        : -1
      const startIdx = prevIdx >= 0 ? prevIdx + 1 : 0
      const endBySpan = startIdx + spanLen - 1
      if (endBySpan >= 0 && endBySpan < allMessages.length) return endBySpan
    }
  }

  return -1
}

/** 快照之后的消息：去掉因历史锚点落在 user 上而残留的孤立 assistant/tool 前缀 */
export function trimLeadingOrphanMessagesAfterSnapshot(
  messages: MessageWithParts[]
): MessageWithParts[] {
  let start = 0
  while (start < messages.length && messages[start]!.role !== 'user') {
    start++
  }
  return start > 0 ? messages.slice(start) : messages
}

/** 待压缩区末尾若只有未回复的用户消息，归入保留区，不参与摘要 */
export function trimTrailingIncompleteUserTurn(messages: MessageWithParts[]): MessageWithParts[] {
  if (messages.length === 0) return messages
  if (messages[messages.length - 1]!.role === 'user') {
    return messages.slice(0, -1)
  }
  return messages
}

export function getMessagesAfterSnapshot(
  allMessages: MessageWithParts[],
  snapshot: CompressionSnapshotRef | null
): MessageWithParts[] {
  if (!snapshot) {
    return trimLeadingOrphanMessagesAfterSnapshot([...allMessages])
  }
  return resolveRetainMessagesAfterSnapshot(allMessages, snapshot)
}

function trimTrailingToolTail(messages: MessageWithParts[]): MessageWithParts[] {
  let cutIndex = messages.length
  while (cutIndex > 0 && messages[cutIndex - 1]!.role === 'tool') {
    cutIndex--
  }
  return messages.slice(0, cutIndex)
}

/** 送入模型 system 的「旧摘要」前缀（无上一段摘要则为空） */
export function buildCompressionOldSummaryPrefix(
  priorSnapshot: { summaryText?: string | null } | null
): string {
  const text = priorSnapshot?.summaryText?.trim()
  if (!text) return ''
  return `旧有的前情提要为：\n${text}\n\n`
}

/** 锚点切片回退：上一摘要之后 → 本快照 coveredUpTo（含） */
function sliceMessagesThroughSnapshotAnchor(
  allMessages: MessageWithParts[],
  targetSnapshot: CompressionSnapshotRef,
  priorSnapshot: CompressionSnapshotRef | null
): MessageWithParts[] {
  const endIdx = resolveSnapshotCutoffIndex(allMessages, targetSnapshot, priorSnapshot)
  if (endIdx < 0) return []

  let startIdx = 0
  if (priorSnapshot) {
    const prevIdx = resolveSnapshotCutoffIndex(allMessages, priorSnapshot, null)
    startIdx = prevIdx >= 0 ? prevIdx + 1 : 0
  }
  if (startIdx > endIdx) return []

  return trimTrailingToolTail(
    trimLeadingOrphanMessagesAfterSnapshot(allMessages.slice(startIdx, endIdx + 1))
  )
}

/**
 * 自动压缩与重新压缩共用：选定「准备送去摘要」的消息批次。
 *
 * - priorSnapshot：本层之前的摘要锚点；null 表示第一段（从会话开头算）
 * - targetSnapshot：仅重新压缩时传入，对齐当初写入快照时的 coveredUpTo
 * - keepTurns：与伙伴配置一致，用于 splitMessagesForCompression
 */
export function resolveCompressionBatch(
  allMessages: MessageWithParts[],
  options: {
    priorSnapshot: CompressionSnapshotRef | null
    targetSnapshot?: CompressionSnapshotRef | null
    keepTurns: number
    preserveRecentTokens?: number
  }
): CompressionBatchResult {
  const window =
    options.priorSnapshot != null
      ? getMessagesAfterSnapshot(allMessages, options.priorSnapshot)
      : trimLeadingOrphanMessagesAfterSnapshot([...allMessages])

  const split = splitMessagesForCompression(window, options.keepTurns, options.preserveRecentTokens)

  if (!options.targetSnapshot) {
    return { toCompress: split.toCompress, tailStartMessageId: split.tailStartMessageId }
  }

  const anchorId = options.targetSnapshot.coveredUpToMessageId
  if (
    split.toCompress.length > 0 &&
    split.toCompress[split.toCompress.length - 1]!.id === anchorId
  ) {
    return { toCompress: split.toCompress, tailStartMessageId: split.tailStartMessageId }
  }

  const anchored = sliceMessagesThroughSnapshotAnchor(
    allMessages,
    options.targetSnapshot,
    options.priorSnapshot
  )
  if (hasEnoughMessagesForRecompress(anchored)) {
    const tailStart = computeTailStartMessageId(allMessages, anchorId) ?? split.tailStartMessageId
    return { toCompress: anchored, tailStartMessageId: tailStart }
  }

  return {
    toCompress: split.toCompress.length > 0 ? split.toCompress : anchored,
    tailStartMessageId: split.tailStartMessageId
  }
}

/**
 * 计算压缩后「保留区起点」消息 id。
 * = 待压批次最后一条（coveredUpTo）在全量消息中的下一条。
 */
export function computeTailStartMessageId(
  allMessages: MessageWithParts[],
  coveredUpToMessageId: string
): string | null {
  const idx = allMessages.findIndex((m) => m.id === coveredUpToMessageId)
  if (idx < 0) return null
  return allMessages[idx + 1]?.id ?? null
}

/** @deprecated 使用 resolveCompressionBatch */
export function getMessagesForRecompress(
  allMessages: MessageWithParts[],
  latestSnapshot: CompressionSnapshotRef,
  previousSnapshot: CompressionSnapshotRef | null,
  keepTurns = 3,
  preserveRecentTokens?: number
): MessageWithParts[] {
  return resolveCompressionBatch(allMessages, {
    priorSnapshot: previousSnapshot,
    targetSnapshot: latestSnapshot,
    keepTurns,
    preserveRecentTokens
  }).toCompress
}

function findNextUserTurnStart(messages: MessageWithParts[], fromIndex: number): number {
  for (let i = fromIndex; i < messages.length; i++) {
    if (messages[i]!.role === 'user') return i
  }
  return messages.length
}

/**
 * 按「保留最近 N 轮用户对话」+ 可选 token 预算切分
 */
export function splitMessagesForCompression(
  messagesAfterSnapshot: MessageWithParts[],
  keepTurns: number,
  preserveRecentTokens?: number
): {
  toCompress: MessageWithParts[]
  retain: MessageWithParts[]
  tailStartMessageId: string | null
} {
  if (messagesAfterSnapshot.length === 0) {
    return { toCompress: [], retain: [], tailStartMessageId: null }
  }

  const retainTurns = Math.max(1, keepTurns)
  let userTurnsSeen = 0
  let retainFromIndex = messagesAfterSnapshot.length

  for (let i = messagesAfterSnapshot.length - 1; i >= 0; i--) {
    const msg = messagesAfterSnapshot[i]!
    const nextMsgInTimeline =
      i < messagesAfterSnapshot.length - 1 ? messagesAfterSnapshot[i + 1] : null
    const isUser = msg.role === 'user'

    if (isUser && (!nextMsgInTimeline || nextMsgInTimeline.role !== 'user')) {
      userTurnsSeen++
    }

    if (userTurnsSeen === retainTurns && isUser) {
      retainFromIndex = i
    } else if (userTurnsSeen > retainTurns) {
      break
    }
  }

  if (userTurnsSeen < retainTurns) {
    return { toCompress: [], retain: messagesAfterSnapshot, tailStartMessageId: null }
  }

  if (retainFromIndex <= 0) {
    return { toCompress: [], retain: messagesAfterSnapshot, tailStartMessageId: null }
  }

  if (preserveRecentTokens != null && preserveRecentTokens > 0) {
    while (retainFromIndex < messagesAfterSnapshot.length) {
      const retainSlice = messagesAfterSnapshot.slice(retainFromIndex)
      if (estimateMessagesTokens(retainSlice, true) <= preserveRecentTokens) break
      const next = findNextUserTurnStart(messagesAfterSnapshot, retainFromIndex + 1)
      if (next >= messagesAfterSnapshot.length) {
        retainFromIndex = messagesAfterSnapshot.length
        break
      }
      retainFromIndex = next
    }
  }

  if (retainFromIndex >= messagesAfterSnapshot.length) {
    return {
      toCompress: trimTrailingToolTail(
        trimLeadingOrphanMessagesAfterSnapshot([...messagesAfterSnapshot])
      ),
      retain: [],
      tailStartMessageId: null
    }
  }

  let toCompress = trimTrailingIncompleteUserTurn(messagesAfterSnapshot.slice(0, retainFromIndex))
  let cutIndex = toCompress.length
  while (cutIndex > 0 && toCompress[cutIndex - 1]!.role === 'tool') {
    cutIndex--
  }
  toCompress = toCompress.slice(0, cutIndex)

  if (toCompress.length === 0) {
    return {
      toCompress: [],
      retain: messagesAfterSnapshot.slice(retainFromIndex),
      tailStartMessageId: messagesAfterSnapshot[retainFromIndex]?.id ?? null
    }
  }

  if (toCompress.length === 1 && toCompress[0]!.role === 'assistant') {
    return {
      toCompress: [],
      retain: messagesAfterSnapshot.slice(retainFromIndex),
      tailStartMessageId: messagesAfterSnapshot[retainFromIndex]?.id ?? null
    }
  }

  const retain = messagesAfterSnapshot.slice(retainFromIndex)
  return {
    toCompress,
    retain,
    tailStartMessageId: retain[0]?.id ?? null
  }
}

export type { SessionCompressionConfig }
