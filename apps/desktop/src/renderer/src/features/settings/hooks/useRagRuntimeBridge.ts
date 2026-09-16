import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { classifyAiApiCallError, resolveMigrationStatusText } from '@baishou/shared'
import {
  getCachedRagActiveState,
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
 * 监听主进程 RAG 进度并写入运行时缓存。
 * 应用根节点会常驻订阅；设置页 / 向量页也可再订阅，重复写入同一份缓存。
 * `active=false` 时不注册 IPC。
 */
export function useRagRuntimeBridge(active: boolean): void {
  const { t } = useTranslation()
  const tRef = useRef(t)
  tRef.current = t
  const statsRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) return

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
      const translate = (key: string, fallback: string) => tRef.current(key, fallback)
      const statusText = state.statusKey
        ? resolveMigrationStatusText(tRef.current, state.statusKey, state.statusParams)
        : state.statusText || ''
      const errorText =
        typeof state.error === 'string' && state.error.trim()
          ? localizeRagEmbedError(
              extractIpcErrorMessage({ message: state.error.trim() }),
              translate
            )
          : undefined

      const previous = getCachedRagActiveState()
      const keepBatchProgress = state.type === 'batchEmbed' || previous.type === 'batchEmbed'
      setCachedRagActiveState({
        ...previous,
        ...state,
        statusText,
        statusKey: state.statusKey,
        error: errorText,
        phase: state.phase ?? (keepBatchProgress ? previous.phase : undefined),
        phases: state.phases ?? (keepBatchProgress ? previous.phases : undefined),
        paused: Boolean(state.isRunning && state.paused),
        cancelling: Boolean(state.isRunning && state.cancelling)
      })

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
  }, [active])
}
