import React from 'react'
import { useTranslation } from 'react-i18next'
import type { DiaryMeta } from '@baishou/shared'
import { limitDiaryPreviewTags, resolveWeatherId, resolveMoodId } from '@baishou/shared'
import { MoodEmoji } from '../MoodIcon'
import { WeatherEmoji } from '../WeatherIcon'
// @ts-ignore
import styles from './DiaryMetaCard.module.css'

const TAG_STYLES = [styles.tagBlue, styles.tagGreen, styles.tagOrange, styles.tagPurple]

function getTagStyle(tag: string): string {
  const sum = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return TAG_STYLES[sum % TAG_STYLES.length]
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  const s = String(date.getSeconds()).padStart(2, '0')
  return `${h}:${m}:${s}`
}

interface DiaryMetaCardProps {
  meta: DiaryMeta
  onDelete?: () => void
  onClick?: () => void
}

export const DiaryMetaCard: React.FC<DiaryMetaCardProps> = ({ meta, onDelete, onClick }) => {
  const { t } = useTranslation()

  const WEEKDAY_NAMES = [
    t('diary.weekday_sun', '周日'),
    t('diary.weekday_mon', '周一'),
    t('diary.weekday_tue', '周二'),
    t('diary.weekday_wed', '周三'),
    t('diary.weekday_thu', '周四'),
    t('diary.weekday_fri', '周五'),
    t('diary.weekday_sat', '周六')
  ]

  const MONTH_NAMES = [
    t('diary.month_jan', '1月'),
    t('diary.month_feb', '2月'),
    t('diary.month_mar', '3月'),
    t('diary.month_apr', '4月'),
    t('diary.month_may', '5月'),
    t('diary.month_jun', '6月'),
    t('diary.month_jul', '7月'),
    t('diary.month_aug', '8月'),
    t('diary.month_sep', '9月'),
    t('diary.month_oct', '10月'),
    t('diary.month_nov', '11月'),
    t('diary.month_dec', '12月')
  ]

  const d = meta.date instanceof Date ? meta.date : new Date(meta.date)
  const day = String(d.getDate()).padStart(2, '0')
  const weekday = WEEKDAY_NAMES[d.getDay()]
  const yearMonth = `${d.getFullYear()} · ${MONTH_NAMES[d.getMonth()]}`
  const time = formatTime(d)
  const { visibleTags, overflowCount: tagOverflowCount } = limitDiaryPreviewTags(meta.tags)

  return (
    <div className={styles.card} onClick={onClick} data-testid="diary-meta-card">
      {/* Header: Day + Weekday + Year-Month */}
      <div className={styles.header}>
        <div className={styles.dateRow}>
          <span className={styles.day}>{day}</span>
          <div className={styles.weekdayCol}>
            <div className={styles.weekdayRow}>
              <span className={styles.weekday}>{weekday}</span>
              <span className={styles.yearMonth}>{yearMonth}</span>
              {resolveWeatherId(meta.weather) && (
                <span className={styles.iconOutlineBadge}>
                  <WeatherEmoji weather={meta.weather} size={14} />
                </span>
              )}
              {resolveMoodId(meta.mood) && (
                <span className={styles.iconOutlineBadge} title={meta.mood}>
                  <MoodEmoji mood={meta.mood} size={14} />
                </span>
              )}
            </div>
          </div>
        </div>
        <div className={styles.headerRight}>
          {meta.isFavorite && <span className={styles.favStar}>★</span>}
          <span className={styles.menuIcon}>☰</span>
        </div>
      </div>

      {/* Time */}
      <div className={styles.time}>{time}</div>

      {/* Content Preview */}
      <div className={styles.preview}>{meta.preview}</div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className={styles.tagsArea}>
          {visibleTags.map((t, idx) => (
            <span key={idx} className={`${styles.tag} ${getTagStyle(t)}`}>
              #{t}
            </span>
          ))}
          {tagOverflowCount > 0 ? (
            <span className={`${styles.tag} ${styles.tagOverflow}`}>+{tagOverflowCount}</span>
          ) : null}
        </div>
      )}

      {/* Delete button (shows on hover) */}
      {onDelete && (
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          aria-label="delete"
        >
          {t('common.delete', '删除')}
        </button>
      )}
    </div>
  )
}
