import type { ModelMessage } from 'ai'
import type { SessionRepository } from '@baishou/database'
import { AssistantRepository } from '@baishou/database'
import { DEFAULT_LATTE_ASSISTANT_ID } from '@baishou/shared'
import {
  buildCompressionPreviousSummaryBlock,
  shouldWrapRoleForModel,
  wrapMessageBodyForModel
} from '@baishou/shared'
import type { MessageWithParts } from './message.adapter'
import { TOOL_OUTPUT_MAX_CHARS } from './compression.constants'

interface CompressionSnapshotRef {
  coveredUpToMessageId: string
  /** 累计已压缩消息条数（用于锚点 id 丢失时的回退） */
  messageCount?: number
  [key: string]: any
}
import { estimateTextTokens } from './call-chain-view-model.builder'

export interface SessionCompressionConfig {
  threshold: number
  keepTurns: number
  /** 伙伴自定义压缩系统提示词；空则用当前语言默认 */
  systemPrompt?: string
  /** 工具调用时可强制压缩，忽略 token 阈值 */
  force?: boolean
  /** 模型上下文窗口（token）；用于按窗口触发压缩 */
  modelContextWindow?: number
  /** 为输出与系统提示预留的 token；usable = window - reserved */
  reservedTokens?: number
  /** 保留区 token 预算 */
  preserveRecentTokens?: number
}

const MIN_PRESERVE_RECENT_TOKENS = 2_000
const MAX_PRESERVE_RECENT_TOKENS = 8_000

export function preserveRecentTokenBudget(config: SessionCompressionConfig): number {
  if (config.preserveRecentTokens != null && config.preserveRecentTokens > 0) {
    return config.preserveRecentTokens
  }
  const usable = usableContextTokens(
    config.modelContextWindow ?? DEFAULT_MODEL_CONTEXT_WINDOW,
    config.reservedTokens
  )
  if (usable <= 0) return MAX_PRESERVE_RECENT_TOKENS
  return Math.min(
    MAX_PRESERVE_RECENT_TOKENS,
    Math.max(MIN_PRESERVE_RECENT_TOKENS, Math.floor(usable * 0.25))
  )
}

/** 未知模型时的保守默认上下文窗口 */
export const DEFAULT_MODEL_CONTEXT_WINDOW = 128_000

/** 已知模型 id 子串 → 上下文窗口（token）。命中第一条匹配。 */
const MODEL_CONTEXT_WINDOW_TABLE: Array<{ match: RegExp; window: number }> = [
  { match: /claude.*(opus|sonnet|haiku)|claude-3|claude-4|claude-3-5/i, window: 200_000 },
  { match: /gemini.*(1\.5|2\.0|2\.5|pro|flash)/i, window: 1_000_000 },
  { match: /gpt-4\.1|gpt-4o|gpt-4-turbo|o1|o3|o4/i, window: 128_000 },
  { match: /gpt-4(?![.\d])/i, window: 8_192 },
  { match: /gpt-3\.5/i, window: 16_385 },
  { match: /deepseek/i, window: 64_000 },
  { match: /qwen.*(max|plus|turbo|2\.5|3)|qwen2|qwen3/i, window: 128_000 },
  { match: /qwen/i, window: 32_768 },
  { match: /(kimi|moonshot)/i, window: 128_000 },
  { match: /(glm|chatglm)/i, window: 128_000 },
  { match: /(yi|01-ai)/i, window: 200_000 },
  { match: /(llama-3|llama3)/i, window: 128_000 },
  { match: /mistral|mixtral/i, window: 32_768 }
]

/** 估算模型上下文窗口（token）；未知返回默认值；override 优先 */
export function getModelContextWindow(
  modelId?: string | null,
  overrideWindow?: number | null
): number {
  if (overrideWindow != null && overrideWindow > 0) return overrideWindow
  if (!modelId) return DEFAULT_MODEL_CONTEXT_WINDOW
  for (const entry of MODEL_CONTEXT_WINDOW_TABLE) {
    if (entry.match.test(modelId)) return entry.window
  }
  return DEFAULT_MODEL_CONTEXT_WINDOW
}

/**
 * 触发压缩时的上下文 token 估算：仅按「摘要 + 快照后保留消息」文本估算。
 * 不使用 API usage（与伙伴阈值比较的应是实际上下文，而非上一轮计费体量）。
 */
export function estimateContextTokensForTrigger(
  _allMessages: MessageWithParts[],
  messagesAfterSnapshot: MessageWithParts[],
  latestSnapshot: { summaryText?: string | null } | null
): number {
  let tokens = estimateMessagesTokens(messagesAfterSnapshot, true)
  const summary = latestSnapshot?.summaryText?.trim()
  if (summary) {
    tokens += estimateTextTokens(summary)
  }
  return tokens
}

/** 从伙伴记录读取压缩阈值；无效值视为 0（关闭） */
export function readCompressTokenThreshold(
  assistant: { compressTokenThreshold?: number | null } | null | undefined
): number {
  const raw = assistant?.compressTokenThreshold
  if (raw == null) return 0
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.floor(n)
}

/** 为压缩调用预留的 token（输出 + 系统提示 + 工具）：窗口的 20%，夹在 8k–40k */
export function reservedTokensFor(window: number): number {
  if (window <= 0) return 0
  return Math.min(40_000, Math.max(8_000, Math.floor(window * 0.2)))
}

/** 可用上下文 token：window - reserved */
export function usableContextTokens(window: number, reserved?: number): number {
  if (window <= 0) return 0
  const r = reserved ?? reservedTokensFor(window)
  return Math.max(0, window - r)
}

/**
 * 自动压缩触发判定。
 * - 用户显式阈值优先，避免模型窗口识别偏保守时绕过用户设置。
 * - 阈值为 0 表示关闭自动压缩；仅 force 可强制触发。
 * - 没有显式阈值时，模型可用窗口才作为防溢出兜底。
 */
export function resolveCompressionTrigger(
  currentContextTokens: number,
  config: SessionCompressionConfig
): boolean {
  if (config.force) return true

  if (config.threshold > 0) {
    return currentContextTokens > config.threshold
  }

  if (config.threshold === 0) {
    return false
  }

  const usable = usableContextTokens(config.modelContextWindow ?? 0, config.reservedTokens)
  return usable > 0 ? currentContextTokens > usable : false
}

export function extractMessageText(msg: MessageWithParts): string {
  if (!msg.parts?.length) return ''
  const chunks: string[] = []
  for (const p of msg.parts) {
    if (p.type === 'text') {
      const data = p.data as { text?: string } | string | undefined
      const text = typeof data === 'string' ? data : data?.text
      if (text) chunks.push(text)
    } else if (p.type === 'tool') {
      const data = p.data as {
        result?: unknown
        arguments?: unknown
        name?: string
      } | null
      if (!data) continue
      if (data.result !== undefined) {
        chunks.push(typeof data.result === 'string' ? data.result : JSON.stringify(data.result))
      } else if (data.arguments !== undefined) {
        chunks.push(JSON.stringify(data.arguments))
      }
    } else if (p.type === 'context_snapshot') {
      const snaps = (p.data as { snapshots?: Array<{ title?: string; content?: string }> })
        ?.snapshots
      if (Array.isArray(snaps)) {
        for (const s of snaps) {
          chunks.push(`${s.title ?? 'Context'}\n${s.content ?? ''}`)
        }
      }
    } else if (p.type === 'image') {
      const att = p.data as { name?: string; fileName?: string } | null | undefined
      chunks.push(`[图片附件 ${att?.name || att?.fileName || ''}]`)
    } else if (p.type === 'attachment') {
      const att = p.data as { textContent?: string; name?: string; fileName?: string } | null | undefined
      if (att?.textContent) {
        chunks.push(`[附件 ${att.name || att.fileName || ''}]\n${att.textContent}`)
      }
    }
  }
  return chunks.join('\n')
}

function truncateForCompression(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n…[已截断]`
}

/** 压缩专用文本提取（tool 输出限长） */
export function extractMessageTextForCompression(msg: MessageWithParts): string {
  if (!msg.parts?.length) return ''
  const chunks: string[] = []
  for (const p of msg.parts) {
    if (p.type === 'text') {
      const data = p.data as { text?: string } | string | undefined
      const text = typeof data === 'string' ? data : data?.text
      if (text) chunks.push(text)
    } else if (p.type === 'tool') {
      const data = p.data as { result?: unknown; arguments?: unknown } | null
      if (!data) continue
      if (data.result !== undefined) {
        const raw = typeof data.result === 'string' ? data.result : JSON.stringify(data.result)
        chunks.push(truncateForCompression(raw, TOOL_OUTPUT_MAX_CHARS))
      } else if (data.arguments !== undefined) {
        chunks.push(JSON.stringify(data.arguments))
      }
    } else if (p.type === 'context_snapshot') {
      const snaps = (p.data as { snapshots?: Array<{ title?: string; content?: string }> })
        ?.snapshots
      if (Array.isArray(snaps)) {
        for (const s of snaps) {
          chunks.push(`${s.title ?? 'Context'}\n${s.content ?? ''}`)
        }
      }
    } else if (p.type === 'image') {
      const att = p.data as { name?: string; fileName?: string } | null | undefined
      chunks.push(`[图片附件 ${att?.name || att?.fileName || ''}]`)
    } else if (p.type === 'attachment') {
      const att = p.data as { textContent?: string; name?: string; fileName?: string } | null | undefined
      if (att?.textContent) {
        chunks.push(`[附件 ${att.name || att.fileName || ''}]\n${att.textContent}`)
      }
    }
  }
  return chunks.join('\n')
}

export function estimateMessagesTokens(
  messages: MessageWithParts[],
  forCompression = false
): number {
  return messages.reduce(
    (sum, m) =>
      sum +
      estimateTextTokens(
        forCompression ? extractMessageTextForCompression(m) : extractMessageText(m)
      ),
    0
  )
}

/**
 * 压缩摘要专用：将历史消息压平为纯文本 user/assistant 轮次。
 * 避免 DeepSeek thinking 模式 + tool-call 结构在压缩请求中触发 400。
 */
export function toFlatTextModelMessages(messages: MessageWithParts[]): ModelMessage[] {
  const result: ModelMessage[] = []
  for (const msg of messages) {
    if (msg.role !== 'user' && msg.role !== 'assistant' && msg.role !== 'tool') {
      continue
    }
    const text = extractMessageTextForCompression(msg).trim()
    if (!text) continue

    if (msg.role === 'tool') {
      result.push({ role: 'user', content: `[工具输出]\n${text}` })
      continue
    }
    result.push({ role: msg.role, content: text })
  }
  return result
}

/** 送入摘要模型前截断超长 tool part（不修改库内原文） */
export function cloneMessagesForCompressionModel(messages: MessageWithParts[]): MessageWithParts[] {
  return messages.map((msg) => {
    if (!msg.parts?.length) return msg
    const parts = msg.parts.map((p) => {
      if (p.type !== 'tool') return p
      const data = p.data as { result?: unknown; arguments?: unknown; name?: string }
      if (typeof data?.result === 'string' && data.result.length > TOOL_OUTPUT_MAX_CHARS) {
        return {
          ...p,
          data: {
            ...data,
            result: truncateForCompression(data.result, TOOL_OUTPUT_MAX_CHARS)
          }
        }
      }
      return p
    })
    return { ...msg, parts }
  })
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
  const cutoffIndex = resolveSnapshotCutoffIndex(allMessages, snapshot)
  if (cutoffIndex < 0) return trimLeadingOrphanMessagesAfterSnapshot([...allMessages])
  return trimLeadingOrphanMessagesAfterSnapshot(allMessages.slice(cutoffIndex + 1))
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

export function hasEnoughMessagesForRecompress(messages: MessageWithParts[]): boolean {
  const withText = messages.filter((m) => extractMessageText(m).trim().length > 0)
  if (withText.length >= 2) return true
  return withText.some((m) => m.role === 'user')
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
export interface CompressionBatchResult {
  toCompress: MessageWithParts[]
  tailStartMessageId: string | null
}

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

const COMPRESSION_ROLE_LABELS: Record<string, string> = {
  user: '用户',
  assistant: '助手',
  tool: '工具',
  system: '系统'
}

/** 将待压缩消息格式化为带角色标记的原文，避免模型只看见助手尾句 */
export function formatMessagesAsCompressionTranscript(messages: MessageWithParts[]): string {
  const blocks: string[] = []
  for (const msg of messages) {
    const text = extractMessageText(msg).trim()
    if (!text) continue
    const label = COMPRESSION_ROLE_LABELS[msg.role] ?? msg.role
    const bodyBlock = shouldWrapRoleForModel(msg.role)
      ? wrapMessageBodyForModel(text, msg.createdAt)
      : text
    blocks.push(`【${label}】\n${bodyBlock}`)
  }
  return blocks.join('\n\n---\n\n')
}

/**
 * 构建送入压缩模型的单条 user 消息：<previous-summary> 在前，带角色标记的对话 transcript 在后。
 */
export function buildCompressionUserMessageContent(
  messages: MessageWithParts[],
  priorSummaryText?: string | null
): string | null {
  const transcript = formatMessagesAsCompressionTranscript(
    cloneMessagesForCompressionModel(messages)
  ).trim()
  if (!transcript) return null

  const previousSummaryBlock = buildCompressionPreviousSummaryBlock(
    priorSummaryText?.trim() || undefined
  )
  return previousSummaryBlock ? `${previousSummaryBlock}\n\n${transcript}` : transcript
}

export function hasUserContentInCompressionBatch(messages: MessageWithParts[]): boolean {
  return messages.some((m) => m.role === 'user' && extractMessageText(m).trim().length > 0)
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

export async function resolveSessionCompressionConfig(
  sessionId: string,
  sessionRepo: SessionRepository
): Promise<SessionCompressionConfig> {
  try {
    const session = await sessionRepo.getSessionById?.(sessionId)
    const astRepo = new AssistantRepository(sessionRepo.db)

    const linkedAssistantId = session?.assistantId?.trim()
    let ast = linkedAssistantId ? await astRepo.findById(linkedAssistantId) : null
    if (!ast) {
      ast = await astRepo.findById(DEFAULT_LATTE_ASSISTANT_ID)
    }

    const modelContextWindow = getModelContextWindow(
      session?.modelId,
      ast?.compressModelContextWindow ?? null
    )
    const reserved = reservedTokensFor(modelContextWindow)
    const preserveRecentTokens =
      ast?.compressPreserveRecentTokens != null && ast.compressPreserveRecentTokens > 0
        ? ast.compressPreserveRecentTokens
        : undefined

    return {
      threshold: readCompressTokenThreshold(ast),
      keepTurns: ast?.compressKeepTurns ?? 3,
      systemPrompt: ast?.compressSystemPrompt?.trim() || undefined,
      modelContextWindow,
      reservedTokens: reserved,
      preserveRecentTokens
    }
  } catch {
    const modelContextWindow = DEFAULT_MODEL_CONTEXT_WINDOW
    return {
      threshold: 0,
      keepTurns: 3,
      modelContextWindow,
      reservedTokens: reservedTokensFor(modelContextWindow)
    }
  }
}
