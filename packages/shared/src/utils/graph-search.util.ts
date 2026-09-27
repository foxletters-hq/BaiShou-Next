export const GRAPH_SEARCH_MODES = ['text', 'semantic'] as const
export type GraphSearchMode = (typeof GRAPH_SEARCH_MODES)[number]

export const GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR = 'GRAPH_SEARCH_EMBEDDING_REQUIRED'

export function isGraphSearchMode(value: unknown): value is GraphSearchMode {
  return value === 'text' || value === 'semantic'
}

export function resolveGraphSearchMode(value: unknown): GraphSearchMode {
  return isGraphSearchMode(value) ? value : 'text'
}

export function isGraphSearchEmbeddingRequiredError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '')
  return message.includes(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR)
}

/** 文本走名称；语义先嵌入查询再按节点向量搜。画布打开不读向量。 */
export async function runGraphModeSearch<T>(opts: {
  mode: unknown
  query: string
  embedQuery?: ((text: string) => Promise<number[] | null>) | null
  modelId?: string
  searchName: (query: string) => Promise<T[]>
  searchVector: (vector: number[], modelId?: string) => Promise<T[]>
}): Promise<T[]> {
  const q = opts.query.trim()
  if (!q) return []
  const mode = resolveGraphSearchMode(opts.mode)
  if (mode !== 'semantic') return opts.searchName(q)
  if (!opts.embedQuery) throw new Error(GRAPH_SEARCH_EMBEDDING_REQUIRED_ERROR)
  const vector = await opts.embedQuery(q)
  if (!vector?.length) return []
  return opts.searchVector(vector, opts.modelId)
}
