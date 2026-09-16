import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import {
  firstActivePhase,
  loadGraphExtractConcurrency,
  phaseCountsFromPending,
  type MemoryReadinessRowId
} from '@baishou/shared'
import { SegmentedControl } from '@baishou/ui'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import { ensureDesktopGraphSelfName } from '../diary/utils/ensure-graph-self-name'
import { GraphPage } from '../graph/GraphPage'
import { graphQueueExtract } from '../graph/graph-extract-queue.api'
import { MemoryHelpButton } from './MemoryHelpButton'
import { MemoryReadinessBar } from './MemoryReadinessBar'
import { MemoryVectorTab } from './MemoryVectorTab'
import {
  armGraphExtracting,
  refreshMemoryReadiness,
  setMemoryOrganizePipeline,
  useMemoryReadiness
} from './useMemoryReadiness'
import { patchCachedRagActiveState } from '../settings/rag-runtime-cache'
import {
  memoryCenterPathForTab,
  memoryCenterTabFromPath,
  resolveMemoryOrganizeAction,
  type MemoryCenterTab
} from './memory-center-tab.util'
import styles from './MemoryCenterPage.module.css'

export const MemoryCenterPage: React.FC<{ embedded?: boolean }> = ({ embedded = false }) => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const routeTab = memoryCenterTabFromPath(location.pathname)
  const [localTab, setLocalTab] = useState<MemoryCenterTab>(embedded ? 'vectors' : routeTab)
  const tab = embedded ? localTab : routeTab
  const readiness = useMemoryReadiness()
  const [highlight, setHighlight] = useState<'start-organize' | null>(null)
  const [autoStartOrganize, setAutoStartOrganize] = useState(false)

  const goConfigure = useCallback(() => {
    if (location.pathname.startsWith('/settings')) {
      navigate('/settings/ai-models')
      return
    }
    navigate(`${SETTINGS_HUB_PREFIX}/ai-models`)
  }, [location.pathname, navigate])

  const selectTab = useCallback(
    (next: MemoryCenterTab) => {
      if (embedded) {
        setLocalTab(next)
        return
      }
      navigate(memoryCenterPathForTab(next))
    },
    [embedded, navigate]
  )

  const continueGraphAfterEmbedRef = useRef(false)
  const wasIndexingRef = useRef(false)
  const tabRef = useRef(tab)
  tabRef.current = tab

  const beginGraphOrganize = useCallback(async () => {
    setMemoryOrganizePipeline('graph')
    armGraphExtracting(readiness.pendingGraphCount)
    if (tabRef.current === 'graph') {
      setHighlight('start-organize')
      setAutoStartOrganize(true)
      return
    }
    const selfName = await ensureDesktopGraphSelfName()
    if (!selfName) {
      setMemoryOrganizePipeline('idle')
      armGraphExtracting(0)
      return
    }
    try {
      const result = await graphQueueExtract({ concurrency: loadGraphExtractConcurrency() })
      if (!result?.queued) {
        setMemoryOrganizePipeline('idle')
        armGraphExtracting(0)
      }
      void refreshMemoryReadiness()
    } catch {
      setMemoryOrganizePipeline('idle')
      armGraphExtracting(0)
    }
  }, [readiness.pendingGraphCount])

  const finishEmbedThenGraph = useCallback(async () => {
    if (!continueGraphAfterEmbedRef.current) return
    continueGraphAfterEmbedRef.current = false
    await beginGraphOrganize()
  }, [beginGraphOrganize])

  const startBatchEmbed = useCallback(async (): Promise<
    'ok' | 'cancelled' | 'already-running' | 'failed'
  > => {
    const parts = readiness.pendingEmbedParts
    patchCachedRagActiveState({
      isRunning: true,
      type: 'batchEmbed',
      progress: 0,
      total: Math.max(parts.total, 1),
      statusText: t('memory.readiness_organizing', '正在整理记忆…'),
      phase: firstActivePhase(parts),
      phases: phaseCountsFromPending(parts),
      error: undefined,
      paused: false,
      cancelling: false
    })
    try {
      const result = await (window as any).api?.rag?.triggerBatchEmbed()
      if (result?.alreadyRunning) return 'already-running'
      if (result?.cancelled) return 'cancelled'
      if (result && result.ok === false) return 'failed'
      return 'ok'
    } catch {
      patchCachedRagActiveState({
        isRunning: false,
        type: 'idle',
        statusText: ''
      })
      return 'failed'
    }
  }, [readiness.pendingEmbedParts, t])

  const startOrganizeMemory = useCallback(async () => {
    const action = resolveMemoryOrganizeAction({
      embeddingConfigured: readiness.embeddingConfigured,
      pendingEmbedCount: readiness.pendingEmbedCount,
      unindexedDiaryCount: readiness.unindexedDiaryCount,
      indexing: Boolean(readiness.indexing)
    })
    if (action === 'configure') {
      goConfigure()
      return
    }
    if (action === 'graph') {
      await beginGraphOrganize()
      return
    }
    setMemoryOrganizePipeline('embed')
    continueGraphAfterEmbedRef.current = true
    const outcome = await startBatchEmbed()
    if (outcome === 'already-running') return
    if (outcome !== 'ok') {
      continueGraphAfterEmbedRef.current = false
      setMemoryOrganizePipeline('idle')
      return
    }
    await finishEmbedThenGraph()
  }, [
    beginGraphOrganize,
    finishEmbedThenGraph,
    goConfigure,
    readiness.embeddingConfigured,
    readiness.indexing,
    readiness.pendingEmbedCount,
    readiness.unindexedDiaryCount,
    startBatchEmbed
  ])

  useEffect(() => {
    const indexingNow = Boolean(readiness.indexing)
    const wasIndexing = wasIndexingRef.current
    wasIndexingRef.current = indexingNow
    if (wasIndexing && !indexingNow) finishEmbedThenGraph()
  }, [finishEmbedThenGraph, readiness.indexing])

  const topBarOmit = useMemo(() => {
    const omit: MemoryReadinessRowId[] = ['extract', 'graph']
    for (const row of readiness.rows) {
      if (row.id === 'embedding' && row.state === 'ready') omit.push('embedding')
    }
    return omit
  }, [readiness.rows])

  const readinessBar = (
    <MemoryReadinessBar
      wrap
      showLabel={false}
      omit={topBarOmit}
      rows={readiness.rows}
      onConfigureEmbedding={goConfigure}
      onStartIndex={startOrganizeMemory}
      onStartOrganize={startOrganizeMemory}
      pendingEmbedParts={readiness.pendingEmbedParts}
      pendingGraphCount={readiness.pendingGraphCount}
      indexing={readiness.indexing}
      extracting={readiness.graphExtracting}
      organizePipeline={readiness.organizePipeline}
    />
  )

  const tabOptions = useMemo(
    () => [
      { value: 'vectors' as const, label: t('memory.tab_vectors', '向量片段') },
      { value: 'graph' as const, label: t('memory.tab_graph', '关系图谱') }
    ],
    [t]
  )

  if (!embedded && (location.pathname === '/memory' || location.pathname === '/memory/')) {
    return <Navigate to="/memory/vectors" replace />
  }

  return (
    <div
      className={`${styles.root}${embedded ? ` ${styles.rootEmbedded} memory-center-embedded` : ''}`}
    >
      <header className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.titleLead}>
            <h1 className={styles.title}>{t('memory.title', '全局 AI 记忆')}</h1>
            <MemoryHelpButton className={styles.titleHelp} />
            <div className={styles.tabs}>
              <SegmentedControl
                value={tab}
                aria-label={t('memory.tabs', '记忆类型')}
                options={tabOptions}
                onChange={selectTab}
              />
            </div>
          </div>
          <div className={styles.readinessSlot}>{readinessBar}</div>
        </div>
      </header>

      <div className={styles.body}>
        {tab === 'vectors' ? (
          <MemoryVectorTab />
        ) : (
          <div className={styles.graphHost}>
            <GraphPage
              embedded
              highlightStartOrganize={highlight === 'start-organize'}
              autoStartOrganize={autoStartOrganize}
              onAutoStartOrganizeConsumed={() => setAutoStartOrganize(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
