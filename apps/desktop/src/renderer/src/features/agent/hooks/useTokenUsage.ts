import { useState, useEffect } from 'react';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalCostMicros: number;
}

export interface UseTokenUsageResult {
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
}

/**
 * Token 用量追踪 Hook
 *
 * 职责：通过 IPC 获取当前会话的 Token 用量统计
 */
export function useTokenUsage(sessionId: string | undefined, isStreaming: boolean): UseTokenUsageResult {
  const [tokenUsage, setTokenUsage] = useState<TokenUsage>({ inputTokens: 0, outputTokens: 0, totalCostMicros: 0 });

  useEffect(() => {
    if (!sessionId) return;
    if (typeof window !== 'undefined' && window.electron) {
      window.electron.ipcRenderer.invoke('agent:get-token-usage', sessionId)
        .then(res => { if (res) setTokenUsage(res); })
        .catch(console.error);
    }
  }, [sessionId, isStreaming]);

  return {
    totalInputTokens: tokenUsage?.inputTokens || 0,
    totalOutputTokens: tokenUsage?.outputTokens || 0,
    estimatedCost: (tokenUsage?.totalCostMicros || 0) / 1000000,
  };
}
