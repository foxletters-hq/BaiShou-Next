/**
 * recall_relations — read-only GraphRAG for companion narrative.
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const params = z.object({
  entity: z
    .string()
    .describe(
      'Person, place, topic, or compound query (e.g. "小明和杭州") to look up in the memory graph.'
    ),
  mode: z
    .enum(['network', 'timeline', 'neighbors', 'search'])
    .optional()
    .describe(
      'search = find matching entities by name; neighbors = nearby nodes around the first match; ' +
        'network = shortest relation paths (default, 2–3 hops) with diary excerpts; ' +
        'timeline = relations ordered by validFrom.'
    ),
  node_type: z
    .enum(['person', 'place', 'organization', 'event', 'topic'])
    .optional()
    .describe('Optional type filter when searching or resolving the entity.'),
  depth: z
    .union([z.literal(1), z.literal(2), z.literal(3)])
    .optional()
    .describe('Hop cap for neighbors (default 1) or network paths (default 3).'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Max nodes or paths to return (default 12).')
})

export class RecallRelationsTool extends AgentTool<typeof params> {
  readonly name = 'recall_relations'

  readonly description =
    "Look up people, places, events and how they connect in the user's life graph (diary relations).\n\n" +
    'This is not the notebook graph — use knowledge_graph_search for relations inside a knowledge notebook.\n\n' +
    'Modes:\n' +
    '- search: list matching entities when you only have a name or type\n' +
    '- neighbors: who/what sits next to an entity (1 hop by default)\n' +
    '- network: shortest relation paths with diary excerpts (default)\n' +
    '- timeline: the same entity\'s relations ordered by time\n\n' +
    'Call this when the user refers to someone or somewhere as if you already know them, ' +
    'asks how two things relate, or you need to check who is already in the graph before writing. ' +
    'Read-only; approved relations only. Do not invent connections that are not returned.'

  readonly parameters = params

  get category(): string {
    return 'memory'
  }

  get icon(): string {
    return 'share-2'
  }

  get displayName(): string {
    return '回忆人生关系图'
  }

  async execute(args: z.infer<typeof params>, context: ToolContext): Promise<string> {
    const entity = args.entity.trim()
    if (!entity) return '请提供 entity（实体名）。'
    const reader = context.graphReader
    if (!reader) {
      return (
        'The memory graph is not available yet. Do not call this tool again in this conversation. ' +
        'Continue without graph context; the user can organize diary relations from the diary list later.'
      )
    }

    const mode = args.mode ?? 'network'
    try {
      const result = await reader.recallRelations({
        entity,
        mode,
        depth: args.depth,
        nodeType: args.node_type,
        limit: args.limit
      })
      if (!result.anchors.length) {
        return (
          `No graph entity found for「${entity}」. Do not retry this tool for the same entity in this conversation. ` +
          'If relations are needed, the user can organize people and events from diary entries ' +
          '(save hint or diary list "尚未整理"); continue the chat without inventing connections.'
        )
      }

      const anchorLines = result.anchors
        .slice(0, 8)
        .map((a) => `- ${a.name} (${a.nodeType})${a.summary ? `: ${a.summary}` : ''}`)
        .join('\n')

      if (mode === 'search') {
        const nodeLines = result.nodes
          .slice(0, args.limit ?? 12)
          .map((n) => `- ${n.name} (${n.nodeType})${n.summary ? `: ${n.summary}` : ''}`)
          .join('\n')
        return [`## 匹配实体`, nodeLines || anchorLines, `共 ${result.nodes.length} 个`].join('\n')
      }

      if (mode === 'neighbors') {
        const center = result.anchors[0]
        const edgeLines = result.subgraph
          .slice(0, 24)
          .map((e) => {
            const from = result.nodes.find((n) => n.id === e.fromId)?.name || e.fromId.slice(0, 8)
            const to = result.nodes.find((n) => n.id === e.toId)?.name || e.toId.slice(0, 8)
            const excerpt = e.sourceExcerpt ? ` 「${e.sourceExcerpt.slice(0, 80)}」` : ''
            return `- ${from} —${e.edgeType}→ ${to}${excerpt}`
          })
          .join('\n')
        return [
          `## 中心`,
          center ? `- ${center.name} (${center.nodeType})` : anchorLines,
          `## 邻居关系`,
          edgeLines || '(无邻居)',
          `节点 ${result.nodes.length} · 边 ${result.subgraph.length}`
        ].join('\n')
      }

      if (mode === 'timeline') {
        const edgeSource = result.timeline || result.subgraph
        const edgeLines = edgeSource
          .slice(0, 24)
          .map((e) => {
            const from = result.nodes.find((n) => n.id === e.fromId)?.name || e.fromId.slice(0, 8)
            const to = result.nodes.find((n) => n.id === e.toId)?.name || e.toId.slice(0, 8)
            const src = e.sourceRef ? ` [来源:${e.sourceRef}]` : ''
            const excerpt = e.sourceExcerpt ? ` 「${e.sourceExcerpt.slice(0, 80)}」` : ''
            return `- ${from} —${e.edgeType}→ ${to}${src}${excerpt}`
          })
          .join('\n')

        return [
          `## 锚点`,
          anchorLines,
          `## 关系时间线`,
          edgeLines || '(无边)',
          `节点 ${result.nodes.length} · 边 ${edgeSource.length}`
        ].join('\n')
      }

      const paths = result.paths ?? []
      const pathLines =
        paths.length > 0
          ? paths
              .slice(0, 12)
              .map((p, i) => {
                const chain = p.nodeNames.join(' → ')
                const excerpts = p.edges
                  .map((e, ei) => {
                    const dir = p.edgeDirections?.[ei] ?? 'forward'
                    const fromName =
                      result.nodes.find((n) => n.id === e.fromId)?.name || e.fromId.slice(0, 8)
                    const toName =
                      result.nodes.find((n) => n.id === e.toId)?.name || e.toId.slice(0, 8)
                    const label =
                      dir === 'reverse'
                        ? `${toName} ←${e.edgeType}— ${fromName}`
                        : `${fromName} —${e.edgeType}→ ${toName}`
                    const ex = e.sourceExcerpt
                      ? `「${e.sourceExcerpt.slice(0, 80)}」`
                      : e.sourceRef
                        ? `[${e.sourceRef}]`
                        : ''
                    return `  · ${label}${ex ? ` ${ex}` : ''}`
                  })
                  .join('\n')
                return `${i + 1}. ${chain}\n${excerpts || '  · (无摘录)'}`
              })
              .join('\n')
          : '(未找到连接路径)'

      return [
        `## 锚点`,
        anchorLines,
        `## 关系路径（最短，≤3 跳）`,
        pathLines,
        `路径 ${paths.length} · 节点 ${result.nodes.length}`
      ].join('\n')
    } catch {
      return (
        'The memory graph could not be read right now. Do not call this tool again in this conversation. ' +
        'Continue without graph context.'
      )
    }
  }
}
