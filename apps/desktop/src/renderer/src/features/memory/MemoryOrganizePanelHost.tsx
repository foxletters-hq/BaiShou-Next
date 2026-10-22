import React, { useCallback, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { RagMemoryOrganizeModal, useDialog } from '@baishou/ui'
import {
  firstActivePhase,
  pendingOrganizeArticleCount,
  phaseCountsFromPending
} from '@baishou/shared'
import { shouldWaitForGraphExtract } from './organize-pipeline-waiting.util'
import { useMemoryReadiness } from './useMemoryReadiness'
import {
  getRagRuntimeSnapshot,
  patchCachedRagActiveState,
  subscribeRagRuntime
} from '../settings/rag-runtime-cache'

export function MemoryOrganizePanelHost(props: {
  open: boolean
  onClose: () => void
  onContinue?: () => void
}) {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const readiness = useMemoryReadiness()
  const ragState = useSyncExternalStore(
    subscribeRagRuntime,
    () => getRagRuntimeSnapshot().activeRagState
  )

  const onPauseBatchEmbed = useCallback(async () => {
    patchCachedRagActiveState({ paused: true, cancelling: false })
    await (
      window as { api?: { rag?: { pauseBatchEmbed?: () => Promise<void> } } }
    ).api?.rag?.pauseBatchEmbed?.()
  }, [])

  const onResumeBatchEmbed = useCallback(async () => {
    patchCachedRagActiveState({ paused: false, cancelling: false })
    await (
      window as { api?: { rag?: { resumeBatchEmbed?: () => Promise<void> } } }
    ).api?.rag?.resumeBatchEmbed?.()
  }, [])

  const onCancelBatchEmbed = useCallback(async () => {
    const ok = await confirm(
      t(
        'settings.rag_batch_embed_cancel_confirm',
        '取消后将停止尚未开始的嵌入，已经写入的向量会保留。确定取消？'
      ),
      t('common.warning', '警告')
    )
    if (!ok) return
    patchCachedRagActiveState({ cancelling: true, paused: false })
    await (
      window as { api?: { rag?: { cancelBatchEmbed?: () => Promise<void> } } }
    ).api?.rag?.cancelBatchEmbed?.()
  }, [confirm, t])

  const leftoverCount = pendingOrganizeArticleCount({
    pendingEmbedCount: readiness.pendingEmbedCount,
    pendingGraphCount: readiness.pendingGraphCount,
    pendingDiaryCount: readiness.pendingEmbedParts.diaries
  })
  const running =
    (ragState.isRunning && ragState.type === 'batchEmbed') ||
    Boolean(readiness.graphExtracting && readiness.graphExtracting.total > 0) ||
    Boolean(readiness.indexing)
  const leftover = (leftoverCount > 0 || Boolean(ragState.error)) && !running
  const leftoverState = leftover
    ? {
        ...ragState,
        isRunning: false,
        type: 'idle' as const,
        progress: 0,
        total: Math.max(leftoverCount, 1),
        statusText: '',
        error: ragState.error,
        phase: firstActivePhase({
          ...readiness.pendingEmbedParts,
          graphExtract: readiness.pendingGraphCount
        }),
        phases: phaseCountsFromPending({
          ...readiness.pendingEmbedParts,
          graphExtract: readiness.pendingGraphCount
        }),
        paused: false,
        cancelling: false
      }
    : ragState

  return (
    <RagMemoryOrganizeModal
      open={props.open}
      onClose={props.onClose}
      ragState={leftoverState}
      onPauseBatchEmbed={onPauseBatchEmbed}
      onResumeBatchEmbed={onResumeBatchEmbed}
      onCancelBatchEmbed={onCancelBatchEmbed}
      graphExtract={readiness.graphExtracting}
      graphExtractWaiting={shouldWaitForGraphExtract({
        organizePipeline: readiness.organizePipeline,
        indexing: Boolean(readiness.indexing)
      })}
      pendingGraphCount={readiness.pendingGraphCount}
      incomplete={leftover}
      onContinue={props.onContinue}
    />
  )
}
