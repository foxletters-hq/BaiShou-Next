import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { firstActivePhase, phaseCountsFromPending } from '@baishou/shared'
import { SegmentedControl } from '@baishou/ui'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import { ensureDesktopGraphSelfName } from '../diary/utils/ensure-graph-self-name'
import { GraphPage } from '../graph/GraphPage'
import { MemoryCenterOrganizeSlot } from './MemoryCenterOrganizeSlot'
import { MemoryHelpButton } from './MemoryHelpButton'
import { MemoryVectorTab } from './MemoryVectorTab'
import { consumeMemoryGraphTab, subscribeMemoryGraphTab } from './memory-graph-tab-focus'
import {
  getMemoryReadinessLoading,
  getMemoryReadinessSnapshot,
  refreshMemoryReadiness,
  setMemoryOrganizePipeline
} from './useMemoryReadiness'
import { getCachedRagActiveState, patchCachedRagActiveState } from '../settings/rag-runtime-cache'
import { ragIndexingSnapshotFromState } from '../settings/rag-indexing-snapshot'
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
  const [mountedTabs, setMountedTabs] = useState<Set<MemoryCenterTab>>(() => new Set([tab]))
  const startOrganizeMemoryRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    setMountedTabs((prev) => {
      if (prev.has(tab)) return prev
      const next = new Set(prev)
      next.add(tab)
      return next
    })
  }, [tab])

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

  useEffect(() => {
    const applyGraphTab = () => {
      if (consumeMemoryGraphTab()) selectTab('graph')
    }
    applyGraphTab()
    return subscribeMemoryGraphTab(applyGraphTab)
  }, [selectTab])

  const startBatchEmbed = useCallback(async (): Promise<
    'ok' | 'cancelled' | 'already-running' | 'failed'
  > => {
    const snap = getMemoryReadinessSnapshot()
    const parts = snap.pendingEmbedParts
    const graphExtract = snap.pendingGraphCount
    patchCachedRagActiveState({
      isRunning: true,
      type: 'batchEmbed',
      progress: 0,
      total: Math.max(parts.total + graphExtract, 1),
      statusText: t('memory.readiness_organizing', '正在整理记忆…'),
      phase: firstActivePhase({ ...parts, graphExtract }),
      phases: phaseCountsFromPending({ ...parts, graphExtract }),
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
  }, [t])

  const startOrganizeMemory = useCallback(async () => {
    if (getMemoryReadinessLoading()) {
      await refreshMemoryReadiness()
    }
    const snap = getMemoryReadinessSnapshot()
    const action = resolveMemoryOrganizeAction({
      embeddingConfigured: snap.embeddingConfigured,
      pendingEmbedCount: snap.pendingEmbedCount,
      unindexedDiaryCount: snap.unindexedDiaryCount,
      indexing: Boolean(ragIndexingSnapshotFromState(getCachedRagActiveState()))
    })
    if (action === 'configure') {
      goConfigure()
      return
    }
    if (snap.pendingGraphCount > 0) {
      const selfName = await ensureDesktopGraphSelfName()
      if (!selfName && action === 'graph') return
    }
    setMemoryOrganizePipeline('embed')
    const outcome = await startBatchEmbed()
    if (outcome === 'already-running') return
    if (outcome !== 'ok') {
      setMemoryOrganizePipeline('idle')
    }
  }, [goConfigure, startBatchEmbed])
  startOrganizeMemoryRef.current = startOrganizeMemory
  const onUnifiedOrganize = useCallback(() => {
    void startOrganizeMemoryRef.current()
  }, [])

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
            <MemoryHelpButton />
            <div className={styles.tabs}>
              <SegmentedControl
                value={tab}
                aria-label={t('memory.tabs', '记忆类型')}
                options={tabOptions}
                onChange={selectTab}
              />
            </div>
          </div>
          <MemoryCenterOrganizeSlot
            onConfigureEmbedding={goConfigure}
            onStartOrganize={onUnifiedOrganize}
          />
        </div>
      </header>

      <div className={styles.body}>
        {mountedTabs.has('vectors') ? (
          <div
            className={`${styles.vectorHost} ${tab === 'vectors' ? '' : styles.tabPanelHidden}`}
            aria-hidden={tab !== 'vectors'}
            inert={tab !== 'vectors'}
          >
            <MemoryVectorTab />
          </div>
        ) : null}
        {mountedTabs.has('graph') ? (
          <div
            className={`${styles.graphHost} ${tab === 'graph' ? '' : styles.tabPanelHidden}`}
            aria-hidden={tab !== 'graph'}
            inert={tab !== 'graph'}
          >
            <GraphPage embedded active={tab === 'graph'} onUnifiedOrganize={onUnifiedOrganize} />
          </div>
        ) : null}
      </div>
    </div>
  )
}
