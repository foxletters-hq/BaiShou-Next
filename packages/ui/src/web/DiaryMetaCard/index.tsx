import React from 'react';
import type { DiaryMeta } from '@baishou/shared';
// @ts-ignore
import styles from './DiaryMetaCard.module.css';

const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
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
        <span className={styles.menuIcon}>☰</span>
      </div>

      {/* Time */}
      <div className={styles.time}>{time}</div>

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
          删除
        </button>
      )}
    </div>
  );
};
