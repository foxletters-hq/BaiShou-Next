/**
 * knowledge_search — read-only notebook RAG for workspace / companion.
 * No Gate metadata (read-only); must be whitelisted for workspace sessions.
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import { formatKnowledgeSearchHits } from './knowledge-search-result.util'
import { resolveKnowledgeToolNotebookId } from './knowledge-tool-scope.util'

const params = z.object({
  query: z.string().describe('Search query against the mounted knowledge notebook.'),
  notebookId: z
    .string()
    .optional()
    .describe(
      'Notebook id to search only when no notebook is already bound. A bound notebook always wins and this value is ignored.'
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Max number of chunks to return (default 8).')
})

export class KnowledgeSearchTool extends AgentTool<typeof params> {
  readonly name = 'knowledge_search'

  readonly description =
    'Search the current knowledge notebook (vector + full-text) for source excerpts.\n\n' +
    'Call this when the user asks about imported documents or you need passages before answering.\n' +
    'Do not call this for greetings or small talk.\n' +
    'If a notebook is already bound in this conversation, omit notebookId; a bound id always wins.\n' +
    'In a workspace session, a notebook must be mounted first; args.notebookId cannot bypass that. ' +
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

    const scoped = resolveKnowledgeToolNotebookId(context, args.notebookId)
    if (scoped.error) return scoped.error
    const notebookId = scoped.notebookId

    const reader = context.knowledgeReader
    if (!reader) {
      return '知识库检索当前不可用。这一轮不要再调用该工具，也不要编造资料内容。'
    }

    try {
      const hits = await reader.search({
        query,
        notebookId,
        limit: args.limit ?? 8
      })
      return formatKnowledgeSearchHits(query, hits)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return `知识库检索失败：${message}。同一查询不要再调用该工具。`
    }
  }
}
