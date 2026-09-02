/**
 * knowledge_search — read-only notebook RAG for workspace / companion.
 * No Gate metadata (read-only); must be whitelisted for workspace sessions.
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import {
  citationsFromKnowledgeHits,
  formatKnowledgeSearchHits
} from './knowledge-search-result.util'
import { resolveKnowledgeToolNotebookIds } from './knowledge-tool-scope.util'

const params = z.object({
  query: z.string().describe('Search query against the mounted knowledge notebooks.'),
  notebookId: z
    .string()
    .optional()
    .describe(
      'Optional notebook id that must already be mounted. Omit to search all mounted notebooks.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Max number of chunks to return across mounted notebooks (default 8).')
})

export class KnowledgeSearchTool extends AgentTool<typeof params> {
  readonly name = 'knowledge_search'

  readonly description =
    'Search mounted knowledge notebooks (vector + full-text) for source excerpts.\n\n' +
    'Call this when the user asks about imported documents or you need passages before answering.\n' +
    'Do not call this for greetings or small talk.\n' +
    'If notebooks are mounted, omit notebookId to search all of them. ' +
    'A notebookId argument is only accepted when that id is already mounted. ' +
    'Read-only; does not modify notebooks or sources.'

  readonly parameters = params

  get category(): string {
    return 'knowledge'
  }

  get icon(): string {
    return 'book-open'
  }

  get displayName(): string {
    return '检索知识库笔记本'
  }

  async execute(args: z.infer<typeof params>, context: ToolContext): Promise<string> {
    const query = args.query.trim()
    if (!query) return '请提供 query（检索问题）。'

    const scoped = resolveKnowledgeToolNotebookIds(context, args.notebookId)
    if (scoped.error) return scoped.error

    const reader = context.knowledgeReader
    if (!reader) {
      return '知识库检索当前不可用。这一轮不要再调用该工具，也不要编造资料内容。'
    }

    try {
      const hits = await reader.search({
        query,
        notebookIds: scoped.notebookIds,
        limit: args.limit ?? 8
      })
      return JSON.stringify({
        text: formatKnowledgeSearchHits(query, hits),
        citations: citationsFromKnowledgeHits(hits)
      })
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return `知识库检索失败：${message}。同一查询不要再调用该工具。`
    }
  }
}
