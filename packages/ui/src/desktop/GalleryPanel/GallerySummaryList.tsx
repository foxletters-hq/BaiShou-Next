import React from 'react'
import { useTranslation } from 'react-i18next'
import { Edit3 } from 'lucide-react'
import type { SummaryItem } from './gallery-panel.types'
import { formatDateRange, getTitle, getPreview } from './gallery-panel.utils'

interface GallerySummaryListProps {
  items: SummaryItem[]
  selectedSummary?: SummaryItem
  language: string
  onItemClick: (id: string) => void
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void
}

export const GallerySummaryList: React.FC<GallerySummaryListProps> = ({
  items,
  selectedSummary,
  language,
  onItemClick,
  onScroll
}) => {
  const { t } = useTranslation()

  return (
    <div className="gallery-list" onScroll={onScroll}>
      {items.length === 0 ? (
        <div className="gallery-list-empty">
          <Edit3 size={32} className="gallery-empty-icon" />
          <div className="gallery-empty-text">{t('diary.no_content', '暂无内容')}</div>
        </div>
      ) : (
        items.map((item) => {
          const id = String(item.id ?? '')
          const isSelected = selectedSummary?.id === item.id
          const preview = getPreview(item.content)

          return (
            <div
              key={id}
              className={`gallery-list-item ${isSelected ? 'selected' : ''}`}
              onClick={() => onItemClick(id)}
            >
              <div className="gallery-list-item-header">
                <span className="gallery-list-item-title">{getTitle(item, t)}</span>
                {item.type === 'weekly' && (
                  <span className="gallery-list-item-date">
                    {formatDateRange(item, language, t)}
                  </span>
                )}
              </div>
              {preview && <div className="gallery-list-item-preview">{preview}</div>}
            </div>
          )
        })
      )}
    </div>
  )
}
