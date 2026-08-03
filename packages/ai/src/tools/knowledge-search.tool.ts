/**
 * knowledge_search — read-only notebook RAG for workspace / companion.
 * No Gate metadata (read-only); must be whitelisted for workspace sessions.
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const params = z.object({
  query: z.string().describe('Search query against the mounted knowledge notebook.'),
  notebookId: z
    .string()
    .optional()
    .describe(
      'Notebook id to search. Defaults to the notebook attached to this workspace session. Required when no notebook is attached.'
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
    'Search the knowledge notebook (vector + full-text) for source excerpts.\n\n' +
    'Call this when:\n' +
    '- the user asks about imported documents / research notes in a notebook\n' +
    '- you need citations or passages before editing local files in the workspace\n\n' +
    'In a workspace session, search is scoped to the attached notebookId. ' +
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

    const attached = context.workspace?.notebookId?.trim() || ''
    const isWorkspace = context.workspace?.sessionKind === 'workspace'
    // 工作台：绑定 notebookId 强制过滤；伙伴：允许显式传入 notebookId
    const notebookId = isWorkspace && attached ? attached : args.notebookId?.trim() || attached
    if (!notebookId) {
      return (
        'No knowledge notebook is attached and notebookId was not provided. ' +
        'Attach a notebook to this workspace session, or pass notebookId explicitly. ' +
        'Do not invent document contents.'
      )
    }

    const reader = context.knowledgeReader
    if (!reader) {
      return (
        'The knowledge notebook search is not available yet. Do not call this tool again in this conversation. ' +
        'Continue without notebook excerpts.'
      )
    }

    try {
      const hits = await reader.search({
        query,
        notebookId,
        limit: args.limit ?? 8
      })
      if (!hits.length) {
        return (
          `No matching passages found in notebook「${notebookId}」for「${query}」. ` +
          'Do not invent contents; continue with what you already know or ask the user to import sources.'
        )
      }

      const lines = hits.map((h, i) => {
        const title = h.title?.trim() || h.sourceId.slice(0, 8)
        const excerpt = h.chunkText.replace(/\s+/g, ' ').trim().slice(0, 400)
        return (
          `${i + 1}. [${title}] chunk#${h.chunkIndex} score=${h.score.toFixed(3)}\n` +
          `   sourceId=${h.sourceId} chunkId=${h.chunkId}\n` +
          `   「${excerpt}」`
        )
      })

      return [
        `## Knowledge search (notebook=${notebookId})`,
        `Query: ${query}`,
        `Hits: ${hits.length}`,
        ...lines
      ].join('\n')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return (
        `Knowledge search failed: ${message}. Do not call this tool again for the same query in this conversation.`
      )
    }
  }
}
