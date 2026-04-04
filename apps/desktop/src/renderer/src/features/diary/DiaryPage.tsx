import { useTranslation } from 'react-i18next';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Calendar, Edit, Trash2, AlignJustify } from 'lucide-react';
import { useDiaryData } from './hooks/useDiaryData';
import './DiaryPage.css';

// 星期几名称
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

// 标签颜色映射
const TAG_COLORS = ['tag-blue', 'tag-green', 'tag-orange', 'tag-purple'] as const;
import { YearMonthPicker } from '@baishou/ui';

function getTagColor(tag: string): string {
  const sum = tag.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  return TAG_COLORS[sum % TAG_COLORS.length];
}

// 格式化时间
function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

interface DiaryEntry {
  id: number;
  date: Date;
  content: string;
  tags: string[];
  preview: string;
}

export const DiaryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const { entries } = useDiaryData();

  // Click outside closed natively by YearMonthPicker now


  // 处理过滤
  const filteredEntries = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    
    let filtered = [...entries].map(e => {
      const d = new Date(e.date || e.createdAt || Date.now());
      return {
        id: e.id,
        date: d,
        content: e.content || '',
        tags: e.tags || [],
        preview: e.content?.substring(0, 500) || ''
      } as DiaryEntry;
    });

    // 月份过滤
    if (selectedMonth) {
      filtered = filtered.filter(e => 
        e.date.getFullYear() === selectedMonth.getFullYear() &&
        e.date.getMonth() === selectedMonth.getMonth()
      );
    }

    // 搜索过滤
    if (searchQuery.trim()) {
      const lowerQ = searchQuery.trim().toLowerCase();
      filtered = filtered.filter(e => 
        e.preview.toLowerCase().includes(lowerQ) ||
        e.tags.some(tag => tag.toLowerCase().includes(lowerQ))
      );
    }

    // 按日期降序排序
    filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

    return filtered;
  }, [entries, selectedMonth, searchQuery]);

  return (
    <div className="diary-page-container">
      {/* AppBar */}
      <div className="diary-appbar">
        <div className="diary-appbar-left">
          <div className="diary-month-selector">
            <YearMonthPicker 
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
              titlePlaceholder={t('diary.all_diaries', '全部日记')}
            />
          </div>
        </div>

        <div className="diary-appbar-right">
          <div className="diary-search-wrapper">
            <Search size={16} className="diary-search-icon" />
            <input
              type="text"
              placeholder={t('common.search_hint', '搜索记忆...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="diary-search-input"
            />
          </div>

          <button className="diary-calendar-btn" title={t('diary.view_calendar', '日历')}>
            <Calendar size={18} />
          </button>

          <button 
            className="diary-add-btn" 
            onClick={() => navigate('/diary/new')}
          >
            <Plus size={18} />
            {t('diary.write_diary', '写日记')}
          </button>
        </div>
      </div>

      {/* 内容区 */}
      {filteredEntries.length === 0 ? (
        <div className="diary-empty-state">
          <Edit size={80} className="diary-empty-icon" />
          <div className="diary-empty-text">
            {selectedMonth
              ? t('diary.no_diaries_month', '本月暂无日记')
              : t('diary.no_diaries', '暂无日记，开始记录吧')
            }
          </div>
          {selectedMonth && (
            <button
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--color-primary, #5BA8F5)',
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 500
              }}
              onClick={() => setSelectedMonth(null)}
            >
              {t('common.view_all', '查看全部')}
            </button>
          )}
        </div>
      ) : (
        <div className="diary-grid">
          <div className="diary-grid-inner">
            {filteredEntries.map((entry) => (
              <DiaryCard
                key={entry.id}
                entry={entry}
                onClick={() => {
                  const dateStr = new Date(entry.date.getTime() - entry.date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                  navigate(`/diary/${dateStr}`);
                }}
                onEdit={() => {
                  const dateStr = new Date(entry.date.getTime() - entry.date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
                  navigate(`/diary/${dateStr}`);
                }}
                onDelete={() => {
                  // TODO: delete confirmation
                }}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ── DiaryCard 组件（复刻原版 DiaryCard） ──

interface DiaryCardProps {
  entry: DiaryEntry;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
  t: any;
}

const DiaryCard: React.FC<DiaryCardProps> = ({ entry, onClick, onEdit, onDelete, t }) => {
  const day = String(entry.date.getDate()).padStart(2, '0');
  const weekday = WEEKDAY_NAMES[entry.date.getDay()];
  const yearMonth = `${entry.date.getFullYear()} · ${MONTH_NAMES[entry.date.getMonth()]}`;
  const time = formatTime(entry.date);
  const visibleTags = entry.tags.filter(t => t.trim().length > 0);

  return (
    <div className="diary-card" onClick={onClick}>
      {/* Header: Day + Weekday + Year-Month */}
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
        <AlignJustify size={20} className="diary-card-menu-icon" />
      </div>

      {/* Time */}
      <div className="diary-card-time">{time}</div>

      {/* Content Preview */}
      <div className="diary-card-content">
        <div className="diary-card-content-text">
          {entry.preview}
        </div>
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="diary-card-tags">
          {visibleTags.map((tag, idx) => (
            <span key={idx} className={`diary-card-tag ${getTagColor(tag)}`}>
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Hover Actions */}
      <div className="diary-card-actions" onClick={(e) => e.stopPropagation()}>
        <button className="diary-card-action-btn edit-btn" onClick={onEdit}>
          <Edit size={14} />
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
