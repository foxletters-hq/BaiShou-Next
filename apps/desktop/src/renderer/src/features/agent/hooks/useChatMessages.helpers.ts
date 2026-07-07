import {
  CHAT_MESSAGE_FETCH_LIMIT,
  CHAT_ROUNDS_PER_PAGE,
  computeInitialRoundWindowStart,
  flattenRoundSlice,
  groupMessagesIntoRounds
} from '../utils/chat-round-pagination'
import type { SessionMessageCacheEntry } from '../utils/chat-session-message-cache'

export type CompactionAnchor = {
  messageId: string
  record: {
    streamTranscript?: string
    streamReasoning?: string
    phase?: 'auto' | 'manual'
    status?: 'completed' | 'failed'
    thoughtDurationMs?: number
    summaryDurationMs?: number
  }
}

export function resolveLatestCompactionAnchor(messages: readonly any[]): CompactionAnchor | null {
  let best: CompactionAnchor | null = null
  let bestOrder = -1

  for (const msg of messages) {
    if (msg.role !== 'user' || !msg.compactionRecord) continue
    if (msg.compactionRecord.status === 'failed') continue
    const orderIndex = typeof msg.orderIndex === 'number' ? msg.orderIndex : bestOrder + 1
    if (orderIndex >= bestOrder) {
      bestOrder = orderIndex
      best = { messageId: msg.id, record: msg.compactionRecord }
    }
  }

  return best
}
export const CHAT_INITIAL_ROUND_BATCH = CHAT_ROUNDS_PER_PAGE
export const CHAT_INITIAL_MESSAGE_BATCH = CHAT_MESSAGE_FETCH_LIMIT

export function resolveHasMore(roundWindowStart: number, fetchHasMore: boolean): boolean {
  return roundWindowStart > 0 || fetchHasMore
}

export function mergeMessageTokenFields(prev: any | undefined, next: any): any {
  if (!prev) return next
  const nextHasUsage = messageHasUsageStats(next)
  const prevHasUsage = messageHasUsageStats(prev)
  if (nextHasUsage || !prevHasUsage) return next
  return {
    ...next,
    inputTokens: prev.inputTokens,
    outputTokens: prev.outputTokens,
    cacheReadInputTokens: prev.cacheReadInputTokens,
    cacheWriteInputTokens: prev.cacheWriteInputTokens,
    costMicros: prev.costMicros
  }
}

export function mergeFetchedWithCache(prevCache: readonly any[], fetched: any[]): any[] {
  const prevById = new Map(prevCache.map((m) => [m.id, m]))
  return fetched.map((m) => mergeMessageTokenFields(prevById.get(m.id), m))
}

export function mergeTailIntoCache(prevCache: readonly any[], tail: any[]): any[] {
  if (tail.length === 0) return [...prevCache]
  const tailIds = new Set(tail.map((m) => m.id))
  const kept = prevCache.filter((m) => !tailIds.has(m.id))
  return mergeFetchedWithCache(kept, [...kept, ...tail])
}

export function messageHasUsageStats(msg: any): boolean {
  return (
    (msg.inputTokens ?? 0) > 0 ||
    (msg.outputTokens ?? 0) > 0 ||
    (msg.costMicros ?? 0) > 0 ||
    (msg.cacheReadInputTokens ?? 0) > 0 ||
    (msg.cacheWriteInputTokens ?? 0) > 0
  )
}

export function applyPendingUsageToMessages(
  messages: any[],
  pendingUsage: Map<string, Record<string, number | undefined>>
): any[] {
  if (pendingUsage.size === 0) return messages
  return messages.map((msg) => {
    const usage = pendingUsage.get(msg.id)
    if (!usage || messageHasUsageStats(msg)) return msg
    return {
      ...msg,
      inputTokens: usage.inputTokens ?? msg.inputTokens,
      outputTokens: usage.outputTokens ?? msg.outputTokens,
      cacheReadInputTokens: usage.cacheReadInputTokens ?? msg.cacheReadInputTokens,
      cacheWriteInputTokens: usage.cacheWriteInputTokens ?? msg.cacheWriteInputTokens,
      costMicros: usage.costMicros ?? msg.costMicros
    }
  })
}

export function isViewingLatestRounds(cache: readonly any[], roundWindowStart: number): boolean {
  const totalRounds = groupMessagesIntoRounds(cache).length
  return roundWindowStart >= Math.max(0, totalRounds - CHAT_ROUNDS_PER_PAGE)
}

export function resolveRoundWindowStart(
  cache: readonly any[],
  currentStart: number,
  preserveWindow: boolean
): number {
  const totalRounds = groupMessagesIntoRounds(cache).length
  const initialStart = computeInitialRoundWindowStart(totalRounds)
  if (!preserveWindow) return initialStart
  return Math.min(currentStart, initialStart)
}

export function applyCacheToWindow(
  cache: any[],
  roundWindowStart: number,
  fetchHasMore: boolean
): { display: any[]; hasMore: boolean; roundWindowStart: number } {
  const rounds = groupMessagesIntoRounds(cache)
  const clampedStart = Math.min(roundWindowStart, computeInitialRoundWindowStart(rounds.length))
  const display = flattenRoundSlice(rounds, clampedStart)
  return {
    display,
    hasMore: resolveHasMore(clampedStart, fetchHasMore),
    roundWindowStart: clampedStart
  }
}

export function buildSessionCacheSnapshot(state: {
  messageCacheRef: { current: any[] }
  loadedFromEndRef: { current: number }
  roundWindowStartRef: { current: number }
  fetchHasMoreRef: { current: boolean }
  compactionAnchor: CompactionAnchor | null
}): SessionMessageCacheEntry {
  return {
    messages: [...state.messageCacheRef.current],
    loadedFromEnd: state.loadedFromEndRef.current,
    roundWindowStart: state.roundWindowStartRef.current,
    fetchHasMore: state.fetchHasMoreRef.current,
    compactionAnchor: state.compactionAnchor
  }
}

export async function fetchMessagesFromIpc(
  sessionId: string,
  limit: number,
  offset: number
): Promise<any[] | null> {
  const fetched = await window.electron.ipcRenderer.invoke(
    'agent:get-messages',
    sessionId,
    limit,
    offset,
    false
  )
  return fetched ?? null
}
