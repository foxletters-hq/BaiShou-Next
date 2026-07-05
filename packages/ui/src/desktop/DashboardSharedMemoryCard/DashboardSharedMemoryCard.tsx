import React, { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, HelpCircle, Loader2, TextQuote } from 'lucide-react'
import type { SharedMemoryCopyPreview } from '@baishou/shared'
import { Tooltip } from '../Tooltip/Tooltip'
import { useDialog } from '../Dialog'
import { formatCompactTokenCount } from '../../shared/token-usage-display'
import './DashboardSharedMemoryCard.css'

interface DashboardSharedMemoryCardProps {
  lookbackMonths: number
  onMonthsChanged: (val: number) => void
  onCopyContext: () => void | Promise<void>
  copyPreview?: SharedMemoryCopyPreview | null
  copyPreviewLoading?: boolean
  copyPrefix?: string
  onCopyPrefixChange?: (prefix: string) => void
}

function SharedMemoryCopyPreviewPanel({
  preview,
  loading
}: {
  preview?: SharedMemoryCopyPreview | null
  loading?: boolean
}) {
  const { t } = useTranslation()

  if (loading && !preview) {
    return (
      <div className="sm-preview sm-previewLoading">
        <Loader2 size={14} className="sm-previewSpinner" />
        <span>{t('summary.copy_preview_loading', '正在统计可复制内容…')}</span>
      </div>
    )
  }

  if (!preview) return null

  const chips: { key: string; label: string; count: number }[] = [
    {
      key: 'diary',
      label: t('summary.copy_preview_diary', '日记'),
      count: preview.diary
    },
    {
      key: 'yearly',
      label: t('summary.copy_preview_yearly', '年总结'),
      count: preview.yearly
    },
    {
      key: 'quarterly',
      label: t('summary.copy_preview_quarterly', '季度总结'),
      count: preview.quarterly
    },
    {
      key: 'monthly',
      label: t('summary.copy_preview_monthly', '月总结'),
      count: preview.monthly
    },
    {
      key: 'weekly',
      label: t('summary.copy_preview_weekly', '周总结'),
      count: preview.weekly
    }
  ].filter((item) => item.count > 0)

  return (
    <div className="sm-preview">
      <div className="sm-previewTitle">
        {t('summary.copy_preview_title', '复制将包含')}
        {loading ? <Loader2 size={12} className="sm-previewSpinnerInline" /> : null}
      </div>
      {preview.total === 0 ? (
        <p className="sm-previewEmpty">
          {t('summary.copy_preview_empty', '当前回溯范围内暂无可复制内容')}
        </p>
      ) : (
        <>
          <div className="sm-previewChips">
            {chips.map((item) => (
              <span key={item.key} className="sm-previewChip">
                {item.label} {item.count}
                {t('summary.copy_preview_unit', '篇')}
              </span>
            ))}
          </div>
          <p className="sm-previewTotal">
            {t('summary.copy_preview_total', '共 {{count}} 项', { count: preview.total })}
          </p>
          <p className="sm-previewSize">
            {t('summary.copy_preview_estimated_size', '约 {{chars}} 字 · 约 {{tokens}} tokens', {
              chars: preview.estimatedChars.toLocaleString(),
              tokens: formatCompactTokenCount(preview.estimatedTokens)
            })}
          </p>
        </>
      )}
    </div>
  )
}

export const DashboardSharedMemoryCard: React.FC<DashboardSharedMemoryCardProps> = ({
  lookbackMonths,
  onMonthsChanged,
  onCopyContext,
  copyPreview,
  copyPreviewLoading,
  copyPrefix = '',
  onCopyPrefixChange
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const [copying, setCopying] = useState(false)

  const handleCopyPress = useCallback(async () => {
    if (copying) return
    setCopying(true)
    try {
      await onCopyContext()
    } finally {
      setCopying(false)
    }
  }, [copying, onCopyContext])

  const handlePrefixSettings = useCallback(async () => {
    if (!onCopyPrefixChange) return
    const next = await dialog.prompt(
      t('summary.copy_prefix_hint', '会自动附加在拷贝内容的最前方（例如：Hi，这是我的回忆...）'),
      copyPrefix,
      t('summary.copy_prefix_label', '拷贝前缀'),
      true
    )
    if (next != null) {
      onCopyPrefixChange(next)
    }
  }, [copyPrefix, dialog, onCopyPrefixChange, t])

  return (
    <div className="dashboard-shared-memory-card">
      <div className="sm-header">
        <div className="sm-header-main">
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="var(--color-primary)"
            className="sm-header-icon"
            style={{ marginRight: 8 }}
          >
            <path d="M10.74 13.91l-1.92-2.1c.96-1.55 1.57-3.05 1.83-4.5h-1.9c-.43 0-.82-.28-.95-.69a1.002 1.002 0 0 1 .95-1.31h4.08c.55 0 1 .45 1 1 0 3.01-1.28 5.76-3.09 7.6zM18.74 13.91l-1.92-2.1c.96-1.55 1.57-3.05 1.83-4.5h-1.9c-.43 0-.82-.28-.95-.69a1.002 1.002 0 0 1 .95-1.31h4.08c.55 0 1 .45 1 1 0 3.01-1.28 5.76-3.09 7.6z" />
          </svg>
          <span className="sm-header-title">{t('summary.shared_memory', '共同回忆')}</span>
          <Tooltip
            content={t(
              'summary.shared_memory_tooltip',
              '共同回忆统计展示您在设定时间周期内的核心足迹与情感波动数据。系统通过级联折叠算法在后台自动整合历史快照数据，去除重复啰嗦内容，将海量原始流水账压缩为符合 LLM 极窄上下文容量的高浓度叙事，方便 AI 快速理解您的近期现状。'
            )}
          >
            <span className="sm-help-icon-wrapper">
              <HelpCircle size={15} />
            </span>
          </Tooltip>
        </div>
        {onCopyPrefixChange ? (
          <Tooltip content={t('summary.copy_prefix_label', '拷贝前缀')}>
            <button
              type="button"
              className="sm-prefix-btn"
              onClick={() => void handlePrefixSettings()}
              aria-label={t('summary.copy_prefix_label', '拷贝前缀')}
            >
              <TextQuote size={16} />
            </button>
          </Tooltip>
        ) : null}
      </div>

      <div className="sm-controls">
        <div className="sm-label-row">
          <span className="sm-label">{t('summary.lookback_label', 'Lookback (months)')}</span>
          <input
            type="number"
            min="1"
            max="120"
            value={lookbackMonths}
            onChange={(e) => onMonthsChanged(Math.max(1, parseInt(e.target.value) || 1))}
            className="sm-number-input"
          />
        </div>
        <div className="sm-slider-container">
          <input
            type="range"
            min="1"
            max="60"
            value={lookbackMonths}
            onChange={(e) => onMonthsChanged(Number(e.target.value))}
            className="sm-slider"
            style={{
              backgroundSize: `${((lookbackMonths - 1) * 100) / 59}% 100%`
            }}
          />
        </div>
      </div>

      <SharedMemoryCopyPreviewPanel preview={copyPreview} loading={copyPreviewLoading} />

      <button
        type="button"
        className="sm-btn"
        onClick={() => void handleCopyPress()}
        disabled={copying}
      >
        {copying ? (
          <Loader2 size={16} className="sm-previewSpinner" style={{ marginRight: 6 }} />
        ) : (
          <Copy size={16} style={{ marginRight: 6 }} />
        )}
        {t('summary.copy_memories', '复制共同回忆')}
      </button>
    </div>
  )
}
