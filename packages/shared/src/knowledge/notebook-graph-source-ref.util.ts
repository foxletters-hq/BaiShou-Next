export type NotebookGraphSourceWindowRef = {
  sourceId: string
  windowIndex: number
}

export type NotebookGraphSourceWindowQuery = NotebookGraphSourceWindowRef & {
  excerpts: string[]
}

/** sourceRef 形如 src_ab12#0 → 资料 id + 抽取窗口号 */
export function parseNotebookGraphSourceWindowRef(
  sourceRef: string | null | undefined
): NotebookGraphSourceWindowRef | null {
  const raw = (sourceRef ?? '').trim()
  if (!raw) return null
  const hash = raw.lastIndexOf('#')
  if (hash <= 0 || hash === raw.length - 1) return null
  const sourceId = raw.slice(0, hash).trim()
  const indexText = raw.slice(hash + 1).trim()
  if (!sourceId || !/^\d+$/.test(indexText)) return null
  return { sourceId, windowIndex: Number(indexText) }
}

/** 按资料 + 窗口号去重，保留首次出现顺序，并合并摘录 */
export function collectNotebookGraphSourceWindows(
  edges: Array<{ sourceRef?: string | null; sourceExcerpt?: string | null }>
): NotebookGraphSourceWindowQuery[] {
  const seen = new Map<string, NotebookGraphSourceWindowQuery>()
  for (const edge of edges) {
    const parsed = parseNotebookGraphSourceWindowRef(edge.sourceRef)
    if (!parsed) continue
    const key = `${parsed.sourceId}#${parsed.windowIndex}`
    const excerpt = (edge.sourceExcerpt ?? '').trim()
    const existing = seen.get(key)
    if (existing) {
      if (excerpt && !existing.excerpts.includes(excerpt)) existing.excerpts.push(excerpt)
      continue
    }
    seen.set(key, {
      sourceId: parsed.sourceId,
      windowIndex: parsed.windowIndex,
      excerpts: excerpt ? [excerpt] : []
    })
  }
  return [...seen.values()]
}
