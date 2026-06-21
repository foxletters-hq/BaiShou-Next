import { useTranslation } from 'react-i18next'
import React from 'react'
import { Copy, HelpCircle } from 'lucide-react'
import { Tooltip } from '../Tooltip/Tooltip'
import { useDialog } from '../Dialog'
import './DashboardSharedMemoryCard.css'

interface DashboardSharedMemoryCardProps {
  lookbackMonths: number
  onMonthsChanged: (val: number) => void
  onCopyContext: () => void
}

export const DashboardSharedMemoryCard: React.FC<DashboardSharedMemoryCardProps> = ({
  lookbackMonths,
  onMonthsChanged,
  onCopyContext
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()

  return (
    <div className="dashboard-shared-memory-card">
      <div className="sm-header">
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

      <p className="sm-desc">
        {t(
          'summary.shared_memory_desc',
          'Adjust the lookback months to export recent summary context for RAG or LLMs.'
        )}
      </p>

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

      <button className="sm-btn" onClick={onCopyContext}>
        <Copy size={16} style={{ marginRight: 6 }} /> {t('summary.copy_memories', '复制共同回忆')}
      </button>
    </div>
  )
}
