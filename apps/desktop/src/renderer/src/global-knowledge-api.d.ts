/** 桌面 Knowledge preload 类型，从全局 IPC 声明按域拆出。 */
interface KnowledgeAPI {
  createNotebook(input: {
    name: string
    description?: string
    coverTone?: string
    coverIcon?: string
  }): Promise<{
    id: string
    name: string
    coverTone: string
    coverIcon: string
    sortOrder: number
    coverImageUrl?: string | null
  }>
  listNotebooks(): Promise<unknown[]>
  listMountSummaries(): Promise<
    Array<{
      id: string
      name: string
      sources: number
      chunks: number
      dimension: number | null
      dimensions: number[]
      modelIds: string[]
      mixedEmbeddings: boolean
    }>
  >
  getNotebook(notebookId: string): Promise<{
    id: string
    name: string
    description?: string
    updatedAt?: number
    createdAt?: number
    sortOrder?: number
    coverTone?: string
    coverIcon?: string
    coverImage?: string
    coverImageUrl?: string | null
  } | null>
  updateNotebook(input: {
    notebookId: string
    name?: string
    description?: string
    coverTone?: string | null
    coverIcon?: string | null
    coverImage?: string | null
  }): Promise<{
    id: string
    name: string
    description?: string
    sortOrder?: number
    coverTone?: string
    coverIcon?: string
    coverImage?: string
    coverImageUrl?: string | null
  }>
  setCoverImage(input: { notebookId: string; absolutePath: string }): Promise<{
    id: string
    coverImage?: string
    coverImageUrl?: string | null
  }>
  reorderNotebooks(orderedIds: string[]): Promise<unknown[]>
  listNotebookStats(): Promise<
    Array<{
      notebookId: string
      sources: number
      chunks: number
      pendingJobs: number
      originalBytes: number
      totalBytes: number
    }>
  >
  importSource(input: {
    notebookId: string
    title: string
    kind: 'file' | 'text' | 'url' | 'note'
    absolutePath?: string
    textContent?: string
    fileName?: string
    originUrl?: string
    extractEngine?: 'simple' | 'ocr' | 'vision'
    importProcessMode?: import('@baishou/shared').KnowledgeImportProcessMode
  }): Promise<{ sourceId: string }>
  probeExtractHint(input: {
    absolutePath?: string
    sourceId?: string
  }): Promise<import('@baishou/shared').KnowledgeExtractHint>
  retrySource(sourceId: string): Promise<{ ok: boolean }>
  reprocessSource(input: { sourceId: string; target: 'embed' | 'graph' }): Promise<{ ok: boolean }>
  deleteSource(sourceId: string): Promise<{ ok: boolean }>
  rebuildIndex(notebookId: string): Promise<{ ok: boolean }>
  manageData(input: {
    notebookId: string
    action: 'clear' | 'reprocess'
    vector?: boolean
    graph?: boolean
  }): Promise<{
    action: 'clear' | 'reprocess'
    vector: boolean
    graph: boolean
    sourceCount: number
    vectorQueued: number
    graphQueued: number
  }>
  getStats(notebookId?: string): Promise<{
    notebooks: number
    sources: number
    chunks: number
    pendingJobs: number
    originalBytes: number
    totalBytes: number
  }>
  hasModelMismatch(notebookIds?: string[]): Promise<boolean>
  listSources(notebookId: string): Promise<unknown[]>
  listChunks(input: {
    notebookId: string
    limit?: number
    offset?: number
    query?: string
  }): Promise<{
    items: Array<{
      chunkId: string
      sourceId: string
      notebookId: string
      chunkIndex: number
      chunkText: string
      metadataJson: string
      dimension: number
      modelId: string
      createdAt: number
      sourceTitle: string | null
    }>
    total: number
  }>
  search(input: { notebookId: string; query: string; topK?: number }): Promise<unknown[]>
  ocrMissingPages(input: {
    sourceId: string
    engine?: 'simple' | 'ocr' | 'vision'
    pageNumbers?: number[]
  }): Promise<{ queued: true }>
  cancelExtract(sourceId: string): Promise<{ cancelled: true; status: string }>
  recoverStale(): Promise<{
    resetSources: number
    reclaimedEmbedJobs: number
    droppedExtractJobs: number
  }>
  probeExtractSample(input: {
    notebookId?: string
    sourceId: string
    engine: 'simple' | 'ocr' | 'vision'
    ocrLanguage?: string
    ocrConcurrency?: number
    visionProviderId?: string | null
    visionModelId?: string | null
  }): Promise<{
    sourceId: string
    title: string
    engine: 'simple' | 'ocr' | 'vision'
    pageCount: number
    sampledPages: number[]
    pages: Array<{ page: number; text: string }>
  }>
  getCapabilities(): Promise<{
    simple: { available: boolean; reason?: string; detail?: string }
    ocr: { available: boolean; reason?: string; detail?: string }
    vision: { available: boolean; reason?: string; detail?: string }
    recommended: 'simple' | 'ocr' | 'vision'
  }>
  getConfig(): Promise<{
    defaultExtractEngine?: 'simple' | 'ocr' | 'vision'
    importProcessMode?: import('@baishou/shared').KnowledgeImportProcessMode
    ocrLanguage?: string
    ocrDpi?: number
    ocrConcurrency?: number
    multiQueryAsk?: boolean
    visionProviderId?: string | null
    visionModelId?: string | null
  }>
  setConfig(patch: {
    defaultExtractEngine?: 'simple' | 'ocr' | 'vision'
    importProcessMode?: import('@baishou/shared').KnowledgeImportProcessMode
    ocrLanguage?: string
    ocrDpi?: number
    ocrConcurrency?: number
    multiQueryAsk?: boolean
    visionProviderId?: string | null
    visionModelId?: string | null
  }): Promise<unknown>
  getExtractedPreview(input: {
    notebookId: string
    sourceId: string
    maxChars?: number
  }): Promise<{ text: string | null; truncated: boolean }>
  getExtractedWindows(input: {
    notebookId: string
    windows: Array<{ sourceId: string; windowIndex: number }>
  }): Promise<{
    items: Array<{
      sourceId: string
      sourceTitle: string
      windowIndex: number
      sourceRef: string
      text: string | null
    }>
  }>
  getSourceFile(input: { sourceId: string }): Promise<{
    kind: 'pdf' | 'text' | 'url' | 'unsupported'
    fileName: string
    localUrl: string | null
    fileBytes: Uint8Array | null
    textContent: string | null
    originUrl: string | null
  }>
  onOcrProgress(
    callback: (progress: {
      sourceId: string
      page: number
      total: number
      phase?: 'ocr' | 'vision' | 'render'
    }) => void
  ): () => void
  getGraphView(input: { notebookId: string; maxNodes?: number }): Promise<{
    nodes: Array<{
      id: string
      name: string
      nodeType: string
      mentionCount?: number
      reviewStatus?: string
      summary?: string
    }>
    edges: Array<{
      id: string
      fromId: string
      toId: string
      edgeType: string
      reviewStatus?: string
      sourceRef?: string | null
      sourceExcerpt?: string
    }>
  }>
  graphSearch(input: {
    notebookId: string
    query: string
    limit?: number
  }): Promise<Array<{ id: string; name: string; nodeType: string; summary?: string }>>
  setGraphNodeReview(input: {
    notebookId: string
    nodeId: string
    reviewStatus: 'approved' | 'rejected'
  }): Promise<{ ok: boolean }>
  setGraphEdgeReview(input: {
    notebookId: string
    edgeId: string
    reviewStatus: 'approved' | 'rejected'
  }): Promise<{ ok: boolean }>
  setGraphReviewsBatch(input: {
    notebookId: string
    reviewStatus: 'approved' | 'rejected'
    nodeIds?: string[]
    edgeIds?: string[]
    allPending?: boolean
  }): Promise<{ ok: boolean; nodeCount: number; edgeCount: number }>
  rebuildGraph(notebookId: string): Promise<{ ok: boolean }>
  listGraphJobs(notebookId: string): Promise<{
    pending: number
    running: number
    failed: number
    currentSourceId: string | null
    currentSourceTitle: string | null
    items: Array<{
      sourceId: string
      title: string
      status: string
      lastError?: string | null
    }>
  }>
  onGraphProgress(
    callback: (progress: {
      at: number
      notebookId?: string
      sourceId?: string
      windowsDone?: number
      windowsTotal?: number
    }) => void
  ): () => void
}
