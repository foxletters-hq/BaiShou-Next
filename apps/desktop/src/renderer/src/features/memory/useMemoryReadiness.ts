import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import i18n from 'i18next'
import {
  buildMemoryReadinessRows,
  describeGraphExtractPhase,
  EMPTY_PENDING_EMBED_COUNTS,
  isEmbeddingConfiguredForMemory,
  type GlobalModelsConfig,
  type GraphExtractQueueSnapshot,
  type MemoryReadinessRow,
  type PendingEmbedCounts,
  type RagConfig
} from '@baishou/shared'
import { graphGetQueueState, graphOnQueueProgress } from '../graph/graph-extract-queue.api'
import { getCachedRagActiveState, subscribeRagRuntime } from '../settings/rag-runtime-cache'
import { ragIndexingSnapshotFromState } from '../settings/rag-indexing-snapshot'

export type MemoryGraphExtractingSnapshot = {
  current: number
  total: number
  percent: number
  statusText?: string
}

export type MemoryOrganizePipeline = 'idle' | 'embed' | 'graph'

type ReadinessSnapshot = {
  rows: MemoryReadinessRow[]
  embeddingConfigured: boolean
  unindexedDiaryCount: number
  pendingEmbedCount: number
  pendingEmbedParts: PendingEmbedCounts
  pendingGraphCount: number
  suspectCount: number
  graphExtracting: MemoryGraphExtractingSnapshot | null
  organizePipeline: MemoryOrganizePipeline
}

const EMPTY: ReadinessSnapshot = {
  rows: buildMemoryReadinessRows({
    globalModels: null,
    ragConfig: null,
    unindexedDiaryCount: 0,
    pendingGraphCount: 0
  }),
  embeddingConfigured: false,
  unindexedDiaryCount: 0,
  pendingEmbedCount: 0,
  pendingEmbedParts: EMPTY_PENDING_EMBED_COUNTS,
  pendingGraphCount: 0,
  suspectCount: 0,
  graphExtracting: null,
  organizePipeline: 'idle'
}

let cachedSnapshot: ReadinessSnapshot = EMPTY
let cachedLoading = true
const listeners = new Set<() => void>()
let inFlight: Promise<ReadinessSnapshot> | null = null
let graphQueueListenCount = 0
let stopGraphQueueListen: (() => void) | null = null
let graphQueueWasBusy = false

function emitReadiness() {
  for (const listener of listeners) listener()
}

function subscribeReadiness(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function withLiveFields(
  base: Omit<ReadinessSnapshot, 'graphExtracting' | 'organizePipeline'>
): ReadinessSnapshot {
  return {
    ...base,
    graphExtracting: cachedSnapshot.graphExtracting,
    organizePipeline: cachedSnapshot.organizePipeline
  }
}

export function setMemoryOrganizePipeline(next: MemoryOrganizePipeline) {
  if (cachedSnapshot.organizePipeline === next) return
  cachedSnapshot = { ...cachedSnapshot, organizePipeline: next }
  emitReadiness()
}

export function getMemoryReadinessSnapshot(): ReadinessSnapshot {
  return cachedSnapshot
}

export function getMemoryReadinessLoading(): boolean {
  return cachedLoading
}

export function armGraphExtracting(total: number) {
  const safeTotal = Math.max(0, Math.floor(total))
  if (safeTotal <= 0) {
    if (!cachedSnapshot.graphExtracting) return
    cachedSnapshot = { ...cachedSnapshot, graphExtracting: null }
    emitReadiness()
    return
  }
  graphQueueWasBusy = true
  if (cachedSnapshot.graphExtracting) return
  cachedSnapshot = {
    ...cachedSnapshot,
    graphExtracting: { current: 0, total: safeTotal, percent: 0 }
  }
  emitReadiness()
}

function graphQueueIsBusy(state: GraphExtractQueueSnapshot): boolean {
  return state.runningCount > 0 || state.pendingCount > 0 || (state.aligningCount ?? 0) > 0
}

function applyGraphQueueToReadiness(state: GraphExtractQueueSnapshot) {
  const busy = graphQueueIsBusy(state)
  if (busy) {
    graphQueueWasBusy = true
    const total = state.items.length
    const current = Math.min(state.completedCount + (state.aligningCount ?? 0), total)
    const activeItems = state.items.filter(
      (it) => it.status === 'running' || it.status === 'aligning'
    )
    const activeItem =
      activeItems.find(
        (it) =>
          it.phase === 'recalling' ||
          it.phase === 'waiting_align' ||
          it.phase === 'aligning' ||
          it.phase === 'writing'
      ) ??
      activeItems.find((it) => it.status === 'running') ??
      activeItems[0]
    let statusText: string | undefined
    if (activeItem) {
      const itemLabel =
        activeItem.date?.trim() ||
        activeItem.filePath.match(/(\d{4}[-/.]\d{1,2}[-/.]\d{1,2})/)?.[1] ||
        (activeItem.filePath.split(/[/\\]/).pop() || activeItem.filePath).replace(/\.md$/i, '')
      const phaseDesc = describeGraphExtractPhase(activeItem)
      const phaseLabel = i18n.t(phaseDesc.key, phaseDesc.defaultValue, phaseDesc.params)
      statusText = i18n.t('graph.extract_item_detail', '正在整理 {{item}} · {{phase}}', {
        item: itemLabel,
        phase: phaseLabel
      })
    }
    const next: MemoryGraphExtractingSnapshot = {
      current,
      total,
      percent: state.overallProgress ?? 0,
      statusText
    }
    const prev = cachedSnapshot.graphExtracting
    if (
      prev &&
      prev.current === next.current &&
      prev.total === next.total &&
      prev.percent === next.percent &&
      prev.statusText === next.statusText
    ) {
      return
    }
    cachedSnapshot = { ...cachedSnapshot, graphExtracting: next }
    emitReadiness()
    return
  }

  const hadExtracting = cachedSnapshot.graphExtracting != null
  if (hadExtracting) {
    cachedSnapshot = { ...cachedSnapshot, graphExtracting: null }
    emitReadiness()
  }
  if (graphQueueWasBusy) {
    graphQueueWasBusy = false
    cachedSnapshot = { ...cachedSnapshot, organizePipeline: 'idle' }
    void refreshMemoryReadiness()
  }
}

function startGraphQueueReadinessListen() {
  graphQueueListenCount += 1
  if (stopGraphQueueListen) return
  void graphGetQueueState()
    .then(applyGraphQueueToReadiness)
    .catch(() => {
      // Preload/main 尚未就绪时忽略
    })
  stopGraphQueueListen = graphOnQueueProgress(applyGraphQueueToReadiness)
}

function stopGraphQueueReadinessListenIfUnused() {
  graphQueueListenCount -= 1
  if (graphQueueListenCount > 0) return
  stopGraphQueueListen?.()
  stopGraphQueueListen = null
}

async function fetchMemoryReadinessSnapshot(): Promise<ReadinessSnapshot> {
  if (inFlight) return inFlight
  inFlight = (async () => {
    const ragApi = (
      window.api as {
        rag?: { getPendingEmbedCounts?: () => Promise<PendingEmbedCounts> }
      }
    ).rag
    const [pending, embedCounts, globalModels, ragConfig, suspects] = await Promise.all([
      window.api.graph.listPendingReextract().catch(() => []),
      (ragApi?.getPendingEmbedCounts?.() ?? Promise.resolve(EMPTY_PENDING_EMBED_COUNTS)).catch(
        () => EMPTY_PENDING_EMBED_COUNTS
      ),
      window.api.settings.getGlobalModels().catch(() => null),
      window.api.settings.getRagConfig().catch(() => null),
      window.api.graph.listSuspectNodes().catch(() => [])
    ])
    const pendingGraphCount = Array.isArray(pending) ? pending.length : 0
    const suspectCount = Array.isArray(suspects) ? suspects.length : 0
    const counts =
      embedCounts && typeof embedCounts === 'object' && 'total' in embedCounts
        ? embedCounts
        : EMPTY_PENDING_EMBED_COUNTS
    const models = globalModels as GlobalModelsConfig | null
    const rows = buildMemoryReadinessRows({
      globalModels: models,
      ragConfig: ragConfig as RagConfig | null,
      pendingEmbedCount: counts.total,
      pendingGraphCount
    })
    return withLiveFields({
      rows,
      embeddingConfigured: isEmbeddingConfiguredForMemory(models),
      unindexedDiaryCount: counts.diaries,
      pendingEmbedCount: counts.total,
      pendingEmbedParts: counts,
      pendingGraphCount,
      suspectCount
    })
  })().finally(() => {
    inFlight = null
  })
  return inFlight
}

export async function refreshMemoryReadiness(): Promise<void> {
  try {
    if (inFlight) {
      try {
        await inFlight
      } catch {
        // 丢弃进行中的旧快照，下面重新拉一次
      }
    }
    cachedSnapshot = await fetchMemoryReadinessSnapshot()
  } catch {
    cachedSnapshot = withLiveFields({
      rows: EMPTY.rows,
      embeddingConfigured: EMPTY.embeddingConfigured,
      unindexedDiaryCount: EMPTY.unindexedDiaryCount,
      pendingEmbedCount: EMPTY.pendingEmbedCount,
      pendingEmbedParts: EMPTY.pendingEmbedParts,
      pendingGraphCount: EMPTY.pendingGraphCount,
      suspectCount: EMPTY.suspectCount
    })
  } finally {
    cachedLoading = false
    emitReadiness()
  }
}

export function useMemoryReadiness() {
  const snapshot = useSyncExternalStore(
    subscribeReadiness,
    () => cachedSnapshot,
    () => EMPTY
  )
  const loading = useSyncExternalStore(
    subscribeReadiness,
    () => cachedLoading,
    () => true
  )
  const ragState = useSyncExternalStore(
    subscribeRagRuntime,
    getCachedRagActiveState,
    getCachedRagActiveState
  )
  const indexing = ragIndexingSnapshotFromState(ragState)

  const refresh = useCallback(() => refreshMemoryReadiness(), [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    startGraphQueueReadinessListen()
    return () => stopGraphQueueReadinessListenIfUnused()
  }, [])

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  useEffect(() => {
    const api = window.api as {
      diary?: { onSyncEvent?: (cb: (event: { type?: string }) => void) => () => void }
    }
    const unsubscribe = api.diary?.onSyncEvent?.((event) => {
      if (
        event?.type === 'embed-pending-changed' ||
        event?.type === 'vault-resync-complete' ||
        event?.type === 'indexing-complete'
      ) {
        void refresh()
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [refresh])

  const wasIndexingRef = useRef(false)
  useEffect(() => {
    const indexingNow = ragState.isRunning && ragState.type === 'batchEmbed'
    if (indexingNow) {
      wasIndexingRef.current = true
      if (cachedSnapshot.organizePipeline === 'idle') {
        setMemoryOrganizePipeline('embed')
      }
      return
    }
    if (wasIndexingRef.current) {
      wasIndexingRef.current = false
      setMemoryOrganizePipeline('idle')
      void refresh()
    }
  }, [ragState.isRunning, ragState.type, refresh])

  return { ...snapshot, loading, refresh, indexing }
}
