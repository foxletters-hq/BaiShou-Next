import {
  estimateContextOccupancySegments,
  type ContextOccupancyMessage,
  type ContextOccupancySegment
} from './context-occupancy.util'
import { getModelContextWindow } from './model-context-window.util'

export interface LastRoundTokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
}

export interface LastRoundUsageMessage extends ContextOccupancyMessage {
  inputTokens?: number | null
  outputTokens?: number | null
  cacheReadInputTokens?: number | null
  cacheWriteInputTokens?: number | null
}

/** 接口 input 通常已含 cache；展示用未命中部分 */
export function exclusiveInputTokens(
  inputTokens: number,
  cacheReadInputTokens: number,
  cacheWriteInputTokens = 0
): number {
  return Math.max(0, inputTokens - cacheReadInputTokens - cacheWriteInputTokens)
}

export function normalizeInclusiveRoundUsage(usage: LastRoundTokenUsage): LastRoundTokenUsage {
  return {
    inputTokens: exclusiveInputTokens(
      usage.inputTokens,
      usage.cacheReadInputTokens,
      usage.cacheWriteInputTokens
    ),
    outputTokens: usage.outputTokens,
    cacheReadInputTokens: usage.cacheReadInputTokens,
    cacheWriteInputTokens: usage.cacheWriteInputTokens
  }
}

export function cacheHitPercent(usage: LastRoundTokenUsage): number | null {
  const prompt = usage.inputTokens + usage.cacheReadInputTokens + usage.cacheWriteInputTokens
  if (prompt <= 0) return null
  return Math.round((usage.cacheReadInputTokens / prompt) * 100)
}

export function sumLastRoundTokens(usage: LastRoundTokenUsage): number {
  return (
    usage.inputTokens +
    usage.outputTokens +
    usage.cacheReadInputTokens +
    usage.cacheWriteInputTokens
  )
}

export function pickLastRoundUsage(
  messages: readonly LastRoundUsageMessage[]
): LastRoundTokenUsage | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message?.role !== 'assistant') continue
    const usage: LastRoundTokenUsage = {
      inputTokens: message.inputTokens ?? 0,
      outputTokens: message.outputTokens ?? 0,
      cacheReadInputTokens: message.cacheReadInputTokens ?? 0,
      cacheWriteInputTokens: message.cacheWriteInputTokens ?? 0
    }
    if (sumLastRoundTokens(usage) > 0) return normalizeInclusiveRoundUsage(usage)
  }
  return null
}

/** 上一轮占用相对窗口的百分比；窗口未知时返回 null */
export function lastRoundUsagePercent(usedTokens: number, contextWindow: number): number | null {
  if (contextWindow <= 0) return null
  if (usedTokens <= 0) return 0
  return Math.min(999, Math.round((usedTokens / contextWindow) * 100))
}

export function formatContextTokenCount(count: number): string {
  const value = Math.max(0, count)
  if (value >= 1_000_000) {
    const millions = value / 1_000_000
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`
  }
  if (value >= 1000) {
    const thousands = value / 1000
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}K`
  }
  return String(Math.round(value))
}

export function clampRingPercent(percent: number | null): number {
  if (percent == null || percent <= 0) return 0
  return Math.min(100, percent)
}

export interface SessionTokenTotals {
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadInputTokens: number
  totalCacheWriteInputTokens: number
  estimatedCost: number
}

export interface SessionContextUsageView {
  lastRound: LastRoundTokenUsage | null
  contextWindow: number
  occupancy: ContextOccupancySegment[]
  cumulative: {
    inputTokens: number
    outputTokens: number
    cacheReadTokens: number
    cacheWriteTokens: number
    estimatedCost: string
  }
}

export function formatEstimatedCostUsd(estimatedCost: number): string {
  const amount = Number.isFinite(estimatedCost) ? Math.max(0, estimatedCost) : 0
  return `$${amount.toFixed(6)}`
}

/** 伙伴页与工作台共用：上一轮占用 + 累计消耗，给用量圆圈用 */
export function resolveSessionContextUsage(input: {
  messages: readonly LastRoundUsageMessage[]
  modelId?: string | null
  totals: SessionTokenTotals
}): SessionContextUsageView {
  const { totals } = input
  const lastRound = pickLastRoundUsage(input.messages)
  return {
    lastRound,
    contextWindow: getModelContextWindow(input.modelId),
    occupancy: estimateContextOccupancySegments({
      lastRound,
      messages: input.messages
    }),
    cumulative: {
      inputTokens: exclusiveInputTokens(
        totals.totalInputTokens,
        totals.totalCacheReadInputTokens,
        totals.totalCacheWriteInputTokens
      ),
      outputTokens: totals.totalOutputTokens,
      cacheReadTokens: totals.totalCacheReadInputTokens,
      cacheWriteTokens: totals.totalCacheWriteInputTokens,
      estimatedCost: formatEstimatedCostUsd(totals.estimatedCost)
    }
  }
}
