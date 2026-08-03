import type { KnowledgeSearchHit, KnowledgeSearchService } from './knowledge-search.service'

export interface KnowledgePageBoundary {
  page: number
  start: number
  end: number
}

export interface KnowledgeCitation {
  sourceId: string
  title: string
  chunkId: string
  chunkIndex: number
  excerpt: string
  /** L1：提取正文字符偏移 */
  offset?: number
  len?: number
  /** L2：有 pages.json 时反查页码 */
  page?: number
  score: number
  source: KnowledgeSearchHit['source']
}

export interface KnowledgeAskResult {
  answer: string
  citations: KnowledgeCitation[]
  hits: KnowledgeSearchHit[]
}

export interface KnowledgeAskDeps {
  search: KnowledgeSearchService
  embedQuery: (query: string) => Promise<number[] | null>
  generateAnswer: (input: {
    question: string
    contextBlocks: string
    citations: KnowledgeCitation[]
  }) => Promise<string>
  getSourceTitle?: (sourceId: string) => Promise<string | null> | string | null
  /** 读取 extracted/<sourceId>.pages.json */
  getPageBoundaries?: (
    notebookId: string,
    sourceId: string
  ) => Promise<KnowledgePageBoundary[] | null> | KnowledgePageBoundary[] | null
}

export interface KnowledgeAskOptions {
  notebookId: string
  question: string
  topK?: number
}

const DEFAULT_SYSTEM = `你是知识库问答助手。只根据提供的资料片段回答问题；若资料不足请明确说明。
回答时可用 [1]、[2] 标注引用编号，对应提供的资料列表。不要编造资料中没有的内容。`

/**
 * 从页边界表反查偏移所在页码（L2）。
 * 区间为 [start, end)；落在末页 end 上时仍归入该页。
 */
export function resolvePageForOffset(
  pages: KnowledgePageBoundary[] | null | undefined,
  offset: number | undefined
): number | undefined {
  if (offset == null || !pages?.length) return undefined
  for (const p of pages) {
    if (offset >= p.start && offset < p.end) return p.page
  }
  const last = pages[pages.length - 1]
  if (last && offset === last.end) return last.page
  return undefined
}

function excerptOf(text: string, max = 240): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/**
 * 知识库 Ask：单查询检索 → 拼上下文 → 生成回答 → 组装 L1/L2 引用。
 */
export class KnowledgeAskService {
  constructor(private readonly deps: KnowledgeAskDeps) {}

  async ask(opts: KnowledgeAskOptions): Promise<KnowledgeAskResult> {
    const notebookId = opts.notebookId?.trim()
    if (!notebookId) throw new Error('knowledge ask requires notebookId')
    const question = opts.question?.trim()
    if (!question) throw new Error('knowledge ask requires question')

    const queryVector = await this.deps.embedQuery(question)
    if (!queryVector?.length) {
      throw new Error('embedding-not-configured')
    }

    const hits = await this.deps.search.search({
      notebookId,
      query: question,
      queryVector,
      topK: opts.topK ?? 8
    })

    const citations = await this.buildCitations(notebookId, hits)
    const contextBlocks = citations
      .map((c, i) => {
        const loc =
          c.page != null
            ? `第 ${c.page} 页`
            : c.offset != null
              ? `偏移 ${c.offset}`
              : `片段 #${c.chunkIndex}`
        return `[${i + 1}] ${c.title}（${loc}）\n${c.excerpt}`
      })
      .join('\n\n')

    const answer =
      citations.length === 0
        ? '当前笔记本里没有检索到相关资料，请先导入并等待索引完成后再提问。'
        : await this.deps.generateAnswer({ question, contextBlocks, citations })

    return { answer, citations, hits }
  }

  /** 供调用方拼 system/user prompt（桌面 IPC 可自行调用 generateText） */
  static buildPrompt(question: string, contextBlocks: string): { system: string; prompt: string } {
    return {
      system: DEFAULT_SYSTEM,
      prompt: `资料：\n${contextBlocks || '（无）'}\n\n问题：${question}\n\n请作答：`
    }
  }

  private async buildCitations(
    notebookId: string,
    hits: KnowledgeSearchHit[]
  ): Promise<KnowledgeCitation[]> {
    const pageCache = new Map<string, KnowledgePageBoundary[] | null>()
    const citations: KnowledgeCitation[] = []

    for (const hit of hits) {
      let title = hit.title
      if (!title && this.deps.getSourceTitle) {
        title = (await this.deps.getSourceTitle(hit.sourceId)) ?? undefined
      }

      let page: number | undefined
      if (hit.offset != null && this.deps.getPageBoundaries) {
        if (!pageCache.has(hit.sourceId)) {
          pageCache.set(
            hit.sourceId,
            (await this.deps.getPageBoundaries(notebookId, hit.sourceId)) ?? null
          )
        }
        page = resolvePageForOffset(pageCache.get(hit.sourceId), hit.offset)
      }

      citations.push({
        sourceId: hit.sourceId,
        title: title || hit.sourceId,
        chunkId: hit.chunkId,
        chunkIndex: hit.chunkIndex,
        excerpt: excerptOf(hit.chunkText),
        offset: hit.offset,
        len: hit.len,
        page,
        score: hit.score,
        source: hit.source
      })
    }

    return citations
  }
}
