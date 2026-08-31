import { isGarbledExtractText } from '@baishou/shared'
import type { ToolKnowledgeSearchHit } from '@baishou/shared'

export function usableKnowledgeSearchHits(
  hits: ToolKnowledgeSearchHit[]
): ToolKnowledgeSearchHit[] {
  return hits.filter((hit) => !isGarbledExtractText(hit.chunkText || ''))
}

export function formatKnowledgeSearchHits(
  query: string,
  hits: ToolKnowledgeSearchHit[]
): string {
  const usable = usableKnowledgeSearchHits(hits)
  if (usable.length === 0) {
    if (hits.length > 0) {
      return (
        `笔记本里找到了与「${query}」相关的片段，但文本层已损坏，不能作为引用。` +
        '请对该来源使用视觉提取后再提问，不要编造正文。'
      )
    }
    return `笔记本里没有找到与「${query}」匹配的片段。不要编造资料内容。`
  }

  const lines = usable.map((hit, index) => {
    const title = hit.title?.trim() || hit.sourceId.slice(0, 8)
    const excerpt = hit.chunkText.replace(/\s+/g, ' ').trim().slice(0, 400)
    const loc = hit.offset != null ? `偏移 ${hit.offset}` : `片段 #${hit.chunkIndex}`
    return `[${index + 1}] ${title}（${loc}）\n${excerpt}`
  })
  return [`## 知识库检索`, `查询：${query}`, `可用片段 ${usable.length} 条`, ...lines].join('\n\n')
}

export function citationsFromKnowledgeHits(hits: ToolKnowledgeSearchHit[]): Array<{
  sourceId: string
  title: string
  excerpt: string
  offset?: number
  chunkIndex?: number
}> {
  return usableKnowledgeSearchHits(hits).map((hit) => ({
    sourceId: hit.sourceId,
    title: hit.title?.trim() || hit.sourceId,
    excerpt: hit.chunkText.replace(/\s+/g, ' ').trim().slice(0, 240),
    offset: hit.offset,
    chunkIndex: hit.chunkIndex
  }))
}
