import { ipcRenderer } from 'electron'
import type { GraphExtractQueueItem, GraphExtractQueueSnapshot } from '@baishou/shared'

export type { GraphExtractQueueItem, GraphExtractQueueSnapshot }

export const graphApi = {
  graph: {
    listPendingReextract: () => ipcRenderer.invoke('graph:list-pending-reextract'),
    listPendingIndex: () => ipcRenderer.invoke('graph:list-pending-index'),
    estimateExtraction: () => ipcRenderer.invoke('graph:estimate-extraction'),
    /** @deprecated Prefer queueExtract; now enqueues and returns immediately. */
    extract: (opts?: { filePaths?: string[] }) => ipcRenderer.invoke('graph:extract', opts),
    queueExtract: (opts?: { filePaths?: string[]; concurrency?: number }) =>
      ipcRenderer.invoke('graph:queue-extract', opts) as Promise<{
        queued: number
        totalPending: number
        skippedNotEmbedded: string[]
      }>,
    setExtractConcurrency: (opts: { concurrency: number }) =>
      ipcRenderer.invoke('graph:set-extract-concurrency', opts) as Promise<{ concurrency: number }>,
    getQueueState: () =>
      ipcRenderer.invoke('graph:get-queue-state') as Promise<GraphExtractQueueSnapshot>,
    stopExtract: () => ipcRenderer.invoke('graph:stop-extract'),
    cancelExtract: () => ipcRenderer.invoke('graph:extract-cancel'),
    cancelQueueItem: (opts: { filePath: string }) =>
      ipcRenderer.invoke('graph:cancel-queue-item', opts) as Promise<{ ok: boolean }>,
    onQueueProgress: (callback: (state: GraphExtractQueueSnapshot) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, state: GraphExtractQueueSnapshot) => {
        callback(state)
      }
      ipcRenderer.on('graph:queue-progress', handler)
      return () => {
        ipcRenderer.removeListener('graph:queue-progress', handler)
      }
    },
    /** Legacy per-batch progress; queue uses onQueueProgress instead. */
    onExtractProgress: (
      callback: (progress: { current: number; total: number; filePath: string }) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: { current: number; total: number; filePath: string }
      ) => {
        callback(progress)
      }
      ipcRenderer.on('graph:extract-progress', handler)
      return () => {
        ipcRenderer.removeListener('graph:extract-progress', handler)
      }
    },
    getGlobalGraph: (opts?: {
      maxNodes?: number
      minMentionCount?: number
      nodeTypes?: string[]
      monthRange?: { startMonth: string; endMonth: string }
    }) => ipcRenderer.invoke('graph:get-global-graph', opts),
    getView: (opts: { centerNodeId: string; depth?: 1 | 2 | 3 }) =>
      ipcRenderer.invoke('graph:get-view', opts),
    findPaths: (opts: { fromId: string; toId: string; maxHops?: 2 | 3 }) =>
      ipcRenderer.invoke('graph:find-paths', opts),
    search: (opts: { query: string; nodeTypes?: string[]; limit?: number }) =>
      ipcRenderer.invoke('graph:search', opts),
    findByName: (opts: { query: string; nodeType?: string }) =>
      ipcRenderer.invoke('graph:find-by-name', opts),
    listPendingEdges: () => ipcRenderer.invoke('graph:list-pending-edges'),
    listPending: () => ipcRenderer.invoke('graph:list-pending'),
    setEdgeReview: (opts: { edgeId: string; reviewStatus: 'approved' | 'rejected' }) =>
      ipcRenderer.invoke('graph:set-edge-review', opts),
    setNodeReview: (opts: { nodeId: string; reviewStatus: 'approved' | 'rejected' }) =>
      ipcRenderer.invoke('graph:set-node-review', opts),
    setReviewsBatch: (opts: {
      reviewStatus: 'approved' | 'rejected'
      nodeIds?: string[]
      edgeIds?: string[]
      allPending?: boolean
    }) =>
      ipcRenderer.invoke('graph:set-reviews-batch', opts) as Promise<{
        ok: boolean
        nodeCount: number
        edgeCount: number
      }>,
    upsertNode: (input: {
      id?: string
      name: string
      nodeType: string
      aliases?: string[]
      summary?: string
    }) => ipcRenderer.invoke('graph:upsert-node', input),
    upsertEdge: (input: {
      id?: string
      fromId: string
      toId: string
      edgeType: string
      sourceRef?: string
      sourceExcerpt?: string
    }) => ipcRenderer.invoke('graph:upsert-edge', input),
    softDelete: (opts: { kind: 'node' | 'edge'; id: string }) =>
      ipcRenderer.invoke('graph:soft-delete', opts),
    mergeNodes: (opts: { survivorId: string; loserId: string; reason?: string }) =>
      ipcRenderer.invoke('graph:merge-nodes', opts),
    mergeNodesBatch: (opts: { survivorId: string; loserIds: string[]; reason?: string }) =>
      ipcRenderer.invoke('graph:merge-nodes-batch', opts),
    getNode: (id: string) => ipcRenderer.invoke('graph:get-node', id),
    meta: () => ipcRenderer.invoke('graph:meta')
  }
}
