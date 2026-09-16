import type { PendingEmbedCounts } from '@baishou/shared'

export type PendingEmbedPartLine = {
  key: string
  fallback: string
  count: number
}

/** 开始整理菜单里的分项：日记 / 伙伴 / 节点 / 知识库 / 关系图谱。 */
export function listPendingEmbedPartLines(
  parts: PendingEmbedCounts,
  pendingGraphCount: number
): PendingEmbedPartLine[] {
  return [
    {
      key: 'memory.pending_embed_part_diaries',
      fallback: '日记 {{count}} 篇',
      count: parts.diaries
    },
    {
      key: 'memory.pending_embed_part_memories',
      fallback: '伙伴记忆 {{count}} 条',
      count: parts.memories
    },
    {
      key: 'memory.pending_embed_part_graph_nodes',
      fallback: '图谱节点 {{count}} 个',
      count: parts.graphNodes
    },
    {
      key: 'memory.pending_embed_part_knowledge',
      fallback: '知识库 {{count}} 份',
      count: parts.knowledgeSources
    },
    {
      key: 'memory.pending_embed_part_graph_extract',
      fallback: '关系图谱 {{count}} 篇',
      count: pendingGraphCount
    }
  ]
}
