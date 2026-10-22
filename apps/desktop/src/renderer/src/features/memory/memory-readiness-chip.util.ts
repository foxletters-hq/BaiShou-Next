type Translate = (key: string, fallback: string, options?: Record<string, unknown>) => string

export type VectorPendingChipInput = {
  /** 向量/嵌入待整理篇数 */
  embedPending: number
  /** 关系图谱待抽取篇数 */
  pendingGraphCount: number
}

/**
 * 向量片段一栏的待办文案：只有图谱待整理时也要显示篇数，
 * 不能再拿「向量待整理 0 篇」冒充状态。
 */
export function formatVectorPendingValue(input: VectorPendingChipInput, t: Translate): string {
  const embedPending = Math.max(0, Math.floor(input.embedPending || 0))
  const pendingGraph = Math.max(0, Math.floor(input.pendingGraphCount || 0))
  if (embedPending > 0 && pendingGraph > 0) {
    return t(
      'memory.readiness_vector_and_graph_pending',
      '未整理 {{count}} 篇 · 图谱 {{graph}} 篇',
      { count: embedPending, graph: pendingGraph }
    )
  }
  if (pendingGraph > 0) {
    return t('memory.readiness_graph_pending', '待整理 {{count}} 篇', { count: pendingGraph })
  }
  return t('memory.readiness_vector_pending', '未整理 {{count}} 篇', { count: embedPending })
}
