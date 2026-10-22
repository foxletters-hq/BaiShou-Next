import React, { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { AppState } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { PendingEmbedCounts } from '@baishou/shared'
import { useDialog, type RagState } from '@baishou/ui/native'
import { useBaishou } from '@/src/providers/BaishouProvider'
import {
  getCachedMobileRagState,
  patchCachedMobileRagState,
  subscribeMobileRagRuntime
} from '@/src/services/mobile-rag-runtime-cache'
import { MemoryOrganizeDetailModal } from './MemoryOrganizeDetailModal'
import { MemoryOrganizeFab } from './MemoryOrganizeFab'
import { MemoryOrganizeProgressCard } from './MemoryOrganizeProgressCard'
import {
  memoryOrganizeCardKind,
  memoryOrganizePendingArticleCount,
  resolveMemoryOrganizeFabState,
  snapshotMemoryEmbedPhases
} from './memory-center-organize.util'
import {
  getCachedMemoryOrganizeInterrupted,
  readMemoryOrganizeInterrupted,
  subscribeMemoryOrganizeInterrupted,
  writeMemoryOrganizeInterrupted
} from './memory-center-organize.storage'

type OrganizePendingParts = PendingEmbedCounts & {
  graphExtract?: number
  graphDisambiguate?: number
}

function useMemoryOrganizeUi(input: {
  pendingEmbedParts: OrganizePendingParts
  pendingGraphCount: number
  organizeSnapshotReady: boolean
}) {
  const { t } = useTranslation()
  const ragState = useSyncExternalStore(
    subscribeMobileRagRuntime,
    getCachedMobileRagState,
    getCachedMobileRagState
  )
  const interrupted = useSyncExternalStore(
    subscribeMemoryOrganizeInterrupted,
    getCachedMemoryOrganizeInterrupted,
    getCachedMemoryOrganizeInterrupted
  )

  useEffect(() => {
    void readMemoryOrganizeInterrupted()
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void readMemoryOrganizeInterrupted()
      }
    })
    return () => sub.remove()
  }, [])

  const organizing = ragState.isRunning && ragState.type === 'batchEmbed'
  const isInterrupted = interrupted || Boolean(ragState.paused || ragState.cancelling)
  const pendingArticleCount = memoryOrganizePendingArticleCount({
    pendingEmbedCount: input.pendingEmbedParts.total,
    pendingGraphCount: input.pendingGraphCount,
    pendingDiaryCount: input.pendingEmbedParts.diaries
  })
  const organizeCardKind = memoryOrganizeCardKind({
    running: organizing,
    pendingCount: input.organizeSnapshotReady ? pendingArticleCount : 0,
    interrupted: isInterrupted,
    hasError: Boolean(ragState.error)
  })
  const leftoverSnapshot = snapshotMemoryEmbedPhases(
    input.pendingEmbedParts,
    input.pendingGraphCount
  )
  const leftoverRagState: RagState =
    organizeCardKind === 'incomplete'
      ? {
          ...ragState,
          isRunning: false,
          type: 'idle',
          progress: 0,
          total: Math.max(leftoverSnapshot.total, 1),
          error: ragState.error,
          // 未继续整理时不存在“正在跑”的阶段，统一按待整理展示
          phase: 'starting',
          phases: leftoverSnapshot.phases,
          paused: false,
          cancelling: false,
          statusText: t('memory.organize_incomplete', '整理未完成')
        }
      : ragState
  const organizeFab = resolveMemoryOrganizeFabState({
    snapshotReady: input.organizeSnapshotReady,
    pendingEmbedCount: input.pendingEmbedParts.total,
    pendingGraphCount: input.pendingGraphCount,
    pendingDiaryCount: input.pendingEmbedParts.diaries
  })
  return { leftoverRagState, organizeCardKind, organizeFab, pendingArticleCount }
}

export function MemoryOrganizeProgressHost(props: {
  pendingEmbedParts: OrganizePendingParts
  pendingGraphCount: number
  organizeSnapshotReady: boolean
  onStartOrganize: () => void
}) {
  const { t } = useTranslation()
  const dialog = useDialog()
  const { services } = useBaishou()
  const [detailOpen, setDetailOpen] = useState(false)
  const { leftoverRagState, organizeCardKind } = useMemoryOrganizeUi(props)

  const onViewDetails = useCallback(() => setDetailOpen(true), [])
  const onCloseDetails = useCallback(() => setDetailOpen(false), [])
  const onPause = useCallback(() => {
    void writeMemoryOrganizeInterrupted(true)
    services?.ragService.requestOperationPause()
    patchCachedMobileRagState({ paused: true, cancelling: false, isRunning: true })
  }, [services])
  const onResume = useCallback(() => {
    services?.ragService.requestOperationResume()
    patchCachedMobileRagState({ paused: false, cancelling: false, isRunning: true })
  }, [services])
  const onCancel = useCallback(() => {
    setDetailOpen(false)
    void dialog
      .confirm(
        t(
          'settings.rag_batch_embed_cancel_confirm',
          '取消后将停止尚未开始的嵌入，已经写入的向量会保留。确定取消？'
        ),
        { title: t('common.warning', '警告') }
      )
      .then((ok) => {
        if (!ok) {
          setDetailOpen(true)
          return
        }
        void writeMemoryOrganizeInterrupted(true)
        services?.ragService.requestOperationAbort()
        patchCachedMobileRagState({
          isRunning: false,
          type: 'idle',
          cancelling: false,
          paused: false,
          statusText: t('memory.organize_incomplete', '整理未完成')
        })
      })
  }, [dialog, services, t])

  if (organizeCardKind === 'hidden') return null

  return (
    <>
      <MemoryOrganizeProgressCard
        ragState={leftoverRagState}
        incomplete={organizeCardKind === 'incomplete'}
        onViewDetails={onViewDetails}
        onContinue={
          organizeCardKind === 'incomplete'
            ? () => {
                setDetailOpen(false)
                props.onStartOrganize()
              }
            : undefined
        }
      />
      {detailOpen ? (
        <MemoryOrganizeDetailModal
          visible
          ragState={leftoverRagState}
          incomplete={organizeCardKind === 'incomplete'}
          onClose={onCloseDetails}
          onPause={onPause}
          onResume={onResume}
          onCancel={onCancel}
          onContinue={props.onStartOrganize}
        />
      ) : null}
    </>
  )
}

export function MemoryOrganizeFabHost(props: {
  pendingEmbedParts: OrganizePendingParts
  pendingGraphCount: number
  organizeSnapshotReady: boolean
  busy: boolean
  fabBottom: number
  onStartOrganize: () => void
}) {
  const { organizeCardKind, organizeFab, pendingArticleCount } = useMemoryOrganizeUi(props)
  if (organizeCardKind === 'running') return null
  return (
    <MemoryOrganizeFab
      disabled={props.busy || organizeFab.kind === 'loading'}
      kind={organizeFab.kind}
      pendingCount={pendingArticleCount}
      bottom={props.fabBottom}
      onPress={props.onStartOrganize}
    />
  )
}
