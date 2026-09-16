export const RAG_VECTOR_KINDS = ['diary', 'partner', 'manual', 'graph_node'] as const

export type RagVectorKind = (typeof RAG_VECTOR_KINDS)[number]

export const RAG_VECTOR_KIND_FILTERS = ['all', ...RAG_VECTOR_KINDS] as const

export type RagVectorKindFilter = (typeof RAG_VECTOR_KIND_FILTERS)[number]

export const GRAPH_NODE_SOURCE_TYPE = 'graph_node'

export const GRAPH_NODE_EMBEDDING_ID_PREFIX = 'graph:'

export function graphNodeEmbeddingId(nodeId: string): string {
  return `${GRAPH_NODE_EMBEDDING_ID_PREFIX}${nodeId}`
}

export function parseGraphNodeEmbeddingId(embeddingId: string): string | null {
  if (!embeddingId.startsWith(GRAPH_NODE_EMBEDDING_ID_PREFIX)) return null
  const id = embeddingId.slice(GRAPH_NODE_EMBEDDING_ID_PREFIX.length).trim()
  return id || null
}

export function isGraphNodeRagEntry(sourceType?: string): boolean {
  return sourceType === GRAPH_NODE_SOURCE_TYPE
}

export function resolveRagVectorKind(entry: {
  sourceType?: string
  isManual?: boolean
}): RagVectorKind | null {
  if (isGraphNodeRagEntry(entry.sourceType)) return 'graph_node'
  if (entry.sourceType === 'diary') return 'diary'
  if (entry.sourceType === 'manual' || entry.isManual) return 'manual'
  if (entry.sourceType === 'memory') return 'partner'
  return null
}

export function ragVectorKindLabelKey(
  kind: RagVectorKindFilter
):
  | 'settings.rag_filter_all'
  | 'settings.rag_source_diary'
  | 'settings.rag_source_partner'
  | 'settings.rag_source_manual'
  | 'settings.rag_source_node' {
  if (kind === 'all') return 'settings.rag_filter_all'
  if (kind === 'diary') return 'settings.rag_source_diary'
  if (kind === 'partner') return 'settings.rag_source_partner'
  if (kind === 'manual') return 'settings.rag_source_manual'
  return 'settings.rag_source_node'
}
