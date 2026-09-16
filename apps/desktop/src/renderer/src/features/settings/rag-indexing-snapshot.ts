import {
  currentPhaseProgress,
  ragBatchEmbedPhaseLabelKey,
  type RagBatchEmbedPhaseCounts,
  type RagBatchEmbedPhaseKind
} from '@baishou/shared'
import type { RagRuntimeActiveState } from './rag-runtime-cache'

export type RagIndexingSnapshot = {
  progress: number
  total: number
  statusText?: string
  phase?: RagBatchEmbedPhaseKind
  phases?: RagBatchEmbedPhaseCounts
  paused?: boolean
  cancelling?: boolean
}

export function ragIndexingSnapshotFromState(
  state: RagRuntimeActiveState
): RagIndexingSnapshot | null {
  if (!state.isRunning || state.type !== 'batchEmbed') return null
  return {
    progress: state.progress,
    total: state.total,
    statusText: state.statusText,
    phase: state.phase,
    phases: state.phases,
    paused: state.paused,
    cancelling: state.cancelling
  }
}

export function formatRagIndexingStatus(
  t: (key: string, fallback: string, options?: Record<string, string | number>) => string,
  indexing: RagIndexingSnapshot
): string {
  if (indexing.cancelling) {
    return t('settings.rag_batch_embed_cancelling', '正在取消索引…')
  }
  if (indexing.phase === 'starting' && !indexing.paused) {
    return t('settings.rag_batch_embed_starting', '正在开始索引…')
  }
  if (indexing.phase === 'finishing') {
    return t('settings.rag_batch_embed_finishing', '正在完成索引…')
  }
  const current = currentPhaseProgress(indexing.phase, indexing.phases)
  if (current) {
    const kind = t(ragBatchEmbedPhaseLabelKey(current.id), current.id)
    if (indexing.paused) {
      return t('diary.status_indexing_paused_kind', '已暂停 · 正在嵌入{{kind}} {{progress}}/{{total}}', {
        kind,
        progress: current.completed,
        total: current.total
      })
    }
    return t('diary.status_indexing_kind', '正在嵌入{{kind}} {{progress}}/{{total}}', {
      kind,
      progress: current.completed,
      total: current.total
    })
  }
  if (indexing.paused) {
    return t('settings.rag_batch_embed_paused', '索引已暂停')
  }
  return t('diary.status_indexing', '正在索引 {{progress}}/{{total}}', {
    progress: indexing.progress,
    total: indexing.total
  })
}
