import { useState, useEffect, useCallback, useRef } from 'react'

export interface TokenUsage {
  inputTokens: number
  outputTokens: number
  cacheReadInputTokens: number
  cacheWriteInputTokens: number
  totalCostMicros: number
}

export interface UseTokenUsageResult {
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadInputTokens: number
  totalCacheWriteInputTokens: number
  estimatedCost: number
}

const EMPTY_USAGE: TokenUsage = {
  inputTokens: 0,
  outputTokens: 0,
  cacheReadInputTokens: 0,
  cacheWriteInputTokens: 0,
  totalCostMicros: 0
}

/**
 * Token 用量追踪 Hook
 *
 * 职责：通过 IPC 获取当前会话的 Token 用量统计；流结束后由事件触发刷新，避免随 isStreaming 反复查询。
 */
export function useTokenUsage(
  sessionId: string | undefined,
  _isStreaming: boolean
): UseTokenUsageResult {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>(EMPTY_USAGE)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const fetchTokenUsage = useCallback(async (targetSessionId: string) => {
    if (typeof window === 'undefined' || !window.electron) return
    try {
      const res = await window.electron.ipcRenderer.invoke('agent:get-token-usage', targetSessionId)
      if (res) setTokenUsage(res)
    } catch (error) {
      console.error('[useTokenUsage] fetch failed:', error)
    }
  }, [])

  const scheduleRefresh = useCallback(
    (targetSessionId: string, delayMs = 250) => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = undefined
        void fetchTokenUsage(targetSessionId)
      }, delayMs)
    },
    [fetchTokenUsage]
  )

  useEffect(() => {
    if (!sessionId) {
      setTokenUsage(EMPTY_USAGE)
      return undefined
    }

    void fetchTokenUsage(sessionId)

    const onUsageChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ sessionId?: string }>).detail
      if (detail?.sessionId && detail.sessionId !== sessionId) return
      scheduleRefresh(sessionId)
    }

    window.addEventListener('baishou:session-token-usage-changed', onUsageChanged)
    return () => {
      window.removeEventListener('baishou:session-token-usage-changed', onUsageChanged)
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
        refreshTimerRef.current = undefined
      }
    }
  }, [sessionId, fetchTokenUsage, scheduleRefresh])

  return {
    totalInputTokens: tokenUsage?.inputTokens || 0,
    totalOutputTokens: tokenUsage?.outputTokens || 0,
    totalCacheReadInputTokens: tokenUsage?.cacheReadInputTokens || 0,
    totalCacheWriteInputTokens: tokenUsage?.cacheWriteInputTokens || 0,
    estimatedCost: (tokenUsage?.totalCostMicros || 0) / 1000000
  }
}
