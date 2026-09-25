import React, { useCallback, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { RagMemoryOrganizeModal, useDialog } from '@baishou/ui'
import { shouldWaitForGraphExtract } from './organize-pipeline-waiting.util'
import { useMemoryReadiness } from './useMemoryReadiness'
import {
  getRagRuntimeSnapshot,
  patchCachedRagActiveState,
  subscribeRagRuntime
} from '../settings/rag-runtime-cache'

export function MemoryOrganizePanelHost(props: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { confirm } = useDialog()
  const readiness = useMemoryReadiness()
  const ragState = useSyncExternalStore(
    subscribeRagRuntime,
    () => getRagRuntimeSnapshot().activeRagState
  )

  const onPauseBatchEmbed = useCallback(async () => {
    patchCachedRagActiveState({ paused: true, cancelling: false })
    await (window as { api?: { rag?: { pauseBatchEmbed?: () => Promise<void> } } }).api?.rag
      ?.pauseBatchEmbed?.()
  }, [])

  const onResumeBatchEmbed = useCallback(async () => {
    patchCachedRagActiveState({ paused: false, cancelling: false })
    await (window as { api?: { rag?: { resumeBatchEmbed?: () => Promise<void> } } }).api?.rag
      ?.resumeBatchEmbed?.()
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
    await (window as { api?: { rag?: { cancelBatchEmbed?: () => Promise<void> } } }).api?.rag
      ?.cancelBatchEmbed?.()
  }, [confirm, t])

  return (
    <RagMemoryOrganizeModal
      open={props.open}
      onClose={props.onClose}
      ragState={ragState}
      onPauseBatchEmbed={onPauseBatchEmbed}
      onResumeBatchEmbed={onResumeBatchEmbed}
      onCancelBatchEmbed={onCancelBatchEmbed}
      graphExtract={readiness.graphExtracting}
      graphExtractWaiting={shouldWaitForGraphExtract({
        organizePipeline: readiness.organizePipeline,
        indexing: Boolean(readiness.indexing)
      })}
      pendingGraphCount={readiness.pendingGraphCount}
    />
  )
}
