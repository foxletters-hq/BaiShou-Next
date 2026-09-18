export type KnowledgeSourceRow = {
  id: string
  title: string
  sourceKind: string
  status: string
  errorMessage?: string | null
  pageCount?: number | null
  textPageCount?: number | null
  originUrl?: string | null
  extractEngine?: string | null
  relativePath?: string | null
}

export type KnowledgeImportMode = 'chooser' | 'file' | 'text' | 'url' | null

export type KnowledgeEngineCapSlot = {
  available: boolean
  reason?: string
  detail?: string
}

export type KnowledgeEngineCaps = {
  simple: KnowledgeEngineCapSlot
  ocr: KnowledgeEngineCapSlot
  vision: KnowledgeEngineCapSlot
}

export type KnowledgeOcrProgressState = {
  page: number
  total: number
  phase?: string
}

export type KnowledgeUploadingSource = {
  localId: string
  fileName: string
  fileSize: number
  progress: number
  error?: string
}
