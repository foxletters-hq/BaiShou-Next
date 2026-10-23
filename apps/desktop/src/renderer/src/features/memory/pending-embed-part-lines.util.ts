import type { PendingEmbedCounts } from '@baishou/shared'

export type PendingEmbedPartLine = {
  key: string
  count: number
}

/** 开始整理菜单里的分项：日记 / 伙伴记忆 / 日记图谱节点 / 日记抽图。 */
export function listPendingEmbedPartLines(
  parts: PendingEmbedCounts,
  pendingGraphCount: number
): PendingEmbedPartLine[] {
  return [
    {
      key: 'memory.pending_embed_part_diaries',
      count: parts.diaries
    },
    {
      key: 'memory.pending_embed_part_memories',
      count: parts.memories
    },
    {
      key: 'memory.pending_embed_part_graph_nodes',
      count: parts.graphNodes
    },
    {
      key: 'memory.pending_embed_part_graph_extract',
      count: pendingGraphCount
    }
  ]
}
