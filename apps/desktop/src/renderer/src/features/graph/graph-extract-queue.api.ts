/**
 * Graph extract queue IPC helpers.
 * Prefer preload `window.api.graph.*`; fall back to raw ipcRenderer when preload
 * is stale after renderer HMR (Electron preload only reloads on full app restart).
 */

import type { GraphExtractQueueSnapshot } from '@baishou/shared'

export type { GraphExtractQueueSnapshot, GraphExtractQueueItem } from '@baishou/shared'

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

export function graphGetQueueState() {
  if (typeof window.api?.graph?.getQueueState === 'function') {
    return window.api.graph.getQueueState()
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
    return window.api.graph.onQueueProgress(callback)
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
