/** 桌面 Graph preload 类型，从全局 IPC 声明按域拆出。 */
interface GraphAPI {
  listPendingReextract(): Promise<
    Array<{
      filePath: string
      contentHash: string
      lastExtractedHash: string | null
      date?: string
    }>
  >
  listPendingIndex(): Promise<unknown[]>
  estimateExtraction(): Promise<{
    entryCount: number
    estimatedTokens: number
    estimatedMinutesLow: number
    estimatedMinutesHigh: number
  }>
  extract(opts?: { filePaths?: string[] }): Promise<{
    done: number
    failed: number
    queued?: number
    cancelled?: boolean
    errors: Array<{ filePath: string; message: string }>
  }>
  queueExtract(opts?: { filePaths?: string[]; concurrency?: number }): Promise<{
    queued: number
    totalPending: number
    skippedNotEmbedded: string[]
    blockedPendingEmbed?: number
  }>
  setExtractConcurrency(opts: { concurrency: number }): Promise<{ concurrency: number }>
  getQueueState(): Promise<{
    items: Array<{
      id: string
      filePath: string
      date?: string
      progress: number
      status: 'pending' | 'running' | 'aligning' | 'completed' | 'error'
      phase?:
        | 'queued'
        | 'reading'
        | 'model'
        | 'waiting_model'
        | 'thinking'
        | 'streaming'
        | 'parsing'
        | 'waiting_pool'
        | 'recalling'
        | 'waiting_align'
        | 'aligning'
        | 'writing'
      phaseDetail?: string
      error?: string
    }>
    activeCount: number
    pendingCount: number
    runningCount: number
    aligningCount?: number
    completedCount: number
    errorCount: number
    overallProgress?: number
    alignPoolSize?: number
    alignPoolCount?: number
  }>
  stopExtract(): Promise<{ ok: boolean }>
  cancelExtract(): Promise<{ ok: boolean }>
  cancelQueueItem(opts: { filePath: string }): Promise<{ ok: boolean }>
  onQueueProgress(
    callback: (state: {
      items: Array<{
        id: string
        filePath: string
        date?: string
        progress: number
        status: 'pending' | 'running' | 'aligning' | 'completed' | 'error'
        phase?:
          | 'queued'
          | 'reading'
          | 'model'
          | 'waiting_model'
          | 'thinking'
          | 'streaming'
          | 'parsing'
          | 'waiting_pool'
          | 'recalling'
          | 'waiting_align'
          | 'aligning'
          | 'writing'
        phaseDetail?: string
        error?: string
      }>
      activeCount: number
      pendingCount: number
      runningCount: number
      aligningCount?: number
      completedCount: number
      errorCount: number
      overallProgress?: number
      alignPoolSize?: number
      alignPoolCount?: number
    }) => void
  ): () => void
  onExtractProgress(
    callback: (progress: { current: number; total: number; filePath: string }) => void
  ): () => void
  getGlobalGraph(opts?: {
    maxNodes?: number
    minMentionCount?: number
    nodeTypes?: string[]
    monthRange?: { startMonth: string; endMonth: string }
  }): Promise<{ nodes: any[]; edges: any[] }>
  getView(opts: {
    centerNodeId: string
    depth?: 1 | 2 | 3
  }): Promise<{ nodes: any[]; edges: any[] }>
  findPaths(opts: {
    fromId: string
    toId: string
    maxHops?: 2 | 3
  }): Promise<{ nodeIds: string[]; edges: any[] } | null>
  search(opts: { query: string; nodeTypes?: string[]; limit?: number }): Promise<any[]>
  findByName(opts: { query: string; nodeType?: string }): Promise<{
    id: string
    name: string
    nodeType: string
    summary: string
    aliases: string[]
    discriminator?: string
  } | null>
  listPendingEdges(): Promise<any[]>
  listPending(): Promise<{ nodes: any[]; edges: any[]; endpointNodes?: any[] }>
  listSuspectNodes(): Promise<any[]>
  listSimilarPairs(): Promise<
    Array<{
      nodeId: string
      nodeName: string
      peerId: string
      peerName: string
      similarity: number
      reason: string
      sourceExcerpt?: string
      createdAt: string
    }>
  >
  dismissSimilarPair(opts: { nodeId: string; peerId: string }): Promise<{ ok: boolean }>
  setEdgeReview(opts: {
    edgeId: string
    reviewStatus: 'approved' | 'rejected'
  }): Promise<{ ok: boolean }>
  setNodeReview(opts: {
    nodeId: string
    reviewStatus: 'approved' | 'rejected'
  }): Promise<{ ok: boolean }>
  setReviewsBatch(opts: {
    reviewStatus: 'approved' | 'rejected'
    nodeIds?: string[]
    edgeIds?: string[]
    allPending?: boolean
  }): Promise<{ ok: boolean; nodeCount: number; edgeCount: number }>
  upsertNode(input: {
    id?: string
    name: string
    nodeType: string
    aliases?: string[]
    summary?: string
  }): Promise<
    | { id: string }
    | {
        conflict: 'same-name'
        existing: { id: string; name: string; nodeType: string; summary: string }
        candidates?: Array<{
          nodeId: string
          name: string
          discriminator: string
          label: string
        }>
        canRegisterAnother?: boolean
      }
  >
  upsertEdge(input: {
    id?: string
    fromId: string
    toId: string
    edgeType: string
    sourceRef?: string
    sourceExcerpt?: string
  }): Promise<{ id: string }>
  softDelete(opts: { kind: 'node' | 'edge'; id: string }): Promise<{ ok: boolean }>
  mergeNodes(opts: {
    survivorId: string
    loserId: string
    reason?: string
  }): Promise<{ ok: boolean; survivorId: string; loserId: string }>
  mergeNodesBatch(opts: {
    survivorId: string
    loserIds: string[]
    reason?: string
  }): Promise<{ ok: boolean; survivorId: string; loserIds: string[] }>
  splitNode(opts: {
    bareNodeId: string
    discriminator: string
    label: string
    summary?: string
    edgeAssignments: Array<{ edgeId: string; target: 'bare' | 'split' }>
    reason?: string
  }): Promise<{
    ok: boolean
    bareNodeId: string
    splitNodeId: string
    movedEdgeIds: string[]
    unassignedEdgeIds: string[]
  }>
  revertNodeSplit(opts: {
    bareNodeId: string
    discriminator: string
    reason?: string
  }): Promise<{ ok: boolean; removedNodeId: string | null }>
  listNameCandidates(opts: {
    nodeId: string
  }): Promise<Array<{ nodeId: string; name: string; discriminator: string; label: string }>>
  listSplitEdges(opts: { nodeId: string }): Promise<
    Array<{
      edgeId: string
      edgeType: string
      partnerName: string
      sourceRef: string | null
      sourceExcerpt: string
    }>
  >
  getNode(id: string): Promise<any>
  meta(): Promise<{ nodeTypes: string[]; edgeTypes: string[] }>
  resolveJournal(opts: { date: string }): Promise<{ filePath: string; date: string } | null>
  clearLifeGraph(): Promise<{ ok: boolean; shardCount: number }>
}
