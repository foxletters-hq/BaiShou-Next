import { ipcRenderer } from 'electron'

export type KnowledgeSourceFilePreview = {
  kind: 'pdf' | 'text' | 'url' | 'unsupported'
  fileName: string
  localUrl: string | null
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
    createNotebook: (input: { name: string; description?: string }) =>
      ipcRenderer.invoke('knowledge:create-notebook', input),
    listNotebooks: () => ipcRenderer.invoke('knowledge:list-notebooks'),
    importSource: (input: {
      notebookId: string
      title: string
      kind: 'file' | 'text' | 'url' | 'note'
      absolutePath?: string
      textContent?: string
      fileName?: string
      originUrl?: string
      extractEngine?: 'simple' | 'ocr' | 'vision'
    }) => ipcRenderer.invoke('knowledge:import-source', input),
    retrySource: (sourceId: string) => ipcRenderer.invoke('knowledge:retry-source', sourceId),
    rebuildIndex: (notebookId: string) => ipcRenderer.invoke('knowledge:rebuild-index', notebookId),
    getStats: (notebookId?: string) => ipcRenderer.invoke('knowledge:get-stats', notebookId),
    hasModelMismatch: () => ipcRenderer.invoke('knowledge:has-model-mismatch'),
    listSources: (notebookId: string) => ipcRenderer.invoke('knowledge:list-sources', notebookId),
    search: (input: { notebookId: string; query: string; topK?: number }) =>
      ipcRenderer.invoke('knowledge:search', input),
    ask: (input: { notebookId: string; question: string; topK?: number; multiQuery?: boolean }) =>
      ipcRenderer.invoke('knowledge:ask', input),
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
