export type KnowledgeCitationView = {
  notebookId?: string
  notebookName: string
  title: string
  excerpt?: string
  page?: number
  offset?: number
  chunkIndex?: number
  sourceId?: string
}

function tryParseJson(value: string): unknown {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return null
  }
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function normalizeCitation(raw: unknown): KnowledgeCitationView | null {
  if (!raw || typeof raw !== 'object') return null
  const row = raw as Record<string, unknown>
  const title = readOptionalString(row.title)
  if (!title) return null
  const notebookName =
    readOptionalString(row.notebookName) || readOptionalString(row.notebookId) || ''
  return {
    notebookId: readOptionalString(row.notebookId),
    notebookName,
    title,
    excerpt: readOptionalString(row.excerpt),
    page: readOptionalNumber(row.page),
    offset: readOptionalNumber(row.offset),
    chunkIndex: readOptionalNumber(row.chunkIndex),
    sourceId: readOptionalString(row.sourceId)
  }
}

export function parseKnowledgeSearchToolResult(result: unknown): {
  text: string
  citations: KnowledgeCitationView[]
} | null {
  const raw = typeof result === 'string' ? tryParseJson(result) : result
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const obj = raw as Record<string, unknown>
  if (typeof obj.text !== 'string' || !Array.isArray(obj.citations)) return null
  return {
    text: obj.text,
    citations: obj.citations.map(normalizeCitation).filter((row): row is KnowledgeCitationView => row != null)
  }
}

export function collectKnowledgeCitationsFromInvocations(
  invocations: Array<{ toolName?: string; result?: unknown }> | undefined
): KnowledgeCitationView[] {
  if (!invocations?.length) return []
  const out: KnowledgeCitationView[] = []
  for (const invocation of invocations) {
    if (invocation.toolName !== 'knowledge_search') continue
    const parsed = parseKnowledgeSearchToolResult(invocation.result)
    if (parsed) out.push(...parsed.citations)
  }
  return out
}

export function formatKnowledgeCitationLocation(citation: KnowledgeCitationView): string {
  if (citation.page != null) return `第 ${citation.page} 页`
  if (citation.offset != null) return `偏移 ${citation.offset}`
  if (citation.chunkIndex != null) return `片段 #${citation.chunkIndex}`
  return ''
}
