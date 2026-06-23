import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  classifyAiApiCallError,
  resolveMigrationStatusText
} from '@baishou/shared'
import {
  getCachedRagStats,
  patchCachedRagStats,
  setCachedRagActiveState
} from '../rag-runtime-cache'

function localizeRagEmbedError(raw: string, t: (key: string, fallback: string) => string): string {
  const kind = classifyAiApiCallError({ message: raw, responseBody: raw })
  switch (kind) {
    case 'balance':
      return t('agent.error.quota', '模型服务商提示账号额度不足。')
    case 'auth':
      return t(
        'ai_config.error_no_model',
        '检测失败：可能是未配置有效的 Embedding 模型或服务未连通。'
      )
    case 'rate_limit':
      return t('agent.error.rate_limit', '请求过于频繁或超出并发限制，请稍后再试。')
    case 'network':
      return t('agent.error.network', '网络连接失败，请检查您的网络连接或代理设置。')
    default:
      return raw
  }
}

function extractIpcErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message.replace(
      /^(Batch embed failed|Migration failed|Migration resume failed):\s*/i,
      ''
    )
  }
  return error instanceof Error ? error.message : String(error)
}

async function refreshRagStats(): Promise<void> {
  try {
    const stats = await (window as any).api?.rag?.getStats?.()
    if (stats) {
      patchCachedRagStats(stats)
    }
  } catch (err) {
    console.warn('[RagRuntimeBridge] refresh stats failed:', err)
  }
}

/**
 * 在 SettingsShell 层常驻监听 RAG 进度，避免切换设置 Tab 后状态丢失或总数闪回 0。
 */
export function useRagRuntimeBridge(): void {
  const { t } = useTranslation()
  const statsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const api = (window as any).api
    if (!api?.rag?.onRagProgress) return

    const scheduleStatsRefresh = (delayMs: number) => {
      if (statsRefreshTimerRef.current) {
        clearTimeout(statsRefreshTimerRef.current)
      }
      statsRefreshTimerRef.current = setTimeout(() => {
        statsRefreshTimerRef.current = null
        void refreshRagStats()
      }, delayMs)
    }

    const cleanup = api.rag.onRagProgress((state: any) => {
      const statusText = state.statusKey
        ? resolveMigrationStatusText(t, state.statusKey, state.statusParams)
        : state.statusText || ''
      const errorText =
        typeof state.error === 'string' && state.error.trim()
          ? localizeRagEmbedError(extractIpcErrorMessage({ message: state.error.trim() }), t)
          : undefined

      setCachedRagActiveState({ ...state, statusText, error: errorText })

      if (state.isRunning) {
        scheduleStatsRefresh(1200)
        return
      }

      if (statsRefreshTimerRef.current) {
        clearTimeout(statsRefreshTimerRef.current)
        statsRefreshTimerRef.current = null
      }
      void refreshRagStats()
    })

    return () => {
      cleanup?.()
      if (statsRefreshTimerRef.current) {
        clearTimeout(statsRefreshTimerRef.current)
        statsRefreshTimerRef.current = null
      }
    }
  }, [t])

  useEffect(() => {
    if (getCachedRagStats().totalCount > 0) return
    void refreshRagStats()
  }, [])
}
