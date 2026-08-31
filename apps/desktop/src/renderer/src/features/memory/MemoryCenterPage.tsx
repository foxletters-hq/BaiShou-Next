import React, { useCallback, useMemo, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { SegmentedControl } from '@baishou/ui'
import { SETTINGS_HUB_PREFIX } from '../settings/settings-route.util'
import { GraphPage } from '../graph/GraphPage'
import { MemoryHelpButton } from './MemoryHelpButton'
import { MemoryOnboardingCard } from './MemoryOnboardingCard'
import { MemoryReadinessBar } from './MemoryReadinessBar'
import { MemoryVectorTab } from './MemoryVectorTab'
import { useMemoryReadiness } from './useMemoryReadiness'
import {
  memoryCenterPathForTab,
  memoryCenterTabFromPath,
  persistMemoryOnboardingDismissed,
  readMemoryOnboardingDismissed,
  shouldShowMemoryOnboarding,
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
  const [highlight, setHighlight] = useState<'batch-embed' | 'start-organize' | null>(null)
  const [dismissed, setDismissed] = useState(readMemoryOnboardingDismissed)

  const showOnboarding = shouldShowMemoryOnboarding({
    dismissed,
    embeddingConfigured: readiness.embeddingConfigured,
    unindexedDiaryCount: readiness.unindexedDiaryCount,
    pendingGraphCount: readiness.pendingGraphCount
  })

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

  const goIndex = useCallback(() => {
    setHighlight('batch-embed')
    selectTab('vectors')
  }, [selectTab])

  const goOrganize = useCallback(() => {
    setHighlight('start-organize')
    selectTab('graph')
  }, [selectTab])

  const dismissOnboarding = useCallback(() => {
    persistMemoryOnboardingDismissed()
    setDismissed(true)
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
          <h1 className={styles.title}>{t('memory.title', '全局 AI 记忆')}</h1>
          <MemoryHelpButton className={styles.titleHelp} />
        </div>
        <div className={styles.tabs}>
          <SegmentedControl
            value={tab}
            aria-label={t('memory.tabs', '记忆类型')}
            options={tabOptions}
            onChange={selectTab}
          />
        </div>
      </header>

      <MemoryReadinessBar
        rows={readiness.rows}
        onConfigureEmbedding={goConfigure}
        onStartIndex={goIndex}
        onStartOrganize={goOrganize}
      />

      {showOnboarding ? (
        <MemoryOnboardingCard
          onConfigureEmbedding={goConfigure}
          onStartIndex={goIndex}
          onStartOrganize={goOrganize}
          onDismiss={dismissOnboarding}
        />
      ) : null}

      <div className={styles.body}>
        {tab === 'vectors' ? (
          <MemoryVectorTab highlightBatchEmbed={highlight === 'batch-embed'} />
        ) : (
          <div className={styles.graphHost}>
            <GraphPage embedded highlightStartOrganize={highlight === 'start-organize'} />
          </div>
        )}
      </div>
    </div>
  )
}
