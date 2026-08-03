/**
 * recall_relations — read-only GraphRAG for companion narrative.
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const params = z.object({
  entity: z
    .string()
    .describe('Person, place, topic, or other entity name to recall relations for.'),
  mode: z
    .enum(['network', 'timeline'])
    .optional()
    .describe('network = 1–2 hop neighborhood; timeline = relations ordered by validFrom.')
})

export class RecallRelationsTool extends AgentTool<typeof params> {
  readonly name = 'recall_relations'

  readonly description =
    'Recall how people, places, and events in the user\'s life connect to each other.\n\n' +
    'Call this when:\n' +
    '- the user refers to a past event, person, or place assuming you already know it\n' +
    '  ("那家店", "上次和他一起", "毕业旅行的时候")\n' +
    '- you want to mention a connection between two things the user has told you about\n' +
    '- the user asks why/how two things are related\n\n' +
    'Returns relation paths with excerpts from the original diary entries, so you can ' +
    'say where you know it from. Read-only; does not modify the graph.'

  readonly parameters = params

  get category(): string {
    return 'memory'
  }

  get icon(): string {
    return 'share-2'
  }

  get displayName(): string {
    return '回忆关系图谱'
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
      const result = await reader.recallRelations({ entity, mode })
      if (!result.anchors.length) {
        return (
          `No graph entity found for「${entity}」. Do not retry this tool for the same entity in this conversation. ` +
          'If relations are needed, the user can organize people and events from diary entries ' +
          '(save hint or diary list "尚未整理"); continue the chat without inventing connections.'
        )
      }

      const anchorLines = result.anchors
        .slice(0, 5)
        .map((a) => `- ${a.name} (${a.nodeType})${a.summary ? `: ${a.summary}` : ''}`)
        .join('\n')

      const edgeSource = mode === 'timeline' ? result.timeline || result.subgraph : result.subgraph
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
        mode === 'timeline' ? `## 关系时间线` : `## 邻域关系`,
        edgeLines || '(无边)',
        `节点 ${result.nodes.length} · 边 ${edgeSource.length}`
      ].join('\n')
    } catch {
      return (
        'The memory graph could not be read right now. Do not call this tool again in this conversation. ' +
        'Continue without graph context.'
      )
    }
  }
}
