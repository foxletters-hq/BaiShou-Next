import type { PendingEmbedCounts } from './pending-embed-count.util'
import {
  MEMORY_ORGANIZE_PHASE_IDS,
  type RagBatchEmbedPhaseId
} from './rag-batch-embed-progress.util'

/** 整理流水的待办快照：常规记忆嵌入 + 日记抽图 + 可疑节点扫描。笔记本欠账不进入这条流水。 */
export type OrganizePendingInput = Pick<
  PendingEmbedCounts,
  'diaries' | 'memories' | 'graphNodes' | 'knowledgeSources'
> & {
  notebookGraphNodes?: number
  graphExtract?: number
  graphDisambiguate?: number
}

export function graphNodePhaseTotal(input: OrganizePendingInput): number {
  return Math.max(0, input.graphNodes)
}

/**
 * 按固定顺序列出常规记忆仍有待办的阶段。笔记本向量/图不进入这条流水。
 */
export function listRunnableOrganizePhases(input: OrganizePendingInput): RagBatchEmbedPhaseId[] {
  const ids: RagBatchEmbedPhaseId[] = []
  if (input.diaries > 0) ids.push('diary')
  if (input.memories > 0) ids.push('memory')
  if ((input.graphExtract ?? 0) > 0) ids.push('graph_extract')
  if (graphNodePhaseTotal(input) > 0) ids.push('graph_node')
  if ((input.graphDisambiguate ?? 0) > 0) ids.push('graph_disambiguate')
  return ids
}

export async function runOrganizePhases(options: {
  input: OrganizePendingInput
  runPhase: (id: RagBatchEmbedPhaseId) => Promise<void>
  shouldContinue?: () => boolean | Promise<boolean>
}): Promise<{ ran: RagBatchEmbedPhaseId[]; abortedAt: RagBatchEmbedPhaseId | null }> {
  const ran: RagBatchEmbedPhaseId[] = []
  for (const id of listRunnableOrganizePhases(options.input)) {
    if (options.shouldContinue && !(await options.shouldContinue())) {
      return { ran, abortedAt: id }
    }
    await options.runPhase(id)
    ran.push(id)
  }
  return { ran, abortedAt: null }
}

export function organizePhaseOrder(): readonly RagBatchEmbedPhaseId[] {
  return MEMORY_ORGANIZE_PHASE_IDS
}
