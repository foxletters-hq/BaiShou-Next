import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { getProviderIcon, useTheme } from '@baishou/ui'
import {
  clampOcrConcurrency,
  DEFAULT_OCR_CONCURRENCY,
  normalizeKnowledgeDefaultExtractEngine,
  buildVisionLanguageSlots,
  resolveGlobalGraphModelIds,
  resolveProviderModelSlot
} from '@baishou/shared'
import { useSettingsStore } from '@baishou/store'
import { callKnowledgeApi } from './call-knowledge-api'
import { knowledgeExtractSettingsVisibility } from './knowledge-extract-settings-visibility.util'
import { OCR_LANGUAGE_PRESETS } from './knowledge-detail-labels.util'
import type {
  KnowledgeEngineCaps,
  KnowledgeOcrProgressState,
  KnowledgeSourceRow
} from './knowledge-detail.types'
import { buildNotebookOpenGuideRows } from './notebook-open-guide.util'
import { resolveNotebookProviderIconSrc } from './notebook-status-icon.util'
import { knowledgeIngestUserMessage } from './knowledge-ingest-user-error.util'
import {
  formatNotebookGraphProgress,
  graphPageSpan,
  notebookGraphProgressCopy,
  type NotebookGraphJobsState
} from './notebook-graph-progress.util'
import { notebookOrganizeProgressCopy } from './notebook-job-progress.util'
import type { KnowledgeDetailJobProgressView } from './KnowledgeDetailJobBanner'

export function useKnowledgeDetailRefresh(
  notebookId: string,
  t: TFunction,
  setError: (message: string) => void,
  setStatus: (message: string) => void
) {
  const [notebookName, setNotebookName] = useState('')
  const [storageLine, setStorageLine] = useState('')
  const [chunkCount, setChunkCount] = useState(0)
  const [sources, setSources] = useState<KnowledgeSourceRow[]>([])
  const [sourcesLoaded, setSourcesLoaded] = useState(false)
  const [graphBusy, setGraphBusy] = useState(false)
  const [graphJobs, setGraphJobs] = useState<NotebookGraphJobsState>({
    pending: 0,
    running: 0,
    failed: 0,
    currentSourceId: null,
    currentSourceTitle: null,
    lastError: null,
    failedSourceTitle: null,
    statusBySourceId: {},
    jobsBySourceId: {}
  })
  const [graphKnownTotal, setGraphKnownTotal] = useState(0)
  const [graphWindowProgress, setGraphWindowProgress] = useState<{
    done: number
    total: number
    pageFrom?: number
    pageTo?: number
    pageTotal?: number
  } | null>(null)
  const [ocrProgressBySource, setOcrProgressBySource] = useState<
    Record<string, KnowledgeOcrProgressState>
  >({})
  const [engine, setEngine] = useState<'simple' | 'ocr' | 'vision'>('ocr')
  const [ocrLanguage, setOcrLanguage] = useState('chi_sim+eng')
  const [ocrUseCustom, setOcrUseCustom] = useState(false)
  const [ocrConcurrency, setOcrConcurrency] = useState(DEFAULT_OCR_CONCURRENCY)
  const refreshGen = useRef(0)
  const [pendingJobs, setPendingJobs] = useState(0)
  const ingestingSourceCount = sources.filter(
    (s) => s.status === 'pending' || s.status === 'extracting' || s.status === 'embedding'
  ).length
  const hasActiveIngest = pendingJobs > 0 || ingestingSourceCount > 0
  const vectorPending = ingestingSourceCount
  const [visionProviderId, setVisionProviderId] = useState<string | null>(null)
  const [visionModelId, setVisionModelId] = useState<string | null>(null)
  const [engineCaps, setEngineCaps] = useState<KnowledgeEngineCaps | null>(null)
  const [vectorKnownTotal, setVectorKnownTotal] = useState(0)
  const [queuedSourceIds, setQueuedSourceIds] = useState<string[]>([])
  const [reprocessWatching, setReprocessWatching] = useState(false)
  const [modelMismatch, setModelMismatch] = useState(false)
  const reprocessSawWorkRef = useRef(false)
  const providers = useSettingsStore((s) => s.providers)
  const globalModels = useSettingsStore((s) => s.globalModels)
  const { isDark } = useTheme()

  const refreshGraphJobs = useCallback(async () => {
    if (!notebookId) return
    try {
      const snap = await callKnowledgeApi<{
        pending: number
        running: number
        failed: number
        currentSourceId: string | null
        currentSourceTitle: string | null
        lastError?: string | null
        failedSourceTitle?: string | null
        windowsDone?: number
        windowsTotal?: number
        pageFrom?: number
        pageTo?: number
        pageTotal?: number
        items?: Array<{
          sourceId: string
          status: string
          lastError?: string | null
          windowsDone?: number
          windowsTotal?: number
          pageFrom?: number
          pageTo?: number
          pageTotal?: number
        }>
      }>('listGraphJobs', 'knowledge:list-graph-jobs', notebookId)
      const statusBySourceId: Record<string, string> = {}
      const jobsBySourceId: NotebookGraphJobsState['jobsBySourceId'] = {}
      for (const item of snap?.items ?? []) {
        const sourceId = item.sourceId?.trim()
        if (!sourceId) continue
        statusBySourceId[sourceId] = item.status
        jobsBySourceId[sourceId] = {
          sourceId,
          status: item.status,
          lastError: item.lastError,
          windowsDone: item.windowsDone,
          windowsTotal: item.windowsTotal,
          pageFrom: item.pageFrom,
          pageTo: item.pageTo,
          pageTotal: item.pageTotal
        }
      }
      setGraphJobs(
        snap
          ? {
              pending: snap.pending,
              running: snap.running,
              failed: snap.failed,
              currentSourceId: snap.currentSourceId,
              currentSourceTitle: snap.currentSourceTitle,
              lastError: snap.lastError ?? null,
              failedSourceTitle: snap.failedSourceTitle ?? null,
              statusBySourceId,
              jobsBySourceId
            }
          : {
              pending: 0,
              running: 0,
              failed: 0,
              currentSourceId: null,
              currentSourceTitle: null,
              lastError: null,
              failedSourceTitle: null,
              statusBySourceId: {},
              jobsBySourceId: {}
            }
      )
      if ((snap?.pending || 0) > 0) {
        setGraphKnownTotal((prev) => Math.max(prev, snap.pending))
      }
      if ((snap?.windowsTotal || 0) > 0) {
        setGraphWindowProgress((prev) => {
          const total = Math.max(prev?.total ?? 0, snap.windowsTotal ?? 0)
          const done = Math.min(total, Math.max(prev?.done ?? 0, snap.windowsDone ?? 0))
          const pages =
            (snap.windowsDone ?? 0) >= (prev?.done ?? 0)
              ? graphPageSpan(snap) ?? graphPageSpan(prev)
              : graphPageSpan(prev) ?? graphPageSpan(snap)
          return {
            done,
            total,
            pageFrom: pages?.pageFrom,
            pageTo: pages?.pageTo,
            pageTotal: pages?.pageTotal
          }
        })
      }
      if ((snap?.pending || 0) === 0 && (snap?.running || 0) === 0 && (snap?.failed || 0) === 0) {
        setGraphWindowProgress(null)
      }
    } catch {
      /* 旧进程未注册通道时忽略，完全重启后即可 */
    }
  }, [notebookId])

  const graphProgress = useMemo(
    () =>
      formatNotebookGraphProgress(
        notebookGraphProgressCopy({
          pending: graphJobs.pending,
          running: graphJobs.running,
          failed: graphJobs.failed,
          currentSourceTitle: graphJobs.currentSourceTitle,
          knownTotal: graphKnownTotal,
        windowsDone: graphWindowProgress?.done,
        windowsTotal: graphWindowProgress?.total,
        pageFrom: graphWindowProgress?.pageFrom,
        pageTo: graphWindowProgress?.pageTo,
        pageTotal: graphWindowProgress?.pageTotal,
        lastError: graphJobs.lastError
          ? knowledgeIngestUserMessage(graphJobs.lastError, t)
          : null,
          failedSourceTitle: graphJobs.failedSourceTitle
        }),
        (key, params) => t(key, params)
      ),
    [graphJobs, graphKnownTotal, graphWindowProgress, t]
  )

  const jobProgress = useMemo<KnowledgeDetailJobProgressView>(() => {
    const graphJobsBySource = { ...graphJobs.jobsBySourceId }
    const liveSourceId = graphJobs.currentSourceId
    if (liveSourceId && graphWindowProgress) {
      const current = graphJobsBySource[liveSourceId]
      graphJobsBySource[liveSourceId] = {
        sourceId: liveSourceId,
        status: current?.status || 'running',
        lastError: current?.lastError,
        windowsDone: graphWindowProgress.done,
        windowsTotal: graphWindowProgress.total,
        pageFrom: graphWindowProgress.pageFrom,
        pageTo: graphWindowProgress.pageTo,
        pageTotal: graphWindowProgress.pageTotal
      }
    }
    const copy = notebookOrganizeProgressCopy({
      sources,
      ingestProgress: ocrProgressBySource,
      queuedSourceIds,
      graphJobsBySource,
      graph: {
        pending: graphJobs.pending,
        running: graphJobs.running,
        failed: graphJobs.failed,
        currentSourceTitle: graphJobs.currentSourceTitle,
        knownTotal: graphKnownTotal,
        windowsDone: graphWindowProgress?.done,
        windowsTotal: graphWindowProgress?.total,
        pageFrom: graphWindowProgress?.pageFrom,
        pageTo: graphWindowProgress?.pageTo,
        pageTotal: graphWindowProgress?.pageTotal,
        lastError: graphJobs.lastError,
        failedSourceTitle: graphJobs.failedSourceTitle
      }
    })
    return copy
  }, [
    graphJobs,
    graphKnownTotal,
    graphWindowProgress,
    ocrProgressBySource,
    queuedSourceIds,
    sources
  ])

  const statusRows = useMemo(() => {
    const providerType = (providerId?: string | null) =>
      providers.find((row) => row.id === providerId)?.type || null
    const extract = resolveGlobalGraphModelIds(globalModels)
    const visionHit = resolveProviderModelSlot(
      providers,
      buildVisionLanguageSlots({
        visionProviderId,
        visionModelId
      })
    )
    const visionProvider = visionHit?.providerId || ''
    const embeddingProviderId = globalModels?.globalEmbeddingProviderId || ''
    return buildNotebookOpenGuideRows({
      embeddingModelId: globalModels?.globalEmbeddingModelId,
      graphModelId: extract.modelId,
      visionModelId: visionHit?.modelId,
      extractEngine: engine,
      sourceCount: sources.length,
      icons: {
        embedding: resolveNotebookProviderIconSrc({
          providerId: embeddingProviderId,
          providerType: providerType(embeddingProviderId),
          isDark
        }),
        graphExtract: resolveNotebookProviderIconSrc({
          providerId: extract.providerId,
          providerType: providerType(extract.providerId),
          isDark
        }),
        vision: resolveNotebookProviderIconSrc({
          providerId: visionProvider,
          providerType: providerType(visionProvider),
          isDark
        })
      }
    })
  }, [engine, globalModels, isDark, providers, sources.length, visionModelId, visionProviderId])

  const visionDisplay = useMemo(() => {
    const visionHit = resolveProviderModelSlot(
      providers,
      buildVisionLanguageSlots({
        visionProviderId,
        visionModelId
      })
    )
    const providerId = visionHit?.providerId || ''
    const modelId = visionHit?.modelId || ''
    const provider = providers.find((p) => p.id === providerId)
    const iconSrc =
      (providerId ? getProviderIcon(providerId, isDark) : undefined) ||
      (provider?.type ? getProviderIcon(provider.type, isDark) : undefined)
    return {
      isCustom: Boolean(visionProviderId && visionModelId),
      providerId,
      modelId,
      iconSrc
    }
  }, [visionProviderId, visionModelId, globalModels, providers, isDark])

  const ocrPresetValue = ocrUseCustom
    ? '__custom__'
    : OCR_LANGUAGE_PRESETS.some((p) => p.value === ocrLanguage)
      ? ocrLanguage
      : '__custom__'
  const { showOcrSettings, showVisionSettings } = knowledgeExtractSettingsVisibility(engine)

  const refresh = useCallback(async () => {
    if (!notebookId) return
    const gen = ++refreshGen.current
    const [nb, list] = await Promise.all([
      window.api.knowledge.getNotebook(notebookId),
      window.api.knowledge.listSources(notebookId) as Promise<KnowledgeSourceRow[]>
    ])
    if (gen !== refreshGen.current) return
    setNotebookName(nb?.name || notebookId)
    setSources(list || [])
    setSourcesLoaded(true)
    const byId = new Map((list || []).map((s) => [s.id, s]))
    setQueuedSourceIds((prev) => {
      const next = prev.filter((id) => {
        const row = byId.get(id)
        return Boolean(
          row &&
            (row.status === 'pending' || row.status === 'extracting' || row.status === 'embedding')
        )
      })
      return next.length === prev.length && next.every((id, index) => id === prev[index])
        ? prev
        : next
    })
    setOcrProgressBySource((prev) => {
      const next = { ...prev }
      let changed = false
      for (const sourceId of Object.keys(next)) {
        const row = byId.get(sourceId)
        if (
          row &&
          row.status !== 'pending' &&
          row.status !== 'extracting' &&
          row.status !== 'embedding'
        ) {
          delete next[sourceId]
          changed = true
        }
      }
      return changed ? next : prev
    })
    void refreshGraphJobs()
    try {
      const mismatch = await window.api.knowledge.hasModelMismatch([notebookId])
      if (gen === refreshGen.current) setModelMismatch(Boolean(mismatch))
    } catch {
      if (gen === refreshGen.current) setModelMismatch(false)
    }
    try {
      const stats = await window.api.knowledge.getStats(notebookId)
      if (gen !== refreshGen.current) return
      setPendingJobs(Number(stats.pendingJobs ?? 0))
      setChunkCount(Number(stats.chunks ?? 0))
      const total = ((stats.totalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      const original = ((stats.originalBytes ?? 0) / (1024 * 1024)).toFixed(2)
      setStorageLine(
        t('knowledge.storage_usage', '本笔记本 {{total}} MB，其中原文 {{original}} MB', {
          total,
          original
        })
      )
    } catch {
      if (gen === refreshGen.current) {
        setStorageLine('')
        setChunkCount(0)
      }
    }
  }, [notebookId, refreshGraphJobs, t])

  const refreshCaps = useCallback(async () => {
    try {
      const [caps, cfg] = await Promise.all([
        window.api.knowledge.getCapabilities(),
        window.api.knowledge.getConfig()
      ])
      if (cfg.defaultExtractEngine) {
        setEngine(normalizeKnowledgeDefaultExtractEngine(cfg.defaultExtractEngine))
      }
      if (cfg.ocrLanguage) {
        setOcrLanguage(cfg.ocrLanguage)
        setOcrUseCustom(!OCR_LANGUAGE_PRESETS.some((p) => p.value === cfg.ocrLanguage))
      }
      if (typeof cfg.ocrConcurrency === 'number' && cfg.ocrConcurrency >= 1) {
        setOcrConcurrency(clampOcrConcurrency(cfg.ocrConcurrency))
      }
      setVisionProviderId(cfg.visionProviderId ?? null)
      setVisionModelId(cfg.visionModelId ?? null)
      setEngineCaps({
        simple: { available: !!caps.simple?.available, reason: caps.simple?.reason },
        ocr: {
          available: !!caps.ocr?.available,
          reason: caps.ocr?.reason
        },
        vision: {
          available: !!caps.vision?.available,
          reason: caps.vision?.reason,
          detail: caps.vision?.detail
        }
      })
    } catch {
      setEngineCaps(null)
    }
  }, [])

  useEffect(() => {
    setSourcesLoaded(false)
    setQueuedSourceIds([])
  }, [notebookId])

  useEffect(() => {
    void refresh().catch((e) => setError(String(e?.message || e)))
    void refreshCaps()
    void callKnowledgeApi('recoverStale', 'knowledge:recover-stale').catch(() => undefined)
  }, [refresh, refreshCaps, setError])

  useEffect(() => {
    if (!hasActiveIngest && !reprocessWatching) return
    const timer = window.setInterval(
      () => {
        void refresh().catch(() => undefined)
      },
      reprocessWatching ? 1000 : 4000
    )
    return () => window.clearInterval(timer)
  }, [hasActiveIngest, refresh, reprocessWatching])

  useEffect(() => {
    const unsubscribe = window.api.knowledge.onOcrProgress?.((progress) => {
      if (progress.total <= 0) {
        setOcrProgressBySource((prev) => {
          if (!prev[progress.sourceId]) return prev
          const next = { ...prev }
          delete next[progress.sourceId]
          return next
        })
        void refresh().catch(() => undefined)
        return
      }
      setOcrProgressBySource((prev) => ({
        ...prev,
        [progress.sourceId]: {
          page: progress.page,
          total: progress.total,
          phase: progress.phase
        }
      }))
      if (progress.page >= progress.total && progress.total > 0) {
        void refresh().catch(() => undefined)
      }
    })
    return () => {
      unsubscribe?.()
    }
  }, [refresh])

  useEffect(() => {
    void useSettingsStore.getState().ensureConfigKeys(['globalModels', 'providers'])
  }, [])

  useEffect(() => {
    const onProgress = (progress?: {
      windowsDone?: number
      windowsTotal?: number
      pageFrom?: number
      pageTo?: number
      pageTotal?: number
    }) => {
      if (typeof progress?.windowsTotal === 'number' && progress.windowsTotal > 0) {
        const pages = graphPageSpan(progress)
        setGraphWindowProgress({
          done: Number(progress.windowsDone ?? 0),
          total: progress.windowsTotal,
          pageFrom: pages?.pageFrom,
          pageTo: pages?.pageTo,
          pageTotal: pages?.pageTotal
        })
      }
      void refreshGraphJobs()
      void refresh().catch(() => undefined)
    }
    const unsubscribe = window.api.knowledge.onGraphProgress?.(onProgress)
    let fallback: (() => void) | undefined
    if (!unsubscribe && typeof window.electron?.ipcRenderer?.on === 'function') {
      const handler = (
        _event: unknown,
        progress?: {
          windowsDone?: number
          windowsTotal?: number
          pageFrom?: number
          pageTo?: number
          pageTotal?: number
        }
      ) => onProgress(progress)
      const off = window.electron.ipcRenderer.on('knowledge:graph-progress', handler)
      fallback = typeof off === 'function' ? off : undefined
    }
    return () => {
      unsubscribe?.()
      fallback?.()
    }
  }, [refresh, refreshGraphJobs])

  useEffect(() => {
    if (graphJobs.pending <= 0 && graphJobs.running <= 0 && !graphBusy && !reprocessWatching) return
    const timer = window.setInterval(() => {
      void refreshGraphJobs()
    }, 1000)
    return () => window.clearInterval(timer)
  }, [graphBusy, graphJobs.pending, graphJobs.running, refreshGraphJobs, reprocessWatching])

  useEffect(() => {
    if (!reprocessWatching) return
    const active = hasActiveIngest || graphJobs.pending > 0 || graphJobs.running > 0
    if (active) {
      reprocessSawWorkRef.current = true
      return
    }
    if (!reprocessSawWorkRef.current) return
    setReprocessWatching(false)
    setStatus(t('knowledge.data_manage_reprocess_done', '重新整理已完成'))
  }, [graphJobs.pending, graphJobs.running, hasActiveIngest, reprocessWatching, setStatus, t])

  useEffect(() => {
    if (vectorPending > 0) {
      setVectorKnownTotal((prev) => Math.max(prev, vectorPending))
      return
    }
    if (!reprocessWatching && !hasActiveIngest) setVectorKnownTotal(0)
  }, [hasActiveIngest, reprocessWatching, vectorPending])

  return {
    notebookName,
    storageLine,
    chunkCount,
    sources,
    sourcesLoaded,
    graphBusy,
    setGraphBusy,
    graphJobs,
    setGraphJobs,
    graphKnownTotal,
    setGraphKnownTotal,
    graphWindowProgress,
    setGraphWindowProgress,
    ocrProgressBySource,
    setOcrProgressBySource,
    engine,
    setEngine,
    ocrLanguage,
    setOcrLanguage,
    ocrUseCustom,
    setOcrUseCustom,
    ocrConcurrency,
    setOcrConcurrency,
    pendingJobs,
    setPendingJobs,
    visionProviderId,
    setVisionProviderId,
    visionModelId,
    setVisionModelId,
    engineCaps,
    vectorKnownTotal,
    setVectorKnownTotal,
    queuedSourceIds,
    setQueuedSourceIds,
    reprocessWatching,
    setReprocessWatching,
    reprocessSawWorkRef,
    providers,
    globalModels,
    visionDisplay,
    ocrPresetValue,
    showOcrSettings,
    showVisionSettings,
    graphProgress,
    jobProgress,
    statusRows,
    refresh,
    refreshCaps,
    refreshGraphJobs,
    hasActiveIngest,
    modelMismatch
  }
}
