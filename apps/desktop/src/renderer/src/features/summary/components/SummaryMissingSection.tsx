import React from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw, XCircle, Clock, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  concurrencyLimit: number
  onBatchGenerate: () => void
  onStopGeneration: () => void
  onConcurrencyChange: (n: number) => void
  onQueueSingle: (item: MissingPeriod) => void
}

/** AI 缺失摘要检测区域（含进度条、任务卡片列表） */
export const SummaryMissingSection: React.FC<SummaryMissingSectionProps> = ({
  missingSummaries,
  generationStates,
  stats,
  isBatchGenerating,
  concurrencyLimit,
  onBatchGenerate,
  onStopGeneration,
  onConcurrencyChange,
  onQueueSingle
}) => {
  const { t, i18n } = useTranslation()
  const { language } = i18n

  const genStatesArr = Object.values(generationStates)
  const genTotal = genStatesArr.length
  const genCompleted = genStatesArr.filter((s) => s.status === 'completed').length
  const genError = genStatesArr.filter((s) => s.status === 'error').length
  const genProgress =
    genTotal > 0
      ? Math.round(genStatesArr.reduce((sum, s) => sum + (s.progress || 0), 0) / genTotal)
      : 0
  const isGenerating = genStatesArr.some((s) => s.status === 'pending' || s.status === 'running')

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
    <motion.div
      style={{ marginTop: 24, paddingBottom: 24 }}
      variants={{
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.1 } }
      }}
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

      {/* 整体进度条（有任务时显示） */}
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
          <div className="sp-progress-actions">
            {isGenerating && (
              <button className="sp-stop-btn" onClick={onStopGeneration}>
                <XCircle size={14} />
                {t('summary.stop', 'Stop')}
              </button>
            )}
            {!isGenerating && (
              <button
                className="sp-batch-generate-btn"
                onClick={onBatchGenerate}
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
              onChange={onConcurrencyChange}
              disabled={isGenerating}
            />
          </div>
        </div>
      )}

      {/* 初始状态（无任务、有待生成项） */}
      {genTotal === 0 && missingSummaries.length > 0 && !isBatchGenerating && (
        <div className="sp-progress-actions" style={{ marginBottom: 12 }}>
          <button
            className="sp-batch-generate-btn"
            onClick={onBatchGenerate}
            disabled={isBatchGenerating}
          >
            <Sparkles size={14} />
            {t('summary.generate_all', '全部生成')}
          </button>
          <ConcurrencyDropdown
            value={concurrencyLimit}
            onChange={onConcurrencyChange}
            disabled={isBatchGenerating}
          />
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
                    <div className="sp-missing-card-title">{mp.label || mp.dateRangeStr}</div>
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

                  {/* 操作按钮区域 */}
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
                      <div className="sp-missing-card-action" onClick={() => onQueueSingle(mp)}>
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
          })}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}
