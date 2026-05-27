import React from 'react'
import styles from './SummaryGalleryTab.module.css'
import { useTranslation } from 'react-i18next'

export interface GalleryAsset {
  id: string
  url: string
  dateStr: string
  diaryId?: string
}

interface SummaryGalleryTabProps {
  assets: GalleryAsset[]
  onAssetClick?: (asset: GalleryAsset) => void
}

export const SummaryGalleryTab: React.FC<SummaryGalleryTabProps> = ({ assets, onAssetClick }) => {
  const { t, i18n } = useTranslation()

  const formatMonthHeader = (monthKey: string) => {
    const date = new Date(`${monthKey}-01T00:00:00`)
    if (Number.isNaN(date.getTime())) return monthKey
    return date.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long' })
  }
  // Group assets by Month/Year for section headers
  const grouped = assets.reduce(
    (group, asset) => {
      // Extract YYYY-MM
      const month = asset.dateStr.substring(0, 7)
      if (!group[month]) group[month] = []
      group[month].push(asset)
      return group
    },
    {} as Record<string, GalleryAsset[]>
  )

  const months = Object.keys(grouped).sort((a, b) => b.localeCompare(a)) // Newest first

  return (
    <div className={styles.galleryContainer}>
      {months.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>🖼️</div>
          <p>
            {t('gallery.empty_desc', 'No records yet. Add more photos in chats or diary entries!')}
          </p>
        </div>
      ) : (
        months.map((month) => (
          <div key={month} className={styles.monthSection}>
            <div className={styles.monthHeader}>
              <h3>{formatMonthHeader(month)}</h3>
              <span className={styles.countBadge}>
                {grouped[month].length} {t('gallery.record_unit', 'records')}
              </span>
            </div>

            <div className={styles.masonryGrid}>
              {grouped[month].map((asset) => (
                <div
                  key={asset.id}
                  className={styles.imageCard}
                  onClick={() => onAssetClick?.(asset)}
                >
                  <img src={asset.url} alt={`Asset ${asset.id}`} loading="lazy" />
                  <div className={styles.imageOverlay}>
                    <span className={styles.dateLabel}>{asset.dateStr.substring(5)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
