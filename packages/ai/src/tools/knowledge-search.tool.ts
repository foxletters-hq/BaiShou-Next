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
      'Notebook id to search (companion sessions only). Workspace sessions always use the mounted notebook and ignore this.'
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

    const attached = context.workspace?.notebookId?.trim() || ''
    const isWorkspace = context.workspace?.sessionKind === 'workspace'

    let notebookId = ''
    if (isWorkspace) {
      // 工作台：必须已挂载；禁止 args.notebookId 绕过
      if (!attached) {
        return (
          '工作台尚未挂载知识库笔记本，拒绝检索。' +
          '请先在工作台挂载笔记本；不可通过 notebookId 参数绕过。'
        )
      }
      notebookId = attached
    } else {
      notebookId = args.notebookId?.trim() || attached
      if (!notebookId) {
        return (
          'No knowledge notebook is attached and notebookId was not provided. ' +
          'Attach a notebook or pass notebookId explicitly. ' +
          'Do not invent document contents.'
        )
      }
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
