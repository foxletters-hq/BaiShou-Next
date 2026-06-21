import { useTranslation } from 'react-i18next'
import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import {
  DashboardHeroBanner,
  DashboardStatsCard,
  DashboardSharedMemoryCard,
  ActivityHeatmap,
  useToast
} from '@baishou/ui'
import { motion, AnimatePresence } from 'framer-motion'
import { useSummaryData } from './hooks/useSummaryData'
import { SummaryTabBar } from './components/SummaryTabBar'
import { SummaryMissingSection } from './components/SummaryMissingSection'
import { SummaryGalleryView } from './components/SummaryGalleryView'
import { resolveDesktopSummaryConfig } from './utils/summary-config.util'
import { peekSummaryDashboardCache } from '../../lib/summary-dashboard-cache'
import './SummaryPage.css'

export const SummaryPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel')
  const [lookbackMonths, setLookbackMonths] = useState(1)
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [concurrencyLimit, setConcurrencyLimitState] = useState(3)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  const {
    summaries,
    stats,
    activityData,
    availableYears,
    missingSummaries,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    generationStates,
    isDetectingMissing,
    refreshDashboard,
    refreshSummaries,
    refreshData,
    refreshMissing,
    scopeKey
  } = useSummaryData(selectedYear)

  const prevStatesRef = useRef<typeof generationStates>({})
  const prevPathRef = useRef(location.pathname)
  const prevTabRef = useRef(activeTab)
  const lastFocusRefreshRef = useRef(0)

  useEffect(() => {
    if (availableYears.length === 0) return
    if (!availableYears.includes(selectedYear)) {
      setSelectedYear(availableYears[availableYears.length - 1]!)
    }
  }, [availableYears, selectedYear])

  /** MainPageCache 保活：路由回到 /summary 时 SWR 刷新 dashboard */
  useEffect(() => {
    const prev = prevPathRef.current
    prevPathRef.current = location.pathname

    if (prev.startsWith('/summary/') && location.pathname === '/summary') {
      const now = Date.now()
      const cacheStale = peekSummaryDashboardCache(scopeKey)?.stale ?? true
      if (!cacheStale && now - lastFocusRefreshRef.current < 4000) return
      lastFocusRefreshRef.current = now
      void refreshDashboard()
    }
  }, [location.pathname, refreshDashboard, scopeKey])

  useEffect(() => {
    const prev = prevTabRef.current
    prevTabRef.current = activeTab

    if (prev !== 'gallery' && activeTab === 'gallery') {
      void refreshSummaries()
    }
    if (prev !== 'panel' && activeTab === 'panel') {
      void refreshMissing()
    }
  }, [activeTab, refreshMissing, refreshSummaries])

  useEffect(() => {
    Object.keys(generationStates).forEach((uKey) => {
      const cur = generationStates[uKey]
      const prev = prevStatesRef.current[uKey]
      if (cur.status === 'error' && (!prev || prev.status !== 'error')) {
        let errText = cur.error || t('common.error', '错误')
        if (cur.error?.includes('active provider')) {
          errText = t('summary.model_not_configured', '模型未配置')
        } else if (
          cur.error?.includes('timed out') ||
          cur.error?.includes('AbortError') ||
          cur.error?.includes('timeout')
        ) {
          errText = t(
            'summary.generation_timeout',
            'AI 总结超时。这通常是由于网络连接慢或 AI 服务响应慢导致的，建议您在设置中切换为其它更稳定的 AI 模型后重试。'
          )
        }
        toast.showError(`${t('summary.generation_failed', '生成失败')}: ${errText}`)
      }
    })
    prevStatesRef.current = generationStates
  }, [generationStates, t, toast])

  const checkModelConfigured = async (): Promise<boolean> => {
    try {
      const resolution = await resolveDesktopSummaryConfig()
      if (!resolution.ok) {
        toast.showError(t('summary.model_not_configured', '模型未配置'))
        return false
      }
      return true
    } catch {
      toast.showError(t('summary.model_not_configured', '模型未配置'))
      return false
    }
  }

  const handleCopyContext = async () => {
    try {
      const api = (window as any).api
      if (!api?.summary?.buildSharedContext) {
        toast.showError(t('common.copy_failed', '复制失败'))
        return
      }
      const contextText = await api.summary.buildSharedContext(lookbackMonths, i18n.language)
      if (contextText) {
        await navigator.clipboard.writeText(contextText)
        toast.showSuccess(t('summary.toast_copied', '共同回忆已复制'))
      } else {
        toast.showError(t('summary.no_data_to_copy', '当前回溯范围内无已生成的总结回忆'))
      }
    } catch (e: unknown) {
      console.error('[SummaryPage] Copy failed:', e)
      toast.showError(t('common.copy_failed', '复制失败'))
    }
  }

  const handleBatchGenerate = async () => {
    if (isBatchGenerating) return
    const isConfigured = await checkModelConfigured()
    if (!isConfigured) return

    setIsBatchGenerating(true)
    const pendingTasks = missingSummaries.filter((mp) => {
      const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`
      const state = generationStates[uKey]
      return !state || state.status === 'pending' || state.status === 'error'
    })
    if (pendingTasks.length > 0) {
      await queueGeneration(pendingTasks, concurrencyLimit)
      toast.showSuccess(
        t('summary.batch_queued', '已将 $count 项任务加入后台构建队列，您可以离开页面。').replace(
          '$count',
          pendingTasks.length.toString()
        )
      )
    } else {
      toast.showSuccess(t('summary.all_processing', '所有检测到的遗失项均已在处理中。'))
    }
    setTimeout(() => setIsBatchGenerating(false), 800)
  }

  const handleStopGeneration = async () => {
    await stopGeneration()
    toast.showSuccess(t('summary.generation_stopped', '已停止生成'))
  }

  const handleConcurrencyChange = (n: number) => {
    setConcurrencyLimitState(n)
    setConcurrency(n)
  }

  return (
    <div className={`summary-page-container ${activeTab === 'gallery' ? 'gallery-mode' : ''}`}>
      <SummaryTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="sp-content">
        <AnimatePresence mode="wait">
          {activeTab === 'panel' ? (
            <motion.div
              key="panel"
              className="sp-panel-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <DashboardHeroBanner />
              <div className="sp-dashboard-layout">
                <DashboardSharedMemoryCard
                  lookbackMonths={lookbackMonths}
                  onMonthsChanged={setLookbackMonths}
                  onCopyContext={handleCopyContext}
                />
                <DashboardStatsCard {...stats} />
              </div>
              <div style={{ marginTop: 8, minWidth: 0 }}>
                <ActivityHeatmap
                  data={activityData}
                  year={selectedYear}
                  availableYears={availableYears}
                  onYearChange={setSelectedYear}
                />
              </div>
              <SummaryMissingSection
                missingSummaries={missingSummaries}
                generationStates={generationStates}
                stats={stats}
                isBatchGenerating={isBatchGenerating}
                isDetectingMissing={isDetectingMissing}
                concurrencyLimit={concurrencyLimit}
                onBatchGenerate={handleBatchGenerate}
                onStopGeneration={handleStopGeneration}
                onConcurrencyChange={handleConcurrencyChange}
                onQueueSingle={async (item) => {
                  const isConfigured = await checkModelConfigured()
                  if (isConfigured) {
                    await queueGeneration([item], concurrencyLimit)
                  }
                }}
                onDetectMissing={() => void refreshMissing()}
              />
            </motion.div>
          ) : (
            <SummaryGalleryView summaries={summaries} onRefreshData={refreshData} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
