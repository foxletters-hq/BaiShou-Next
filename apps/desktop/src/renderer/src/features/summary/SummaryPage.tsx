import { useTranslation } from 'react-i18next'
import React, { useState, useEffect, useRef } from 'react'
import {
  GalleryPanel,
  DashboardHeroBanner,
  DashboardStatsCard,
  DashboardSharedMemoryCard,
  ActivityHeatmap,
  useToast,
  useDialog
} from '@baishou/ui'
import type { ActivityData } from '@baishou/ui'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Layers,
  Sparkles,
  CheckCircle2,
  Gauge,
  RefreshCw,
  XCircle,
  Clock
} from 'lucide-react'
import { useSummaryData } from './hooks/useSummaryData'
import './SummaryPage.css'

/** 并发数下拉选择器属性 */
interface ConcurrencyDropdownProps {
  value: number
  onChange: (n: number) => void
  disabled: boolean
  t: (key: string, fallback?: string) => string
}

/** 并发数下拉选择器 */
const ConcurrencyDropdown: React.FC<ConcurrencyDropdownProps> = ({
  value,
  onChange,
  disabled,
  t
}) => {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="concurrency-dropdown">
      <button
        className="concurrency-trigger"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
      >
        <Gauge size={14} className="concurrency-trigger-icon" />
        <span className="concurrency-trigger-text">
          {t('summary.concurrency', '并发')}: {value}
        </span>
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
          <div className="concurrency-menu">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className={`concurrency-option ${n === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(n)
                  setOpen(false)
                }}
              >
                {t('summary.concurrency', '并发')}: {n}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

const getTaskStatusText = (
  taskState: { progress: number; phase: number; status: string; error?: string } | undefined,
  t: any
): string => {
  if (!taskState) return ''
  const { status, phase, progress, error } = taskState

  if (status === 'pending') {
    return t('summary.preparing', '准备中...')
  }
  if (status === 'completed' || progress >= 100) {
    return t('summary.step_done', '摘要归档完毕，已永久存盘。')
  }
  if (status === 'error') {
    return `${t('summary.generation_failed', '生成失败')}: ${error || ''}`
  }
  if (status === 'running') {
    if (phase === 0) {
      return t('summary.status_sending', '发送请求中...')
    }
    if (phase === 1) {
      return t('summary.status_reading_data', '正在解析源数据...')
    }
    if (phase === 2) {
      return t('summary.status_thinking', '正在思考...')
        .replace(' ($model)', '')
        .replace('($model)', '')
    }
    if (phase === 3) {
      return t('summary.step_write', 'AI 总结正流式接收生成...')
    }
    if (progress === 95) {
      return t('summary.status_saving', '正在保存总结...')
    }
  }
  return ''
}

export const SummaryPage: React.FC = () => {
  const { t, i18n } = useTranslation()
  const { language } = i18n
  const toast = useToast()
  const dialog = useDialog()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'panel' | 'gallery'>('panel')
  const [lookbackMonths, setLookbackMonths] = useState(1)
  const [isBatchGenerating, setIsBatchGenerating] = useState(false)
  const [concurrencyLimit, setConcurrencyLimitState] = useState(3)

  const handleConcurrencyChange = (n: number) => {
    setConcurrencyLimitState(n)
    setConcurrency(n)
  }
  const {
    summaries,
    stats,
    missingSummaries,
    setMissingSummaries,
    queueGeneration,
    stopGeneration,
    setConcurrency,
    generationStates,
    refreshData
  } = useSummaryData()
  const [activityData, setActivityData] = useState<ActivityData[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()])

  const prevStatesRef = useRef<typeof generationStates>({})

  // 计算批量生成进度
  const genStatesArr = Object.values(generationStates)
  const genTotal = genStatesArr.length
  const genCompleted = genStatesArr.filter((s) => s.status === 'completed').length
  const genError = genStatesArr.filter((s) => s.status === 'error').length
  const genProgress =
    genTotal > 0
      ? Math.round(genStatesArr.reduce((sum, s) => sum + (s.progress || 0), 0) / genTotal)
      : 0
  const isGenerating = genStatesArr.some((s) => s.status === 'pending' || s.status === 'running')

  /** 计算周数 */
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const diff = date.getTime() - firstDayOfYear.getTime()
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
  }

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

    // 找出尚未处于生成状态的项，加入待处理队列
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

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 15, scale: 0.98 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: 'spring' as const, stiffness: 300, damping: 25 }
    },
    exit: {
      opacity: 0,
      height: 0,
      overflow: 'hidden',
      padding: 0,
      margin: 0,
      transition: { duration: 0.4 }
    }
  }

  return (
    <div className={`summary-page-container ${activeTab === 'gallery' ? 'gallery-mode' : ''}`}>
      {/* 顶部标签栏 Chrome Style */}
      <div className="sp-header">
        <div className="sp-tabs">
          <div
            className={`sp-tab ${activeTab === 'panel' ? 'active' : ''}`}
            onClick={() => setActiveTab('panel')}
          >
            <LayoutDashboard size={18} /> {t('summary.panel_tab', '大盘概况')}
          </div>
          <div
            className={`sp-tab ${activeTab === 'gallery' ? 'active' : ''}`}
            onClick={() => setActiveTab('gallery')}
          >
            <Layers size={18} /> {t('summary.memory_gallery', '归档画廊')}
          </div>
        </div>
      </div>

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

            {/* AI 缺失自动检测区域 */}
            <motion.div
              style={{ marginTop: 24, paddingBottom: 24 }}
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
              {(missingSummaries.length > 0 || stats.totalDiaryCount > 0) && (
                <div className="sp-missing-section-title">
                  <Sparkles size={18} color="var(--color-warning)" />
                  <span>{t('summary.ai_suggestions', 'AI 建议补全')}</span>

                  <div className="sp-missing-count">
                    {t('common.count_items', '$count个').replace(
                      '$count',
                      missingSummaries.length.toString()
                    )}
                  </div>
                </div>
              )}

              {/* 进度条 */}
              {genTotal > 0 && (
                <div className="sp-progress-bar-wrap">
                  <div className="sp-progress-bar">
                    <div className="sp-progress-bar-fill" style={{ width: `${genProgress}%` }} />
                  </div>
                  <div className="sp-progress-text">
                    {genCompleted}/{genTotal}
                    {genError > 0 && <span className="sp-progress-error"> ({genError} 失败)</span>}
                  </div>
                  <div className="sp-progress-actions">
                    {isGenerating && (
                      <button className="sp-stop-btn" onClick={handleStopGeneration}>
                        <XCircle size={14} />
                        {t('summary.stop', '停止')}
                      </button>
                    )}
                    {!isGenerating && (
                      <button
                        className="sp-batch-generate-btn"
                        onClick={handleBatchGenerate}
                        disabled={isBatchGenerating}
                      >
                        <Sparkles size={14} />
                        {isBatchGenerating
                          ? t('summary.generating', '生成中...')
                          : t('summary.generate_all', '全部生成')}
                      </button>
                    )}
                    <ConcurrencyDropdown
                      value={concurrencyLimit}
                      onChange={handleConcurrencyChange}
                      disabled={isGenerating}
                      t={t as any}
                    />
                  </div>
                </div>
              )}
              {genTotal === 0 && missingSummaries.length > 0 && !isBatchGenerating && (
                <div className="sp-progress-actions" style={{ marginBottom: 12 }}>
                  <button
                    className="sp-batch-generate-btn"
                    onClick={handleBatchGenerate}
                    disabled={isBatchGenerating}
                  >
                    <Sparkles size={14} />
                    {t('summary.generate_all', '全部生成')}
                  </button>
                  <ConcurrencyDropdown
                    value={concurrencyLimit}
                    onChange={handleConcurrencyChange}
                    disabled={isBatchGenerating}
                    t={t as any}
                  />
                </div>
              )}

              <div className="sp-missing-grid">
                {missingSummaries.length === 0 && stats.totalDiaryCount > 0 && (
                  <div className="sp-missing-empty">
                    {t('summary.no_missing', '暂无待合并生成')}
                  </div>
                )}
                <AnimatePresence>
                  {missingSummaries.map(
                    (mp: {
                      type: string
                      startDate: string
                      endDate: string
                      label?: string
                      dateRangeStr?: string
                    }) => {
                      const uKey = `${mp.type}_${new Date(mp.startDate).getTime()}`
                      const taskState = generationStates[uKey]
                      const isRunning = taskState?.status === 'running'
                      const isPending = taskState?.status === 'pending'
                      const isCompleted = taskState?.status === 'completed'
                      const progress = taskState?.progress || 0

                      const statusText = getTaskStatusText(taskState, t)

                      return (
                        <motion.div
                          key={uKey}
                          variants={itemVariants}
                          exit="exit"
                          style={{ display: 'flex', flexDirection: 'column', width: '100%' }}
                        >
                          <div className="sp-missing-card">
                            {/* 图标区域 */}
                            <div className="sp-missing-card-icon">
                              <span style={{ fontSize: 20 }}>
                                {mp.type === 'weekly'
                                  ? '🌱'
                                  : mp.type === 'monthly'
                                    ? '☘️'
                                    : mp.type === 'quarterly'
                                      ? '🪴'
                                      : '🌳'}
                              </span>
                            </div>

                            <div className="sp-missing-card-body">
                              <div className="sp-missing-card-title">
                                {mp.label || mp.dateRangeStr}
                              </div>
                              <div className="sp-missing-card-meta">
                                <span className="sp-missing-card-date">
                                  {mp.startDate &&
                                    new Date(mp.startDate).toLocaleDateString(language, {
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                  {' - '}
                                  {mp.endDate &&
                                    new Date(mp.endDate).toLocaleDateString(language, {
                                      month: 'short',
                                      day: 'numeric'
                                    })}
                                </span>
                                <span className="sp-missing-card-badge">
                                  {t('summary.suggestion_generate', '建议生成')}
                                </span>
                              </div>
                            </div>

                            {/* 按钮区域 */}
                            <div>
                              {isRunning && progress < 100 ? (
                                <div className="sp-missing-card-action processing">
                                  <style>{`@keyframes baishouSpin { 100% { transform: rotate(360deg); } }`}</style>
                                  <RefreshCw
                                    size={20}
                                    className="concurrency-trigger-icon"
                                    style={{ animation: 'baishouSpin 1.5s linear infinite' }}
                                  />
                                </div>
                              ) : isPending ? (
                                <div className="sp-missing-card-action processing">
                                  <Clock size={20} color="var(--text-tertiary)" />
                                </div>
                              ) : isCompleted || (taskState && progress >= 100) ? (
                                <div className="sp-missing-card-action processing">
                                  <CheckCircle2 size={22} color="var(--color-success)" />
                                </div>
                              ) : (
                                <div
                                  className="sp-missing-card-action"
                                  onClick={() => queueGeneration([mp], concurrencyLimit)}
                                >
                                  <Sparkles size={18} />
                                </div>
                              )}
                            </div>
                          </div>
                          <AnimatePresence>
                            {statusText && (
                              <motion.div
                                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                animate={{ opacity: 1, height: 'auto', marginTop: 8 }}
                                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                transition={{ duration: 0.2 }}
                                className={`sp-missing-card-status ${taskState?.status || ''}`}
                              >
                                <span className="sp-status-bullet" />
                                <span className="sp-status-text">{statusText}</span>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      )
                    }
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div
            key="gallery"
            className="sp-gallery-view"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <GalleryPanel
              summaries={summaries}
              onOpen={(id) => {
                // 点击列表项只切换视图，不进入编辑
                // GalleryPanel 内部会处理选中状态
              }}
              onEdit={(id) => {
                // 点击编辑按钮跳转到详情页
                navigate(`/summary/${id}`)
              }}
              onSave={async (id, content) => {
                const summary = summaries.find((s) => String(s.id) === id)
                if (!summary) return
                try {
                  await window.electron.ipcRenderer.invoke(
                    'summary:update',
                    summary.id,
                    summary.type,
                    new Date(summary.startDate),
                    new Date(summary.endDate),
                    { content }
                  )
                  toast.showSuccess(t('common.save_success', '保存成功'))
                  await refreshData()
                } catch (e) {
                  console.error('[SummaryPage] save error:', e)
                  toast.showError(t('common.save_failed', '保存失败'))
                  throw e
                }
              }}
              onDelete={async (id) => {
                const summary = summaries.find((s) => String(s.id) === id)
                if (!summary) return

                // 确认删除
                const title =
                  summary.type === 'weekly'
                    ? t('summary.card_week_title', '第 $week 周').replace(
                        '$week',
                        String(getWeekNumber(new Date(summary.startDate)))
                      )
                    : summary.type === 'monthly'
                      ? t('summary.card_month_title', '$month月').replace(
                          '$month',
                          String(new Date(summary.startDate).getMonth() + 1)
                        )
                      : summary.type === 'quarterly'
                        ? t('summary.missing_label_quarterly', '$year年Q$q')
                            .replace('$year', String(new Date(summary.startDate).getFullYear()))
                            .replace(
                              '$q',
                              String(Math.ceil((new Date(summary.startDate).getMonth() + 1) / 3))
                            )
                        : t('summary.card_year_suffix', '$year年').replace(
                            '$year',
                            String(new Date(summary.startDate).getFullYear())
                          )

                const confirmed = await dialog.confirm(
                  t(
                    'summary.delete_confirm',
                    '确定要删除「$title」的总结吗？此操作不可撤销。'
                  ).replace('$title', title)
                )
                if (confirmed) {
                  try {
                    await window.electron.ipcRenderer.invoke(
                      'summary:delete',
                      summary.type,
                      new Date(summary.startDate),
                      new Date(summary.endDate)
                    )
                    toast.showSuccess(t('common.delete_success', '已删除'))
                    refreshData()
                  } catch (e) {
                    console.error('[SummaryPage] delete error:', e)
                    toast.showError(t('common.delete_failed', '删除失败'))
                  }
                }
              }}
            />
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  )
}
