import { ipcRenderer } from 'electron'

export const graphApi = {
  graph: {
    listPendingReextract: () => ipcRenderer.invoke('graph:list-pending-reextract'),
    listPendingIndex: () => ipcRenderer.invoke('graph:list-pending-index'),
    extract: (opts?: { filePaths?: string[] }) => ipcRenderer.invoke('graph:extract', opts),
    getGlobalGraph: (opts?: {
      maxNodes?: number
      minMentionCount?: number
      nodeTypes?: string[]
    }) => ipcRenderer.invoke('graph:get-global-graph', opts),
    getView: (opts: { centerNodeId: string; depth?: 1 | 2 }) =>
      ipcRenderer.invoke('graph:get-view', opts),
    search: (opts: { query: string; nodeTypes?: string[]; limit?: number }) =>
      ipcRenderer.invoke('graph:search', opts),
    listPendingEdges: () => ipcRenderer.invoke('graph:list-pending-edges'),
    setEdgeReview: (opts: { edgeId: string; reviewStatus: 'approved' | 'rejected' }) =>
      ipcRenderer.invoke('graph:set-edge-review', opts),
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
