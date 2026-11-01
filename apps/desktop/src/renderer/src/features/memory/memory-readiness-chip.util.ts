import type { PendingEmbedCounts } from '@baishou/shared'

type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string

export type VectorPendingChipInput = {
  /** 向量/嵌入待整理合计（日记 + 伙伴记忆 + 图谱节点向量） */
  embedPending: number
  /** 关系图谱待抽取篇数 */
  pendingGraphCount: number
  /** 待嵌入分项；传入时「篇」只统计日记，其余分项按各自单位展示 */
  parts?: PendingEmbedCounts
}

function nonNegative(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(value))
}

/**
 * 向量片段一栏的待办文案：只有图谱待整理时也要显示篇数，
 * 不能再拿「向量待整理 0 篇」冒充状态。
 * 「篇」只用于日记；只剩伙伴记忆或图谱节点向量时按实际单位展示，避免把一条记忆说成一篇。
 */
export function formatVectorPendingValue(input: VectorPendingChipInput, t: Translate): string {
  const embedPending = nonNegative(input.embedPending)
  const pendingGraph = nonNegative(input.pendingGraphCount)
  const diaryPending = input.parts ? nonNegative(input.parts.diaries) : embedPending
  if (diaryPending > 0 && pendingGraph > 0) {
    return t(
      'memory.readiness_vector_and_graph_pending',
      '未整理 {{count}} 篇 · 图谱 {{graph}} 篇',
      { count: diaryPending, graph: pendingGraph }
    )
  }
  if (pendingGraph > 0) {
    return t('memory.readiness_graph_pending', '待整理 {{count}} 篇', { count: pendingGraph })
  }
  if (diaryPending > 0 || !input.parts) {
    return t('memory.readiness_vector_pending', '未整理 {{count}} 篇', { count: diaryPending })
  }
  const otherParts = [
    {
      key: 'memory.pending_embed_part_memories',
      fallback: '伙伴记忆 {{count}} 条',
      count: nonNegative(input.parts.memories)
    },
    {
      key: 'memory.pending_embed_part_graph_nodes',
      fallback: '图谱节点向量 {{count}} 个',
      count: nonNegative(input.parts.graphNodes)
    }
  ].filter((part) => part.count > 0)
  if (otherParts.length === 0) {
    return t('memory.readiness_vector_pending', '未整理 {{count}} 篇', { count: embedPending })
  }
  return otherParts.map((part) => t(part.key, part.fallback, { count: part.count })).join(' · ')
}
