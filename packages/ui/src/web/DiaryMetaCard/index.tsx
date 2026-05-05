import React from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryMeta } from '@baishou/shared';
import { getWeatherEmoji } from '@baishou/shared';
// @ts-ignore
import styles from './DiaryMetaCard.module.css';

const TAG_STYLES = [styles.tagBlue, styles.tagGreen, styles.tagOrange, styles.tagPurple];

function getTagStyle(tag: string): string {
  const sum = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return TAG_STYLES[sum % TAG_STYLES.length];
}

function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

interface DiaryMetaCardProps {
  meta: DiaryMeta;
  onDelete?: () => void;
  onClick?: () => void;
}

export const DiaryMetaCard: React.FC<DiaryMetaCardProps> = ({ meta, onDelete, onClick }) => {
  const { t } = useTranslation();

  const WEEKDAY_NAMES = [
    t('diary.weekday.sunday', '周日'),
    t('diary.weekday.monday', '周一'),
    t('diary.weekday.tuesday', '周二'),
    t('diary.weekday.wednesday', '周三'),
    t('diary.weekday.thursday', '周四'),
    t('diary.weekday.friday', '周五'),
    t('diary.weekday.saturday', '周六'),
  ];

  const MONTH_NAMES = [
    t('diary.month.january', '一月'),
    t('diary.month.february', '二月'),
    t('diary.month.march', '三月'),
    t('diary.month.april', '四月'),
    t('diary.month.may', '五月'),
    t('diary.month.june', '六月'),
    t('diary.month.july', '七月'),
    t('diary.month.august', '八月'),
    t('diary.month.september', '九月'),
    t('diary.month.october', '十月'),
    t('diary.month.november', '十一月'),
    t('diary.month.december', '十二月'),
  ];

  const d = meta.date instanceof Date ? meta.date : new Date(meta.date);
  const day = String(d.getDate()).padStart(2, '0');
  const weekday = WEEKDAY_NAMES[d.getDay()];
  const yearMonth = `${d.getFullYear()} · ${MONTH_NAMES[d.getMonth()]}`;
  const time = formatTime(d);
  const visibleTags = (meta.tags || []).filter(t => t.trim().length > 0);

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

      {/* 元数据：天气、心情、位置 */}
      {(meta.weather || meta.mood || meta.location) && (
        <div className={styles.metaRow}>
          {meta.weather && <span className={styles.metaBadge}>{getWeatherEmoji(meta.weather)} {meta.weather}</span>}
          {meta.mood && <span className={styles.metaBadge}>{meta.mood}</span>}
          {meta.location && <span className={styles.metaBadge}>📍 {meta.location}</span>}
        </div>
      )}

      {/* Content Preview */}
      <div className={styles.preview}>
        {meta.preview}
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className={styles.tagsArea}>
          {visibleTags.map((t, idx) => (
            <span key={idx} className={`${styles.tag} ${getTagStyle(t)}`}>
              #{t}
            </span>
          ))}
        </div>
      )}

      {/* Delete button (shows on hover) */}
      {onDelete && (
        <button
          className={styles.deleteBtn}
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label="delete"
        >
          {t('common.delete', '删除')}
        </button>
      )}
    </div>
  );
};
