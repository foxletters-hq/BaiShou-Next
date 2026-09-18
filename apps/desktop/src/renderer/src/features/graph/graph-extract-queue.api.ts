/**
 * Graph extract queue IPC helpers.
 * Prefer preload `window.api.graph.*`; fall back to raw ipcRenderer when preload
 * is stale after renderer HMR (Electron preload only reloads on full app restart).
 */

import {
  emptyGraphExtractQueueSnapshot,
  graphExtractOverallProgress,
  type GraphExtractQueueSnapshot
} from '@baishou/shared'

export type { GraphExtractQueueSnapshot, GraphExtractQueueItem } from '@baishou/shared'

/** Window.api 把 aligningCount 等字段标成可选，共享快照类型则必填；计数缺省为 0，总进度缺省按条目重算 */
type GraphExtractQueueStateFromApi = {
  items: GraphExtractQueueSnapshot['items']
  activeCount: number
  pendingCount: number
  runningCount: number
  aligningCount?: number
  completedCount: number
  errorCount: number
  overallProgress?: number
  alignPoolSize?: number
  alignPoolCount?: number
}

export function normalizeQueueSnapshot(state: GraphExtractQueueStateFromApi): GraphExtractQueueSnapshot {
  const defaults = emptyGraphExtractQueueSnapshot()
  return {
    items: state.items,
    activeCount: state.activeCount,
    pendingCount: state.pendingCount,
    runningCount: state.runningCount,
    aligningCount: state.aligningCount ?? defaults.aligningCount,
    completedCount: state.completedCount,
    errorCount: state.errorCount,
    // 与 GraphPage 原来的 `overallProgress ?? graphExtractOverallProgress(items)` 一致，避免缺字段时把进度写成 0
    overallProgress: state.overallProgress ?? graphExtractOverallProgress(state.items),
    alignPoolSize: state.alignPoolSize ?? defaults.alignPoolSize,
    alignPoolCount: state.alignPoolCount ?? defaults.alignPoolCount
  }
}

function electronInvoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const invoke = window.electron?.ipcRenderer?.invoke
  if (typeof invoke !== 'function') {
    return Promise.reject(new Error(`IPC unavailable: ${channel}`))
  }
  return invoke(channel, ...args) as Promise<T>
}

export function graphQueueExtract(opts?: { filePaths?: string[]; concurrency?: number }) {
  if (typeof window.api?.graph?.queueExtract === 'function') {
    return window.api.graph.queueExtract(opts)
  }
  return electronInvoke<{
    queued: number
    totalPending: number
    skippedNotEmbedded: string[]
    blockedPendingEmbed?: number
  }>('graph:queue-extract', opts)
}

export function graphSetExtractConcurrency(concurrency: number) {
  const invoke = window.electron?.ipcRenderer?.invoke
  if (typeof window.api?.graph?.setExtractConcurrency === 'function') {
    return window.api.graph.setExtractConcurrency({ concurrency })
  }
  if (typeof invoke !== 'function') {
    return Promise.resolve({ concurrency })
  }
  return invoke('graph:set-extract-concurrency', { concurrency }) as Promise<{ concurrency: number }>
}

export function graphGetQueueState(): Promise<GraphExtractQueueSnapshot> {
  if (typeof window.api?.graph?.getQueueState === 'function') {
    return window.api.graph.getQueueState().then(normalizeQueueSnapshot)
  }
  return electronInvoke<GraphExtractQueueSnapshot>('graph:get-queue-state')
}

export function graphStopExtract() {
  if (typeof window.api?.graph?.stopExtract === 'function') {
    return window.api.graph.stopExtract()
  }
  if (typeof window.api?.graph?.cancelExtract === 'function') {
    return window.api.graph.cancelExtract()
  }
  return electronInvoke<{ ok: boolean }>('graph:stop-extract')
}

export function graphCancelQueueItem(filePath: string) {
  if (typeof window.api?.graph?.cancelQueueItem === 'function') {
    return window.api.graph.cancelQueueItem({ filePath })
  }
  return electronInvoke<{ ok: boolean }>('graph:cancel-queue-item', { filePath })
}

export function graphOnQueueProgress(
  callback: (state: GraphExtractQueueSnapshot) => void
): () => void {
  if (typeof window.api?.graph?.onQueueProgress === 'function') {
    return window.api.graph.onQueueProgress((state) => callback(normalizeQueueSnapshot(state)))
  }
  const ipc = window.electron?.ipcRenderer
  if (!ipc?.on) {
    return () => {}
  }
  const handler = (_event: unknown, state: GraphExtractQueueSnapshot) => {
    callback(state)
  }
  // @electron-toolkit preload: on() returns an unsubscribe function
  const unsubscribe = ipc.on('graph:queue-progress', handler)
  return typeof unsubscribe === 'function' ? unsubscribe : () => {}
}
