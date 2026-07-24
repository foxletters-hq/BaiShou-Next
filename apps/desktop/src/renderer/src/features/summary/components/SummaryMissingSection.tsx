import React from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw, XCircle, Clock, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { getSummaryWeekNumber } from '@baishou/shared'
import { ConcurrencyDropdown } from './ConcurrencyDropdown'

/** 获取任务状态描述文本 */
export const getTaskStatusText = (
  taskState: { progress: number; phase: number; status: string; error?: string } | undefined,

  t: any
): string => {
  if (!taskState) return ''
  const { status, phase, progress, error } = taskState

  if (status === 'pending') return t('summary.preparing', 'Preparing...')
  if (status === 'completed' || progress >= 100) {
    return t('summary.step_done', 'Summary archived and saved.')
  }
  if (status === 'error') {
    return `${t('summary.generation_failed', 'Generation failed')}: ${error || ''}`
  }
  if (status === 'running') {
    if (phase === 0) return t('summary.status_sending', 'Sending request...')
    if (phase === 1) return t('summary.status_reading_data', 'Reading source data...')
    if (phase === 2) {
      return t('summary.status_thinking', 'Thinking...')
        .replace(' ($model)', '')
        .replace('($model)', '')
    }
    if (phase === 3) return t('summary.step_write', 'Receiving AI summary stream...')
    if (progress === 95) return t('summary.status_saving', 'Saving summary...')
  }
  return ''
}

/** 缺失任务项的类型定义 */
export interface MissingPeriod {
  type: string
  startDate: string
  endDate: string
  label?: string
  dateRangeStr?: string
}

interface SummaryMissingSectionProps {
  missingSummaries: MissingPeriod[]
  generationStates: Record<string, any>
  stats: { totalDiaryCount: number }
  isBatchGenerating: boolean
  isDetectingMissing: boolean
  concurrencyLimit: number
  onBatchGenerate: () => void
  onStopGeneration: () => void
  onConcurrencyChange: (n: number) => void
  onQueueSingle: (item: MissingPeriod) => void
  onDetectMissing: () => void
}

/** AI 缺失摘要检测区域（大卡片容器 + 进度条、任务列表） */
export const SummaryMissingSection: React.FC<SummaryMissingSectionProps> = ({
  missingSummaries,
  generationStates,
  stats,
  isBatchGenerating,
  isDetectingMissing,
  concurrencyLimit,
  onBatchGenerate,
  onStopGeneration,
  onConcurrencyChange,
  onQueueSingle,
  onDetectMissing
}) => {
  const { t, i18n } = useTranslation()
  const { language } = i18n

  const buildMissingTitle = (mp: MissingPeriod): string => {
    if (!mp.startDate) return mp.label || mp.dateRangeStr || ''
    const start = new Date(mp.startDate)
    if (mp.type === 'weekly') {
      return t('summary.missing_label_weekly', 'Week $week, $year')
        .replace('$year', String(start.getFullYear()))
        .replace('$week', String(getSummaryWeekNumber(start)))
    }
    if (mp.type === 'monthly') {
      return t('summary.title_monthly', 'Monthly Report ($year-$month)')
        .replace('$year', String(start.getFullYear()))
        .replace('$month', String(start.getMonth() + 1))
    }
    if (mp.type === 'quarterly') {
      return t('summary.missing_label_quarterly', '$year Q$q')
        .replace('$year', String(start.getFullYear()))
        .replace('$q', String(Math.ceil((start.getMonth() + 1) / 3)))
    }
    if (mp.type === 'yearly') {
      return t('summary.missing_label_yearly', 'Year $year').replace(
        '$year',
        String(start.getFullYear())
      )
    }
    return mp.label || mp.dateRangeStr || ''
  }

  const genStatesArr = Object.values(generationStates)
  const genTotal = genStatesArr.length
  const genCompleted = genStatesArr.filter((s) => s.status === 'completed').length
  const genError = genStatesArr.filter((s) => s.status === 'error').length
  const genProgress =
    genTotal > 0
      ? Math.round(genStatesArr.reduce((sum, s) => sum + (s.progress || 0), 0) / genTotal)
      : 0
  const isGenerating = genStatesArr.some((s) => s.status === 'pending' || s.status === 'running')
  const showSection = missingSummaries.length > 0 || stats.totalDiaryCount > 0

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
      overflow: 'hidden' as const,
      padding: 0,
      margin: 0,
      transition: { duration: 0.4 }
    }
  }

  if (!showSection) return null

  return (
    <motion.div
      className="sp-missing-panel"
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
      }}
      initial="hidden"
      animate="show"
    >
      <div className="sp-missing-panel-header">
        <div className="sp-missing-panel-title">
          <Sparkles size={16} strokeWidth={1.75} className="sp-missing-panel-title-icon" />
          <span>{t('summary.ai_suggestions', 'AI 建议补全')}</span>
          <span className="sp-missing-count">
            {t('common.count_items', '$count个').replace(
              '$count',
              missingSummaries.length.toString()
            )}
          </span>
        </div>
        <button
          type="button"
          className="sp-outline-btn"
          onClick={onDetectMissing}
          disabled={isDetectingMissing || isGenerating}
          title={t('summary.detect_missing', '重新检测')}
        >
          <RefreshCw size={14} strokeWidth={1.75} className={isDetectingMissing ? 'sp-detect-spin' : ''} />
          <span>
            {isDetectingMissing
              ? t('summary.detecting_missing', '检测中...')
              : t('summary.detect_missing', '重新检测')}
          </span>
        </button>
      </div>

      {(genTotal > 0 || (genTotal === 0 && missingSummaries.length > 0 && !isBatchGenerating)) && (
        <div className="sp-missing-panel-toolbar">
          {genTotal > 0 && (
            <div className="sp-progress-bar-wrap">
              <div className="sp-progress-bar">
                <div className="sp-progress-bar-fill" style={{ width: `${genProgress}%` }} />
              </div>
              <div className="sp-progress-text">
                {genCompleted}/{genTotal}
                {genError > 0 && (
                  <span className="sp-progress-error">
                    {' '}
                    ({t('summary.failed_count', '{{count}} failed', { count: genError })})
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="sp-progress-actions">
            {isGenerating && (
              <button type="button" className="sp-stop-btn" onClick={onStopGeneration}>
                <XCircle size={14} strokeWidth={1.75} />
                {t('summary.stop', 'Stop')}
              </button>
            )}
            {!isGenerating && (genTotal > 0 || missingSummaries.length > 0) && (
              <button
                type="button"
                className="sp-outline-btn"
                onClick={onBatchGenerate}
                disabled={isBatchGenerating}
              >
                <Sparkles size={14} strokeWidth={1.75} />
                {isBatchGenerating
                  ? t('summary.generating', '生成中...')
                  : t('summary.generate_all', '全部生成')}
              </button>
            )}
            <ConcurrencyDropdown
              value={concurrencyLimit}
              onChange={onConcurrencyChange}
              disabled={isGenerating || isBatchGenerating}
            />
          </div>
        </div>
      )}

      <div className="sp-missing-grid">
        {missingSummaries.length === 0 && stats.totalDiaryCount > 0 && (
          <div className="sp-missing-empty">{t('summary.no_missing', '暂无待合并生成')}</div>
        )}
        <AnimatePresence>
          {missingSummaries.map((mp) => {
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
                className="sp-missing-item"
              >
                <div className="sp-missing-card">
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
                    <div className="sp-missing-card-title">{buildMissingTitle(mp)}</div>
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

                  <div>
                    {isRunning && progress < 100 ? (
                      <div className="sp-missing-card-action processing">
                        <RefreshCw
                          size={16}
                          strokeWidth={1.75}
                          className="sp-missing-card-action-icon spinning"
                        />
                      </div>
                    ) : isPending ? (
                      <div className="sp-missing-card-action processing">
                        <Clock size={16} strokeWidth={1.75} className="sp-missing-card-action-icon muted" />
                      </div>
                    ) : isCompleted || (taskState && progress >= 100) ? (
                      <div className="sp-missing-card-action processing">
                        <CheckCircle2
                          size={18}
                          strokeWidth={1.75}
                          className="sp-missing-card-action-icon success"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="sp-missing-card-action"
                        onClick={() => onQueueSingle(mp)}
                        title={t('summary.generate_now', '立即生成日记总结')}
                        aria-label={t('summary.generate_now', '立即生成日记总结')}
                      >
                        <Sparkles size={16} strokeWidth={1.5} className="sp-missing-card-action-icon" />
                      </button>
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
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
