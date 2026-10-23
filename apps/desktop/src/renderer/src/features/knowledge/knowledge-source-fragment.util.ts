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

export function buildVectorFragmentItem(input: {
  chunkId: string
  sourceTitle: string
  chunkIndex: number
  chunkText: string
}): KnowledgeSourceFragment {
  const text = input.chunkText.trim()
  return {
    id: input.chunkId,
    sourceTitle: input.sourceTitle,
    kind: 'vector-chunk',
    index: input.chunkIndex,
    excerpts: [],
    text: text || null
  }
}
