import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { localizeAiApiErrorMessage, resolveMigrationStatusText } from '@baishou/shared'
import {
  getCachedRagActiveState,
  patchCachedRagStats,
  setCachedRagActiveState
} from '../rag-runtime-cache'

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

    const applyRagProgress = (state: any, options?: { hydrate?: boolean }) => {
      const translate = (key: string, fallback: string) => tRef.current(key, fallback)
      const statusText = state.statusKey
        ? resolveMigrationStatusText(tRef.current, state.statusKey, state.statusParams)
        : state.statusText || ''
      const errorText =
        typeof state.error === 'string' && state.error.trim()
          ? localizeAiApiErrorMessage(
              extractIpcErrorMessage(new Error(state.error.trim())),
              translate
            )
          : undefined

      const previous = getCachedRagActiveState()
      const keepBatchProgress = state.type === 'batchEmbed' || previous.type === 'batchEmbed'
      // 刚点「开始整理」时本地已标 running，回问若还是 idle 不要盖掉
      if (
        options?.hydrate &&
        previous.isRunning &&
        previous.type === 'batchEmbed' &&
        !state.isRunning
      ) {
        return
      }
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
    }

    void api.rag.getBatchEmbedState?.().then((state: any) => {
      if (state) applyRagProgress(state, { hydrate: true })
    })

    const cleanup = api.rag.onRagProgress((state: any) => applyRagProgress(state))

    return () => {
      cleanup?.()
      if (statsRefreshTimerRef.current) {
        clearTimeout(statsRefreshTimerRef.current)
        statsRefreshTimerRef.current = null
      }
    }
  }, [active])
}
