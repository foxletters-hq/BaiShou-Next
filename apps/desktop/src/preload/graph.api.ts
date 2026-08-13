import { ipcRenderer } from 'electron'

export type GraphExtractQueueItem = {
  id: string
  filePath: string
  date?: string
  progress: number
  status: 'pending' | 'running' | 'completed' | 'error'
  error?: string
}

export type GraphExtractQueueSnapshot = {
  items: GraphExtractQueueItem[]
  activeCount: number
  pendingCount: number
  runningCount: number
  completedCount: number
  errorCount: number
}

export const graphApi = {
  graph: {
    listPendingReextract: () => ipcRenderer.invoke('graph:list-pending-reextract'),
    listPendingIndex: () => ipcRenderer.invoke('graph:list-pending-index'),
    estimateExtraction: () => ipcRenderer.invoke('graph:estimate-extraction'),
    /** @deprecated Prefer queueExtract; now enqueues and returns immediately. */
    extract: (opts?: { filePaths?: string[] }) => ipcRenderer.invoke('graph:extract', opts),
    queueExtract: (opts?: { filePaths?: string[] }) =>
      ipcRenderer.invoke('graph:queue-extract', opts) as Promise<{
        queued: number
        totalPending: number
      }>,
    getQueueState: () =>
      ipcRenderer.invoke('graph:get-queue-state') as Promise<GraphExtractQueueSnapshot>,
    stopExtract: () => ipcRenderer.invoke('graph:stop-extract'),
    cancelExtract: () => ipcRenderer.invoke('graph:extract-cancel'),
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
    listPendingEdges: () => ipcRenderer.invoke('graph:list-pending-edges'),
    listPending: () => ipcRenderer.invoke('graph:list-pending'),
    setEdgeReview: (opts: { edgeId: string; reviewStatus: 'approved' | 'rejected' }) =>
      ipcRenderer.invoke('graph:set-edge-review', opts),
    setNodeReview: (opts: { nodeId: string; reviewStatus: 'approved' | 'rejected' }) =>
      ipcRenderer.invoke('graph:set-node-review', opts),
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
    getNode: (id: string) => ipcRenderer.invoke('graph:get-node', id),
    meta: () => ipcRenderer.invoke('graph:meta')
  }
}
