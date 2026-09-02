/**
 * knowledge_graph_search — read-only notebook graph for workspace / companion.
 * Isolated from recall_relations (life graph). Sessions must mount notebooks.
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'
import { resolveKnowledgeToolNotebookIds } from './knowledge-tool-scope.util'

const params = z.object({
  query: z.string().describe('Entity or topic to look up in the mounted knowledge notebook graphs.'),
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
    .describe('Max number of matching nodes to consider per notebook (default 8).')
})

export class KnowledgeGraphSearchTool extends AgentTool<typeof params> {
  readonly name = 'knowledge_graph_search'

  readonly description =
    'Search relations extracted from imported sources in the mounted knowledge notebooks.\n\n' +
    'Call this when the user asks how people, orgs, or topics in the notebooks connect.\n' +
    'Do not call this for greetings or when you only need raw passages (use knowledge_search).\n' +
    'If notebooks are mounted, omit notebookId to search all of them. ' +
    'A notebookId argument is only accepted when that id is already mounted. ' +
    'Entities with the same name in different notebooks are distinct; do not connect them. ' +
    'This is not the life graph. Read-only.'

  readonly parameters = params

  get category(): string {
    return 'knowledge'
  }

  get icon(): string {
    return 'share-2'
  }

  get displayName(): string {
    return '检索笔记本内关系'
  }

  async execute(args: z.infer<typeof params>, context: ToolContext): Promise<string> {
    const query = args.query.trim()
    if (!query) return '请提供 query（实体或主题）。'

    const scoped = resolveKnowledgeToolNotebookIds(context, args.notebookId)
    if (scoped.error) return scoped.error.replace('拒绝检索。', '拒绝检索图谱。')

    const reader = context.knowledgeGraphReader
    if (!reader) {
      return '笔记本关系检索当前不可用。这一轮不要再调用该工具，也不要编造实体关系。'
    }

    try {
      const groups = await reader.search({
        query,
        notebookIds: scoped.notebookIds,
        limit: args.limit ?? 8
      })
      const nonempty = groups.filter((group) => group.nodes.length > 0)
      if (nonempty.length === 0) {
        return `笔记本关系图里没有找到与「${query}」匹配的实体。不要编造关系；需要原文时改用 knowledge_search。`
      }

      const blocks: string[] = ['## 笔记本关系检索', `查询：${query}`]
      let nodeTotal = 0
      let edgeTotal = 0
      for (const result of nonempty) {
        const label = result.notebookName?.trim() || result.notebookId || '笔记本'
        nodeTotal += result.nodes.length
        edgeTotal += result.edges.length
        const nodeLines = result.nodes.slice(0, 16).map((n) => {
          const summary = n.summary?.trim() ? `：${n.summary.trim().slice(0, 80)}` : ''
          return `- ${n.name}（${n.nodeType}）${summary}`
        })
        const nameById = new Map(result.nodes.map((n) => [n.id, n.name]))
        const edgeLines = result.edges.slice(0, 24).map((e) => {
          const from = nameById.get(e.fromId) || e.fromId.slice(0, 8)
          const to = nameById.get(e.toId) || e.toId.slice(0, 8)
          const excerpt = e.sourceExcerpt ? ` 「${e.sourceExcerpt.slice(0, 60)}」` : ''
          return `- ${from} —${e.edgeType}→ ${to}${excerpt}`
        })
        const pathLines =
          result.paths && result.paths.length > 0
            ? result.paths.slice(0, 8).map((p, i) => `${i + 1}. ${p.nodeNames.join(' → ')}`)
            : []
        blocks.push(
          `### ${label}`,
          '## 节点',
          ...nodeLines,
          '## 关系',
          ...(edgeLines.length ? edgeLines : ['（无边）']),
          ...(pathLines.length ? ['## 路径', ...pathLines] : [])
        )
      }
      blocks.push(`节点 ${nodeTotal} · 边 ${edgeTotal}（按本分组，跨本不连边）`)
      return blocks.join('\n')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e)
      return `笔记本关系检索失败：${message}。同一查询不要再调用该工具。`
    }
  }
}
