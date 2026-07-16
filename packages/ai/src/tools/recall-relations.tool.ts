/**
 * recall_relations — read-only GraphRAG for companion narrative.
 */

import { z } from 'zod'
import { AgentTool } from './agent.tool'
import type { ToolContext } from './agent.tool'

const params = z.object({
  entity: z.string().describe('Person, place, topic, or other entity name to recall relations for.'),
  mode: z
    .enum(['network', 'timeline'])
    .optional()
    .describe('network = 1–2 hop neighborhood; timeline = relations ordered by validFrom.')
})

export class RecallRelationsTool extends AgentTool<typeof params> {
  readonly name = 'recall_relations'

  readonly description =
    'Recall people/places/events and their relations from the user memory graph. ' +
    'Use for explaining connections or timelines grounded in diary sourceRef excerpts. ' +
    'Read-only; does not modify the graph.'

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
      return '图谱读取器未就绪。请先在图管理页抽取日记，或检查 Vault / 索引是否已灌入。'
    }

    const mode = args.mode ?? 'network'
    try {
      const result = await reader.recallRelations({ entity, mode })
      if (!result.anchors.length) {
        return `未找到与「${entity}」相关的图谱实体。可先在图管理页梳理待重抽日记。`
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
    } catch (e) {
      return `回忆关系失败: ${e instanceof Error ? e.message : String(e)}`
    }
  }
}
