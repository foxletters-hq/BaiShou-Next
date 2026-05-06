import React from 'react';
import { Edit3, Trash2, Heart } from 'lucide-react';
import { MarkdownRenderer } from '@baishou/ui';
import { getWeatherEmoji } from '@baishou/shared';

/** 星期几名称 */
const WEEKDAY_NAMES_KEYS = ['diary.weekday.sun', 'diary.weekday.mon', 'diary.weekday.tue', 'diary.weekday.wed', 'diary.weekday.thu', 'diary.weekday.fri', 'diary.weekday.sat'];
const WEEKDAY_NAMES_DEFAULT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/** 月份名称 */
const MONTH_NAMES_KEYS = ['diary.month.jan', 'diary.month.feb', 'diary.month.mar', 'diary.month.apr', 'diary.month.may', 'diary.month.jun', 'diary.month.jul', 'diary.month.aug', 'diary.month.sep', 'diary.month.oct', 'diary.month.nov', 'diary.month.dec'];
const MONTH_NAMES_DEFAULT = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

/** 标签颜色映射 */
const TAG_COLORS = ['tag-blue', 'tag-green', 'tag-orange', 'tag-purple'] as const;

/** 根据标签文本计算颜色类名 */
function getTagColor(tag: string): string {
  const sum = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return TAG_COLORS[sum % TAG_COLORS.length];
}

/** 日记条目数据 */
export interface DiaryEntry {
  id: number;
  date: Date;
  content: string;
  tags: string[];
  preview: string;
  weather?: string;
  mood?: string;
  location?: string;
  isFavorite?: boolean;
}

/** DiaryCard 组件属性 */
interface DiaryCardProps {
  entry: DiaryEntry;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string, fallback?: string) => string;
}

/** 日记卡片组件 */
export const DiaryCard: React.FC<DiaryCardProps> = ({ entry, onClick, onEdit, onDelete, t }) => {
  const day = String(entry.date.getDate()).padStart(2, '0');
  const weekday = t(WEEKDAY_NAMES_KEYS[entry.date.getDay()], WEEKDAY_NAMES_DEFAULT[entry.date.getDay()]);
  const yearMonth = `${entry.date.getFullYear()} · ${t(MONTH_NAMES_KEYS[entry.date.getMonth()], MONTH_NAMES_DEFAULT[entry.date.getMonth()])}`;
  const visibleTags = entry.tags.filter(t => t.trim().length > 0);

  return (
    <div className="diary-card" onClick={onClick}>
      {/* 头部：日期 + 星期 + 收藏 */}
      <div className="diary-card-header">
        <div className="diary-card-date-row">
          <span className="diary-card-day">{day}</span>
          <div className="diary-card-weekday-col">
            <div className="diary-card-weekday-row">
              <span className="diary-card-weekday">{weekday}</span>
              <span className="diary-card-yearmonth">{yearMonth}</span>
            </div>
          </div>
        </div>
        {entry.isFavorite && <Heart size={18} className="diary-card-fav-star" fill="currentColor" />}
      </div>

      {/* 元数据：天气、心情、位置 */}
      {(entry.weather || entry.mood || entry.location) && (
        <div className="diary-card-meta-row">
          {entry.weather && <span className="diary-card-meta-badge">{getWeatherEmoji(entry.weather)} {entry.weather}</span>}
          {entry.mood && <span className="diary-card-meta-badge">{entry.mood}</span>}
          {entry.location && <span className="diary-card-meta-badge">📍 {entry.location}</span>}
        </div>
      )}

      {/* 内容预览 */}
      <div className="diary-card-content">
        <div className="diary-card-content-text">
          <MarkdownRenderer content={entry.preview} />
        </div>
      </div>

      {/* 标签 */}
      {visibleTags.length > 0 && (
        <div className="diary-card-tags">
          {visibleTags.map((tag, idx) => (
            <span key={idx} className={`diary-card-tag ${getTagColor(tag)}`}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 悬停操作按钮 */}
      <div className="diary-card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="diary-card-action-btn edit-btn" onClick={onEdit}>
          <Edit3 size={14} />
          {t('common.edit', '编辑')}
        </button>
        <button className="diary-card-action-btn delete-btn" onClick={onDelete}>
          <Trash2 size={14} />
          {t('common.delete', '删除')}
        </button>
      </div>
    </div>
  );
};
