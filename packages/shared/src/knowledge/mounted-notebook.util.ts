export const MAX_MOUNTED_NOTEBOOKS = 3

export const KNOWLEDGE_PER_NOTEBOOK_HIT_LIMIT = 6
export const KNOWLEDGE_TOTAL_HIT_LIMIT = 12

export const KNOWLEDGE_DIMENSION_MISMATCH = 'knowledge-dimension-mismatch'
export const KNOWLEDGE_MODEL_MISMATCH = 'knowledge-model-mismatch'
export const EMBEDDING_NOT_CONFIGURED = 'embedding-not-configured'

function asIdList(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? '').trim()).filter(Boolean)
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed) as unknown
        if (Array.isArray(parsed)) {
          return parsed.map((item) => String(item ?? '').trim()).filter(Boolean)
        }
      } catch {
        /* fall through */
      }
    }
    return trimmed
      .split(/[,|]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

/** 去重、去掉空值，最多保留 3 本。 */
export function parseMountedNotebookIds(raw: unknown): string[] {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const id of asIdList(raw)) {
    if (seen.has(id)) continue
    seen.add(id)
    ids.push(id)
    if (ids.length >= MAX_MOUNTED_NOTEBOOKS) break
  }
  return ids
}

export function serializeMountedNotebookIds(raw: unknown): string {
  const ids = parseMountedNotebookIds(raw)
  return ids.length === 0 ? '' : JSON.stringify(ids)
}

export function resolveWorkspaceNotebookIds(workspace?: {
  notebookIds?: unknown
} | null): string[] {
  return parseMountedNotebookIds(workspace?.notebookIds)
}

export type NotebookEmbeddingProfile = {
  notebookId: string
  notebookName?: string
  dimension: number
  modelId: string
  chunkCount: number
}

export function groupNotebookEmbeddingProfiles(
  profiles: NotebookEmbeddingProfile[]
): Map<string, NotebookEmbeddingProfile[]> {
  const byNotebook = new Map<string, NotebookEmbeddingProfile[]>()
  for (const row of profiles) {
    const id = row.notebookId.trim()
    if (!id || row.chunkCount <= 0) continue
    const list = byNotebook.get(id) ?? []
    list.push(row)
    byNotebook.set(id, list)
  }
  return byNotebook
}

export function buildKnowledgeDimensionMismatchMessage(
  profiles: NotebookEmbeddingProfile[]
): string {
  const byNotebook = groupNotebookEmbeddingProfiles(profiles)
  const parts: string[] = []
  for (const [notebookId, rows] of byNotebook) {
    const name = rows[0]?.notebookName?.trim() || notebookId
    const dims = [...new Set(rows.map((row) => row.dimension))].sort((a, b) => a - b)
    parts.push(`${name}（${dims.join('/')} 维）`)
  }
  return (
    `${KNOWLEDGE_DIMENSION_MISMATCH}: 已挂载笔记本的向量维度不一致，无法同时检索。` +
    (parts.length > 0 ? ` ${parts.join('、')}。` : '') +
    '请到知识库对维度不同的笔记本重新嵌入后再挂载。'
  )
}

/**
 * 已挂载笔记本必须同一维度；单本内部异构同样失败。
 * 没有向量的本子不参与比较。
 */
export function assertCompatibleNotebookDimensions(
  profiles: NotebookEmbeddingProfile[]
): { dimension: number } | null {
  const byNotebook = groupNotebookEmbeddingProfiles(profiles)
  if (byNotebook.size === 0) return null

  for (const rows of byNotebook.values()) {
    const dims = new Set(rows.map((row) => row.dimension))
    if (dims.size > 1) {
      throw new Error(buildKnowledgeDimensionMismatchMessage(profiles))
    }
  }

  const dims = new Set(
    [...byNotebook.values()].flatMap((rows) => rows.map((row) => row.dimension))
  )
  if (dims.size > 1) {
    throw new Error(buildKnowledgeDimensionMismatchMessage(profiles))
  }
  const dimension = [...dims][0]
  return dimension != null ? { dimension } : null
}

export function assertMountedNotebookModelMatch(
  profiles: NotebookEmbeddingProfile[],
  currentModelId?: string
): void {
  const modelId = currentModelId?.trim() || ''
  if (!modelId) return
  const mismatched = profiles.filter(
    (row) => row.chunkCount > 0 && row.modelId.trim() && row.modelId.trim() !== modelId
  )
  if (mismatched.length > 0) {
    throw new Error(KNOWLEDGE_MODEL_MISMATCH)
  }
}

export function buildKnowledgeMountPromptLines(opts: {
  notebookIds: string[]
  notebookNames?: Record<string, string>
}): string[] {
  const ids = parseMountedNotebookIds(opts.notebookIds)
  if (ids.length === 0) {
    return [
      'No knowledge notebook is mounted. Do not call knowledge_search or knowledge_graph_search, and do not invent notebook sources or notebookId values.'
    ]
  }
  const labels = ids.map((id) => opts.notebookNames?.[id]?.trim() || id)
  return [
    `Mounted knowledge notebooks (${ids.length}/${MAX_MOUNTED_NOTEBOOKS}): ${labels.join(', ')}.`,
    'When the user asks about these notebooks, call knowledge_search / knowledge_graph_search first.',
    'Prefer answering from retrieved sources and cite notebook name + source title + location. If sources are insufficient, say so explicitly. Do not invent content.',
    'If the user did not specify a notebook, search all mounted notebooks. Never pass a notebookId that is not in the mounted set.'
  ]
}
