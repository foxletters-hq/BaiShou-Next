import { useTranslation } from 'react-i18next'
import React, { useState } from 'react'
import './DiaryCard.css'

interface DiaryCardProps {
  id: string
  contentSnippet: string
  tags: string[]
  createdAt: Date
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

// TODO: [Agent1-Dependency] 合并后替换为 import { useTranslation } from 'react-i18next'

export const DiaryCard: React.FC<DiaryCardProps> = ({
  contentSnippet,
  tags,
  createdAt,
  onClick,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation()
  const [isHovered, setIsHovered] = useState(false)

  // 日期格式化 Mock
  const day = createdAt.getDate().toString().padStart(2, '0')
  const year = createdAt.getFullYear()
  const WEEKDAYS = [
    t('diary.weekday_sun', '周日'),
    t('diary.weekday_mon', '周一'),
    t('diary.weekday_tue', '周二'),
    t('diary.weekday_wed', '周三'),
    t('diary.weekday_thu', '周四'),
    t('diary.weekday_fri', '周五'),
    t('diary.weekday_sat', '周六')
  ]
  const MONTH_NAMES = [
    t('diary.month_jan', '一月'),
    t('diary.month_feb', '二月'),
    t('diary.month_mar', '三月'),
    t('diary.month_apr', '四月'),
    t('diary.month_may', '五月'),
    t('diary.month_jun', '六月'),
    t('diary.month_jul', '七月'),
    t('diary.month_aug', '八月'),
    t('diary.month_sep', '九月'),
    t('diary.month_oct', '十月'),
    t('diary.month_nov', '十一月'),
    t('diary.month_dec', '十二月')
  ]
  const weekday = WEEKDAYS[createdAt.getDay()]

  // Tags Color Hash Logic
  const getTagColor = (tag: string) => {
    // Web mock colors based on flutter source
    const colors = [
      { bg: 'rgba(33, 150, 243, 0.1)', fg: '#1976D2' }, // Blue
      { bg: 'rgba(76, 175, 80, 0.1)', fg: '#388E3C' }, // Green
      { bg: 'rgba(255, 152, 0, 0.1)', fg: '#F57C00' }, // Orange
      { bg: 'rgba(156, 39, 176, 0.1)', fg: '#7B1FA2' } // Purple
    ]
    let sum = 0
    for (let i = 0; i < tag.length; i++) sum += tag.charCodeAt(i)
    return colors[sum % colors.length]
  }

  return (
    <div
      className="diary-card-v2"
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="diary-card-v2-header">
        <div className="diary-card-v2-date-group">
          <span className="diary-card-v2-day">{day}</span>
          <div className="diary-card-v2-date-meta">
            <span className="diary-card-v2-weekday">{weekday}</span>
            <div className="diary-card-v2-badge">
              {year} · {MONTH_NAMES[createdAt.getMonth()]}
            </div>
          </div>
        </div>
        <div className="diary-card-v2-icon">📑</div>
      </div>

      <div className="diary-card-v2-content">
        <div className="markdown-snippet-mask">
          <p>{contentSnippet}</p>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="diary-card-v2-tags">
          {tags.map((tag) => {
            const { bg, fg } = getTagColor(tag)
            return (
              <span
                key={tag}
                className="diary-card-v2-tag"
                style={{ backgroundColor: bg, color: fg }}
              >
                #{tag}
              </span>
            )
          })}
        </div>
      )}

      {/* Hover action overlay for desktop */}
      <div className={`diary-card-v2-actions ${isHovered ? 'visible' : ''}`}>
        <div className="actions-divider" />
        <div className="actions-buttons">
          <button
            className="action-btn edit-btn"
            onClick={(e) => {
              e.stopPropagation()
              onEdit?.()
            }}
          >
            ✏️ {t('common.edit') || '编辑'}
          </button>
          <button
            className="action-btn delete-btn"
            onClick={(e) => {
              e.stopPropagation()
              onDelete?.()
            }}
          >
            🗑️ {t('common.delete') || '删除'}
          </button>
        </div>
      </div>
    </div>
  )
}
