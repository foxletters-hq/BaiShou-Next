export function sourceMissingPageCount(input: {
  pageCount?: number | null
  textPageCount?: number | null
}): number | null {
  const pages = input.pageCount
  const textPages = input.textPageCount
  if (pages == null || textPages == null || pages <= textPages) return null
  return pages - textPages
}

export type SourceCardEvidence = { type: 'scan'; pageCount: number; missingPages: number }

export function pickSourceCardEvidence(input: {
  pageCount?: number | null
  missingPages: number | null
  hideHints?: boolean
}): SourceCardEvidence | null {
  if (input.hideHints) return null
  if (input.missingPages != null && input.missingPages > 0 && input.pageCount != null) {
    return {
      type: 'scan',
      pageCount: input.pageCount,
      missingPages: input.missingPages
    }
  }
  return null
}

export type KnowledgeSourceFragmentKind = 'graph-window' | 'vector-chunk'

export type KnowledgeSourceFragment = {
  id: string
  sourceTitle: string
  kind: KnowledgeSourceFragmentKind
  index: number
  excerpts: string[]
  text: string | null
}

export function buildGraphFragmentItems(
  windows: Array<{ sourceId: string; windowIndex: number; excerpts: string[] }>,
  loaded: Array<{
    sourceId: string
    windowIndex: number
    sourceTitle: string
    text: string | null
  }>
): KnowledgeSourceFragment[] {
  const byKey = new Map<string, (typeof loaded)[number]>(
    loaded.map((item) => [`${item.sourceId}#${item.windowIndex}`, item])
  )
  return windows.map((window) => {
    const key = `${window.sourceId}#${window.windowIndex}`
    const item = byKey.get(key)
    return {
      id: key,
      sourceTitle: item?.sourceTitle?.trim() || window.sourceId,
      kind: 'graph-window',
      index: window.windowIndex,
      excerpts: window.excerpts,
      text: item?.text ?? null
    }
  })
}
