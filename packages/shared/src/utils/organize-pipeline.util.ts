import type { PendingEmbedCounts } from './pending-embed-count.util'
import {
  RAG_BATCH_EMBED_PHASE_IDS,
  type RagBatchEmbedPhaseId
} from './rag-batch-embed-progress.util'

/** 整理流水的待办快照：嵌入四类 + 笔记本图节点 + 抽图。 */
export type OrganizePendingInput = Pick<
  PendingEmbedCounts,
  'diaries' | 'memories' | 'graphNodes' | 'knowledgeSources'
> & {
  notebookGraphNodes?: number
  graphExtract?: number
}

export function graphNodePhaseTotal(input: OrganizePendingInput): number {
  return Math.max(0, input.graphNodes) + Math.max(0, input.notebookGraphNodes ?? 0)
}

/**
 * 按固定顺序列出仍有待办的阶段。已清空的阶段不会出现，因此中断后续跑会从第一个仍有待办的阶段开始。
 */
export function listRunnableOrganizePhases(input: OrganizePendingInput): RagBatchEmbedPhaseId[] {
  const ids: RagBatchEmbedPhaseId[] = []
  if (input.diaries > 0) ids.push('diary')
  if (input.memories > 0) ids.push('memory')
  if (graphNodePhaseTotal(input) > 0) ids.push('graph_node')
  if (input.knowledgeSources > 0) ids.push('knowledge')
  if ((input.graphExtract ?? 0) > 0) ids.push('graph_extract')
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
  return RAG_BATCH_EMBED_PHASE_IDS
}
