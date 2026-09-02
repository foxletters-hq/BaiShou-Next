import {
  KNOWLEDGE_PER_NOTEBOOK_HIT_LIMIT,
  KNOWLEDGE_TOTAL_HIT_LIMIT,
  isGarbledExtractText
} from '@baishou/shared'
import type { ToolKnowledgeSearchHit } from '@baishou/shared'

export function usableKnowledgeSearchHits(
  hits: ToolKnowledgeSearchHit[]
): ToolKnowledgeSearchHit[] {
  return hits.filter((hit) => !isGarbledExtractText(hit.chunkText || ''))
}

function locationOf(hit: ToolKnowledgeSearchHit): string {
  return hit.offset != null ? `偏移 ${hit.offset}` : `片段 #${hit.chunkIndex}`
}

function notebookLabel(hit: ToolKnowledgeSearchHit): string {
  return hit.notebookName?.trim() || hit.notebookId
}

export function takeGroupedKnowledgeHits(
  hits: ToolKnowledgeSearchHit[],
  options?: { perNotebook?: number; total?: number }
): ToolKnowledgeSearchHit[] {
  const perNotebook = options?.perNotebook ?? KNOWLEDGE_PER_NOTEBOOK_HIT_LIMIT
  const total = options?.total ?? KNOWLEDGE_TOTAL_HIT_LIMIT
  const taken: ToolKnowledgeSearchHit[] = []
  const countByNotebook = new Map<string, number>()
  for (const hit of usableKnowledgeSearchHits(hits)) {
    const used = countByNotebook.get(hit.notebookId) ?? 0
    if (used >= perNotebook) continue
    taken.push(hit)
    countByNotebook.set(hit.notebookId, used + 1)
    if (taken.length >= total) break
  }
  return taken
}

export function formatKnowledgeSearchHits(
  query: string,
  hits: ToolKnowledgeSearchHit[]
): string {
  const usable = takeGroupedKnowledgeHits(hits)
  if (usable.length === 0) {
    if (hits.length > 0) {
      return (
        `笔记本里找到了与「${query}」相关的片段，但文本层已损坏，不能作为引用。` +
        '请对该来源使用视觉提取后再提问，不要编造正文。'
      )
    }
    return `笔记本里没有找到与「${query}」匹配的片段。不要编造资料内容。`
  }

  const groups = new Map<string, ToolKnowledgeSearchHit[]>()
  for (const hit of usable) {
    const key = notebookLabel(hit)
    const list = groups.get(key) ?? []
    list.push(hit)
    groups.set(key, list)
  }

  const blocks: string[] = [
    `## 知识库检索`,
    `查询：${query}`,
    `可用片段 ${usable.length} 条`
  ]
  let index = 1
  for (const [name, group] of groups) {
    blocks.push(`### ${name}`)
    for (const hit of group) {
      const title = hit.title?.trim() || hit.sourceId.slice(0, 8)
      const excerpt = hit.chunkText.replace(/\s+/g, ' ').trim().slice(0, 400)
      blocks.push(`[${index}] ${name} · ${title}（${locationOf(hit)}）\n${excerpt}`)
      index += 1
    }
  }
  return blocks.join('\n\n')
}

export function citationsFromKnowledgeHits(hits: ToolKnowledgeSearchHit[]): Array<{
  notebookId: string
  notebookName: string
  sourceId: string
  title: string
  excerpt: string
  page?: number
  offset?: number
  chunkIndex?: number
}> {
  return takeGroupedKnowledgeHits(hits).map((hit) => ({
    notebookId: hit.notebookId,
    notebookName: notebookLabel(hit),
    sourceId: hit.sourceId,
    title: hit.title?.trim() || hit.sourceId,
    excerpt: hit.chunkText.replace(/\s+/g, ' ').trim().slice(0, 240),
    page: hit.page,
    offset: hit.offset,
    chunkIndex: hit.chunkIndex
  }))
}
