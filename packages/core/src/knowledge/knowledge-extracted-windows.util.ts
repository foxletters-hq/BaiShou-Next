import { isPresentNotebookGraphShardKey } from '../raw-data/notebook-graph-shard-key.util'
import { resolveKnowledgeGraphWindow } from './knowledge-graph-windows.util'

export const MAX_EXTRACTED_WINDOW_QUERIES = 20

export type ExtractedKnowledgeWindowQuery = {
  sourceId: string
  windowIndex: number
}

export type ExtractedKnowledgeWindowItem = {
  sourceId: string
  sourceTitle: string
  windowIndex: number
  sourceRef: string
  text: string | null
}

export function normalizeExtractedWindowQueries(
  windows: Array<{ sourceId?: string; windowIndex?: number }>
): ExtractedKnowledgeWindowQuery[] {
  const seen = new Set<string>()
  const out: ExtractedKnowledgeWindowQuery[] = []
  for (const row of windows) {
    const sourceId = String(row.sourceId ?? '').trim()
    const windowIndex = Number(row.windowIndex)
    if (!isPresentNotebookGraphShardKey(sourceId)) continue
    if (!Number.isInteger(windowIndex) || windowIndex < 0) continue
    const key = `${sourceId}#${windowIndex}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ sourceId, windowIndex })
    if (out.length >= MAX_EXTRACTED_WINDOW_QUERIES) break
  }
  return out
}

export async function loadExtractedKnowledgeWindows(input: {
  notebookId: string
  windows: Array<{ sourceId?: string; windowIndex?: number }>
  readExtractedText: (notebookId: string, sourceId: string) => Promise<string | null>
  readPagesJson: (
    notebookId: string,
    sourceId: string
  ) => Promise<{ pages: Array<{ page: number; start: number; end: number }> } | null>
  getSource: (sourceId: string) => Promise<{ notebookId: string; title: string } | null>
}): Promise<ExtractedKnowledgeWindowItem[]> {
  const notebookId = input.notebookId.trim()
  const queries = normalizeExtractedWindowQueries(input.windows)
  if (!notebookId || queries.length === 0) return []

  const bySource = new Map<
    string,
    { title: string; text: string; pages: Array<{ page: number; start: number; end: number }> | null }
  >()

  const items: ExtractedKnowledgeWindowItem[] = []
  for (const query of queries) {
    let cached = bySource.get(query.sourceId)
    if (!cached) {
      const source = await input.getSource(query.sourceId)
      if (!source || source.notebookId !== notebookId) {
        items.push({
          sourceId: query.sourceId,
          sourceTitle: query.sourceId,
          windowIndex: query.windowIndex,
          sourceRef: `${query.sourceId}#${query.windowIndex}`,
          text: null
        })
        continue
      }
      const raw = await input.readExtractedText(notebookId, query.sourceId)
      const text = raw?.trim() ? raw : ''
      const pagesJson = await input.readPagesJson(notebookId, query.sourceId)
      cached = {
        title: source.title,
        text,
        pages: pagesJson?.pages ?? null
      }
      bySource.set(query.sourceId, cached)
    }

    const window = cached.text
      ? resolveKnowledgeGraphWindow({
          text: cached.text,
          sourceId: query.sourceId,
          windowIndex: query.windowIndex,
          pages: cached.pages
        })
      : null
    items.push({
      sourceId: query.sourceId,
      sourceTitle: cached.title,
      windowIndex: query.windowIndex,
      sourceRef: `${query.sourceId}#${query.windowIndex}`,
      text: window?.text?.trim() ? window.text : null
    })
  }
  return items
}
