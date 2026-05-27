import { useTranslation } from 'react-i18next'
import React, { useState, useEffect, useRef } from 'react'
import {
  DashboardHeroBanner,
  DashboardStatsCard,
  DashboardSharedMemoryCard,
  ActivityHeatmap,
  useToast
} from '@baishou/ui'
import type { ActivityData } from '@baishou/ui'
import { motion, AnimatePresence } from 'framer-motion'
import { useSummaryData } from './hooks/useSummaryData'
import { SummaryTabBar } from './components/SummaryTabBar'
import { SummaryMissingSection } from './components/SummaryMissingSection'
import { SummaryGalleryView } from './components/SummaryGalleryView'
import './SummaryPage.css'

export const SummaryPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel')
  const [lookbackMonths, setLookbackMonths] = useState(1)
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [concurrencyLimit, setConcurrencyLimitState] = useState(3)
  const [activityData, setActivityData] = useState<ActivityData[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])

  const {
    summaries,
    stats,
    missingSummaries,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    generationStates,
    refreshData
  } = useSummaryData()

  const prevStatesRef = useRef<typeof generationStates>({})

  /** 首次加载：获取所有年份数据构建年份下拉 */
  useEffect(() => {
    const initActivityData = async () => {
      if (typeof window === 'undefined' || !window.electron) return
      try {
        const allData = await window.electron.ipcRenderer.invoke('diary:activityData', null)
        const yearSet = new Set<number>()
        if (allData && allData.length > 0) {
          allData.forEach((d: ActivityData) => {
            const y = parseInt(d.date.substring(0, 4), 10)
            if (!isNaN(y)) yearSet.add(y)
          })
        }
        const years = Array.from(yearSet).sort((a, b) => a - b)
        if (years.length === 0) years.push(new Date().getFullYear())
        setAvailableYears(years)
        if (!years.includes(selectedYear)) setSelectedYear(years[years.length - 1]!)
        setActivityData(
          (allData || []).filter((d: ActivityData) => d.date.startsWith(`${selectedYear}-`))
        )
      } catch (e) {
        console.warn('[SummaryPage] init activity data failed:', e)
      }
    }
    initActivityData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** 切换年份时按年份过滤数据 */
  useEffect(() => {
    if (typeof window === 'undefined' || !window.electron) return
    window.electron.ipcRenderer
      .invoke('diary:activityData', selectedYear)
      .then((data: ActivityData[]) => setActivityData(data || []))
      .catch((e: any) => console.warn('[SummaryPage] fetch year failed:', e))
  }, [selectedYear])

  /** 监听生成状态变化，弹出错误提示 */
  useEffect(() => {
    Object.keys(generationStates).forEach((uKey) => {
      const cur = generationStates[uKey]
      const prev = prevStatesRef.current[uKey]
      if (cur.status === 'error' && (!prev || prev.status !== 'error')) {
        const errText = cur.error?.includes('active provider')
          ? t('summary.model_not_configured', '模型未配置')
          : cur.error || t('common.error', '错误')
        toast.showError(`${t('summary.generation_failed', '生成失败')}: ${errText}`)
      }
    })
    prevStatesRef.current = generationStates
  }, [generationStates, t, toast])

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
    } catch (e: any) {
      console.error('[SummaryPage] Copy failed:', e)
      toast.showError(`${t('common.copy_failed', '复制失败')}: ${e?.message || String(e)}`)
    }
  }

  const handleBatchGenerate = async () => {
    if (isBatchGenerating) return
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
                concurrencyLimit={concurrencyLimit}
                onBatchGenerate={handleBatchGenerate}
                onStopGeneration={handleStopGeneration}
                onConcurrencyChange={handleConcurrencyChange}
                onQueueSingle={(item) => queueGeneration([item], concurrencyLimit)}
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
