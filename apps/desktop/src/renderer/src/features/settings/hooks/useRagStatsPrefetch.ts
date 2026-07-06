import { useEffect } from 'react'
import { getCachedRagStats, patchCachedRagStats } from '../rag-runtime-cache'

/** 进入 RAG 设置页时按需拉取统计，避免在 SettingsShell 层预加载 */
export function useRagStatsPrefetch(): void {
  useEffect(() => {
    if (getCachedRagStats().totalCount > 0) return
    void (window as any).api?.rag
      ?.getStats?.()
      .then((stats: unknown) => {
        if (stats) patchCachedRagStats(stats as ReturnType<typeof getCachedRagStats>)
      })
      .catch((err: unknown) => {
        console.warn('[RagStatsPrefetch] refresh stats failed:', err)
      })
  }, [])
}
