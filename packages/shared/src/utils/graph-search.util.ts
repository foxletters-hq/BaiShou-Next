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
