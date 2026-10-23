/**
 * 整理横幅的公共入口。
 * 具体计算按职责拆到 types / jobs / phases / detail 四个文件，这里保留原有导出路径。
 */
export type {
  KnowledgeOrganizeDetailSource,
  KnowledgeOrganizeJobItem,
  KnowledgeOrganizePhaseId,
  KnowledgeOrganizePhaseRow,
  KnowledgeOrganizePhaseStatus,
  KnowledgeOrganizeProcessLine,
  KnowledgeOrganizeProgress,
  KnowledgeOrganizeTaskAction
} from './knowledge-organize.types'
export {
  createLatestThrottled,
  knowledgeOrganizeProgressPercent,
  knowledgeOrganizeSourceCount,
  mergeKnowledgeOrganizeJobProgress,
  overlayOrganizeJobsLiveStatus
} from './knowledge-organize-jobs.util'
export {
  knowledgeOrganizeCurrentPhase,
  knowledgeOrganizeRestartTarget,
  knowledgeOrganizeSourcePhases,
  knowledgeOrganizeTaskActions
} from './knowledge-organize-phases.util'
export {
  knowledgeOrganizeBannerProgress,
  knowledgeOrganizeDetailSources,
  knowledgeOrganizeFailedMessage,
  knowledgeOrganizeProcessLines,
  knowledgeOrganizeRememberedTotal
} from './knowledge-organize-detail.util'

export function knowledgeOrganizeBannerKind(input: {
  watching?: boolean
  ingestingCount: number
  pendingJobs: number
  graphJobItems: Array<{ status: string }>
  ocrProgressBySource: Record<string, { page: number; total: number; phase?: string }>
  ingestJobItems?: Array<{ status: string }>
}): 'running' | 'failed' | 'paused' | 'idle' {
  const jobs = [...input.graphJobItems, ...(input.ingestJobItems ?? [])]
  const hasLiveJobs = jobs.some((item) => item.status === 'running')
  const hasQueuedJobs = jobs.some((item) => item.status === 'pending' || item.status === 'running')
  const hasFailedJobs = jobs.some((item) => item.status === 'failed')
  const leftoverBusy = input.ingestingCount > 0 || hasQueuedJobs || input.pendingJobs > 0
  if (hasLiveJobs) return 'running'
  if (input.watching && leftoverBusy) return 'running'
  if (hasFailedJobs) return 'failed'
  if (leftoverBusy) return 'paused'
  return 'idle'
}
