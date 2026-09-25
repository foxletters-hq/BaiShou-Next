export function knowledgeSourceShowsPendingOrganizeHelp(status: string): boolean {
  return status === 'stored'
}

/** 资料库状态只覆盖提取/嵌入；图谱任务另算，不能把还在抽图的资料写成就绪。 */
export function knowledgeSourceDisplayStatus(
  sourceStatus: string,
  graphJobStatus?: string | null
): string {
  const graph = graphJobStatus?.trim() || ''
  if (sourceStatus !== 'ready' && sourceStatus !== 'partial') return sourceStatus
  if (graph === 'running') return 'graph_organizing'
  if (graph === 'pending') return 'graph_queued'
  if (graph === 'failed') return 'graph_failed'
  return sourceStatus
}
