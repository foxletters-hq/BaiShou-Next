export interface MessageUsageFields {
  inputTokens?: number
  outputTokens?: number
  cacheReadInputTokens?: number
  cacheWriteInputTokens?: number
  costMicros?: number
}

export function messageHasUsageStats(msg: MessageUsageFields): boolean {
  return (
    (msg.inputTokens ?? 0) > 0 ||
    (msg.outputTokens ?? 0) > 0 ||
    (msg.costMicros ?? 0) > 0 ||
    (msg.cacheReadInputTokens ?? 0) > 0 ||
    (msg.cacheWriteInputTokens ?? 0) > 0
  )
}

export function formatCompactTokenCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return `${n}`
}
