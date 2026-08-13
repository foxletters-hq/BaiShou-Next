import type { TokenUsage } from './useAgentStream-types'

export function tokenUsageUnchanged(a: TokenUsage, b: TokenUsage): boolean {
  return (
    a.inputTokens === b.inputTokens &&
    a.outputTokens === b.outputTokens &&
    a.cacheReadInputTokens === b.cacheReadInputTokens &&
    a.cacheWriteInputTokens === b.cacheWriteInputTokens &&
    a.totalCostMicros === b.totalCostMicros
  )
}

/** 数值不变时复用旧对象，避免 setTokenUsage 因引用变化反复重渲染 */
export function applyTokenUsage(prev: TokenUsage, next: TokenUsage): TokenUsage {
  return tokenUsageUnchanged(prev, next) ? prev : next
}

/** 清空列表时复用已有空数组，避免 setState([]) 因引用变化反复重渲染 */
export function reuseEmptyAgentList<T>(prev: T[]): T[] {
  return prev.length === 0 ? prev : []
}
