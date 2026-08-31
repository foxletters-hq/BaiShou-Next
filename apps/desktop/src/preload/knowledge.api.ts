import { ipcRenderer } from 'electron'

export type KnowledgeSourceFilePreview = {
  kind: 'pdf' | 'text' | 'url' | 'unsupported'
  fileName: string
  localUrl: string | null
  fileBytes: Uint8Array | null
  textContent: string | null
  originUrl: string | null
}

export type KnowledgeOcrProgress = {
  sourceId: string
  page: number
  total: number
  phase?: 'ocr' | 'vision' | 'render'
}

export const knowledgeApi = {
  knowledge: {
    createNotebook: (input: {
      name: string
      description?: string
      coverTone?: string
      coverIcon?: string
    }) => ipcRenderer.invoke('knowledge:create-notebook', input),
    listNotebooks: () => ipcRenderer.invoke('knowledge:list-notebooks'),
    getNotebook: (notebookId: string) => ipcRenderer.invoke('knowledge:get-notebook', notebookId),
    updateNotebook: (input: {
      notebookId: string
      name?: string
      description?: string
      coverTone?: string | null
      coverIcon?: string | null
      coverImage?: string | null
    }) => ipcRenderer.invoke('knowledge:update-notebook', input),
    setCoverImage: (input: { notebookId: string; absolutePath: string }) =>
      ipcRenderer.invoke('knowledge:set-cover-image', input),
    reorderNotebooks: (orderedIds: string[]) =>
      ipcRenderer.invoke('knowledge:reorder-notebooks', orderedIds),
    listNotebookStats: () => ipcRenderer.invoke('knowledge:list-notebook-stats'),
    importSource: (input: {
      notebookId: string
      title: string
      kind: 'file' | 'text' | 'url' | 'note'
      absolutePath?: string
      textContent?: string
      fileName?: string
      originUrl?: string
      extractEngine?: 'simple' | 'ocr' | 'vision'
      importProcessMode?: 'vector' | 'graph' | 'both'
    }) => ipcRenderer.invoke('knowledge:import-source', input),
    probeExtractHint: (input: { absolutePath?: string; sourceId?: string }) =>
      ipcRenderer.invoke('knowledge:probe-extract-hint', input),
    retrySource: (sourceId: string) => ipcRenderer.invoke('knowledge:retry-source', sourceId),
    reprocessSource: (input: { sourceId: string; target: 'embed' | 'graph' }) =>
      ipcRenderer.invoke('knowledge:reprocess-source', input),
    deleteSource: (sourceId: string) => ipcRenderer.invoke('knowledge:delete-source', sourceId),
    rebuildIndex: (notebookId: string) => ipcRenderer.invoke('knowledge:rebuild-index', notebookId),
    getStats: (notebookId?: string) => ipcRenderer.invoke('knowledge:get-stats', notebookId),
    hasModelMismatch: () => ipcRenderer.invoke('knowledge:has-model-mismatch'),
    listSources: (notebookId: string) => ipcRenderer.invoke('knowledge:list-sources', notebookId),
    listChunks: (input: {
      notebookId: string
      limit?: number
      offset?: number
      query?: string
    }) => ipcRenderer.invoke('knowledge:list-chunks', input),
    search: (input: { notebookId: string; query: string; topK?: number }) =>
      ipcRenderer.invoke('knowledge:search', input),
    ask: (input: {
      notebookId: string
      question: string
      topK?: number
      multiQuery?: boolean
      assistantId?: string
      modelId?: string
      providerId?: string
      reasoningEffort?: string
      sessionId?: string
      searchMode?: boolean
    }) => ipcRenderer.invoke('knowledge:ask', input),
    cancelAsk: (notebookId: string) => ipcRenderer.invoke('knowledge:cancel-ask', notebookId),
    onAskProgress: (
      callback: (progress: {
        notebookId: string
        phase: 'retrieving' | 'thinking' | 'answering' | 'tool'
        text?: string
        reasoning?: string
        toolName?: string
        toolStatus?: 'running' | 'done' | 'failed'
        tools?: Array<{
          name: string
          displayName?: string
          status: 'running' | 'done' | 'failed'
          result?: string
        }>
      }) => void
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: {
          notebookId: string
          phase: 'retrieving' | 'thinking' | 'answering' | 'tool'
          text?: string
          reasoning?: string
          toolName?: string
          toolStatus?: 'running' | 'done' | 'failed'
          tools?: Array<{
            name: string
            displayName?: string
            status: 'running' | 'done' | 'failed'
            result?: string
          }>
        }
      ) => {
        callback(progress)
      }
      ipcRenderer.on('knowledge:ask-progress', handler)
      return () => {
        ipcRenderer.removeListener('knowledge:ask-progress', handler)
      }
    },
    listChatSessions: (notebookId: string) =>
      ipcRenderer.invoke('knowledge:list-chat-sessions', notebookId),
    createChatSession: (input: { notebookId: string; assistantId: string; title?: string }) =>
      ipcRenderer.invoke('knowledge:create-chat-session', input),
    updateChatSession: (input: {
      notebookId: string
      sessionId: string
      title?: string
      pinned?: boolean
      assistantId?: string
      deletedAt?: number | null
    }) => ipcRenderer.invoke('knowledge:update-chat-session', input),
    listChatMessages: (input: { notebookId: string; sessionId: string }) =>
      ipcRenderer.invoke('knowledge:list-chat-messages', input),
    appendChatMessage: (input: {
      notebookId: string
      sessionId: string
      role: 'user' | 'assistant'
      text: string
      reasoning?: string
      citations?: Array<{ sourceId?: string; title: string; excerpt?: string; page?: number }>
    }) => ipcRenderer.invoke('knowledge:append-chat-message', input),
    listGraphJobs: (notebookId: string) =>
      ipcRenderer.invoke('knowledge:list-graph-jobs', notebookId),
    chat: (input: {
      notebookId: string
      question: string
      sourceIds: string[]
      maxContextChars?: number
    }) => ipcRenderer.invoke('knowledge:chat', input),
    saveNote: (input: {
      notebookId: string
      title?: string
      question: string
      answer: string
      citations?: Array<{ title: string; page?: number; excerpt?: string }>
    }) => ipcRenderer.invoke('knowledge:save-note', input),
    ocrMissingPages: (input: {
      sourceId: string
      engine?: 'simple' | 'ocr' | 'vision'
      pageNumbers?: number[]
    }) => ipcRenderer.invoke('knowledge:ocr-missing-pages', input) as Promise<{ queued: true }>,
    cancelExtract: (sourceId: string) =>
      ipcRenderer.invoke('knowledge:cancel-extract', sourceId) as Promise<{
        cancelled: true
        status: string
      }>,
    recoverStale: () =>
      ipcRenderer.invoke('knowledge:recover-stale') as Promise<{
        resetSources: number
        reclaimedEmbedJobs: number
        droppedExtractJobs: number
      }>,
    getCapabilities: () => ipcRenderer.invoke('knowledge:get-capabilities'),
    getConfig: () => ipcRenderer.invoke('knowledge:get-config'),
    setConfig: (patch: {
      defaultExtractEngine?: 'simple' | 'ocr' | 'vision'
      importProcessMode?: 'vector' | 'graph' | 'both'
      ocrLanguage?: string
      ocrDpi?: number
      ocrConcurrency?: number
      multiQueryAsk?: boolean
      visionProviderId?: string | null
      visionModelId?: string | null
    }) => ipcRenderer.invoke('knowledge:set-config', patch),
    getExtractedPreview: (input: { notebookId: string; sourceId: string; maxChars?: number }) =>
      ipcRenderer.invoke('knowledge:get-extracted-preview', input),
    getSourceFile: (input: { sourceId: string }) =>
      ipcRenderer.invoke('knowledge:get-source-file', input) as Promise<KnowledgeSourceFilePreview>,
    getGraphView: (input: { notebookId: string; maxNodes?: number }) =>
      ipcRenderer.invoke('knowledge:get-graph-view', input),
    graphSearch: (input: { notebookId: string; query: string; limit?: number }) =>
      ipcRenderer.invoke('knowledge:graph-search', input),
    setGraphNodeReview: (input: {
      notebookId: string
      nodeId: string
      reviewStatus: 'approved' | 'rejected'
    }) => ipcRenderer.invoke('knowledge:set-graph-node-review', input),
    setGraphEdgeReview: (input: {
      notebookId: string
      edgeId: string
      reviewStatus: 'approved' | 'rejected'
    }) => ipcRenderer.invoke('knowledge:set-graph-edge-review', input),
    setGraphReviewsBatch: (input: {
      notebookId: string
      reviewStatus: 'approved' | 'rejected'
      nodeIds?: string[]
      edgeIds?: string[]
      allPending?: boolean
    }) => ipcRenderer.invoke('knowledge:set-graph-reviews-batch', input),
    rebuildGraph: (notebookId: string) => ipcRenderer.invoke('knowledge:rebuild-graph', notebookId),
    onGraphProgress: (callback: (progress: {
      at: number
      notebookId?: string
      sourceId?: string
      windowsDone?: number
      windowsTotal?: number
    }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        progress: {
          at: number
          notebookId?: string
          sourceId?: string
          windowsDone?: number
          windowsTotal?: number
        }
      ) => {
        callback(progress)
      }
      ipcRenderer.on('knowledge:graph-progress', handler)
      return () => {
        ipcRenderer.removeListener('knowledge:graph-progress', handler)
      }
    },
    onOcrProgress: (callback: (progress: KnowledgeOcrProgress) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: KnowledgeOcrProgress) => {
        callback(progress)
      }
      ipcRenderer.on('knowledge:ocr-progress', handler)
      return () => {
        ipcRenderer.removeListener('knowledge:ocr-progress', handler)
      }
    }
  }
}
