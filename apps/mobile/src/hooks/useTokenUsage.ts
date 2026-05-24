import { useState, useCallback } from 'react'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  totalCostMicros: number
}

export interface UseTokenUsageResult {
  totalInputTokens: number
  totalOutputTokens: number
  estimatedCost: number
  updateTokenUsage: (usage: Partial<TokenUsage>) => void
  resetTokenUsage: () => void
}

/**
 * Token 用量追踪 Hook
 *
 * 职责：追踪当前会话的 Token 用量统计
 */
export function useTokenUsage(): UseTokenUsageResult {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({
    inputTokens: 0,
    outputTokens: 0,
    totalCostMicros: 0
  })

  const updateTokenUsage = useCallback((usage: Partial<TokenUsage>) => {
    setTokenUsage((prev) => ({
      inputTokens: prev.inputTokens + (usage.inputTokens || 0),
      outputTokens: prev.outputTokens + (usage.outputTokens || 0),
      totalCostMicros: prev.totalCostMicros + (usage.totalCostMicros || 0)
    }))
  }, [])

  const resetTokenUsage = useCallback(() => {
    setTokenUsage({ inputTokens: 0, outputTokens: 0, totalCostMicros: 0 })
  }, [])

  return {
    totalInputTokens: tokenUsage.inputTokens,
    totalOutputTokens: tokenUsage.outputTokens,
    estimatedCost: tokenUsage.totalCostMicros / 1000000,
    updateTokenUsage,
    resetTokenUsage
  }
}
