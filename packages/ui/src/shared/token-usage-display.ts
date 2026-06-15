export interface TokenUsageDisplay {
  inputTokens?: number
  outputTokens?: number
  costMicros?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
}

export function formatCompactTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}

export function hasTokenUsageStats(usage: TokenUsageDisplay): boolean {
  return (
    (usage.inputTokens ?? 0) > 0 ||
    (usage.outputTokens ?? 0) > 0 ||
    (usage.costMicros ?? 0) > 0 ||
    (usage.cacheReadInputTokens ?? 0) > 0 ||
    (usage.cacheWriteInputTokens ?? 0) > 0
  )
}
