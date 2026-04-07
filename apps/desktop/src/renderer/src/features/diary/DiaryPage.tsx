import { useTranslation } from 'react-i18next';
import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Calendar, Trash2, Edit3, CalendarCheck } from 'lucide-react';
import { useDiaryData } from './hooks/useDiaryData';
import { motion } from 'framer-motion';
import './DiaryPage.css';

// 星期几名称
const WEEKDAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTH_NAMES = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

// 标签颜色映射
const TAG_COLORS = ['tag-blue', 'tag-green', 'tag-orange', 'tag-purple'] as const;
import { YearMonthPicker, useToast } from '@baishou/ui';

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

  const { entries, loadEntries } = useDiaryData();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const toast = useToast();

  const performDelete = async () => {
    if (deletingId === null) return;
    try {
      await (window as any).api.diary.delete(deletingId);
      loadEntries();
      setDeletingId(null);
      toast.showSuccess(t('diary.delete_success', '日记已删除'));
    } catch (e) {
      console.error('Delete failed', e);
      toast.showError(t('diary.delete_failed', '删除失败'));
    }
  };

  // 查找今天的日记条目（参考原版 BaiShou todayMeta 逻辑）
  const todayEntry = useMemo(() => {
    if (!entries) return null;
    const today = new Date();
    return entries.find((e: any) => {
      const d = e.date ? new Date(e.date) : null;
      return d && d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
    }) || null;
  }, [entries]);

  // 原版 BaiShou 写日记逻辑：有今天的就用追加模式打开，没有就新建
  const handleEditToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (todayEntry) {
      // 追加模式：带 append=1 参数，编辑器会在内容末尾追加时间戳
      navigate(`/diary/${dateStr}?append=1`);
    } else {
      // 本日首开模式
      navigate(`/diary/${dateStr}`);
    }
  };

  const handleAddNew = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    // 新建模式（无参数不传 append，直接拉起纯净画板）
    navigate(`/diary/new?date=${dateStr}`);
  };

  // Click outside closed natively by YearMonthPicker now


  // 处理过滤
  const filteredEntries = useMemo(() => {
    if (!entries || entries.length === 0) return [];
    
    let filtered = [...entries].map(e => {
      let parsedDate = new Date();
      if (e.date) {
        const pd = new Date(e.date);
        if (!isNaN(pd.getTime())) parsedDate = pd;
      }
      if (isNaN(parsedDate.getTime()) || !e.date) {
        if (e.createdAt) {
          const cd = new Date(e.createdAt);
          if (!isNaN(cd.getTime())) parsedDate = cd;
        }
      }

      return {
        id: e.id,
        date: parsedDate,
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
    <motion.div 
      className="diary-page-container"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
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


          <button 
            className="diary-today-btn"
            onClick={handleEditToday}
            title={todayEntry ? t('settings.edit_today_tooltip', '编辑今日记录') : t('settings.write_today_tooltip', '记录今天')}
          >
            {todayEntry ? <Edit3 size={18} /> : <CalendarCheck size={18} />}
          </button>

          <button 
            className="diary-add-btn"
            onClick={handleAddNew}
          >
            <Plus size={18} />
            {t('settings.write_diary_button', '写日记')}
          </button>
        </div>
      </div>

      {/* 内容区 */}
      {filteredEntries.length === 0 ? (
        <div className="diary-empty-state">
          <Edit3 size={56} className="diary-empty-icon" />
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
              <motion.div layout="position" key={entry.id} style={{ height: '100%' }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
                <DiaryCard
                  entry={entry}
                  onClick={() => {
                    const y = entry.date.getFullYear();
                    const m = String(entry.date.getMonth() + 1).padStart(2, '0');
                    const dStr = String(entry.date.getDate()).padStart(2, '0');
                    navigate(`/diary/${y}-${m}-${dStr}`);
                  }}
                  onEdit={() => {
                    const y = entry.date.getFullYear();
                    const m = String(entry.date.getMonth() + 1).padStart(2, '0');
                    const dStr = String(entry.date.getDate()).padStart(2, '0');
                    navigate(`/diary/${y}-${m}-${dStr}`);
                  }}
                  onDelete={() => {
                    setDeletingId(entry.id);
                  }}
                  t={t}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId !== null && (
        <div className="diary-delete-modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="diary-delete-modal" onClick={e => e.stopPropagation()}>
            <div className="dd-modal-title">{t('common.confirm_delete', '确认删除')}</div>
            <div className="dd-modal-content">
              {t('diary.delete_warning', '您确定要永久删除这篇日记吗？此操作不可逆转。')}
            </div>
            <div className="dd-modal-actions">
              <button className="dd-btn-cancel" onClick={() => setDeletingId(null)}>
                {t('common.cancel', '取消')}
              </button>
              <button className="dd-btn-confirm" onClick={performDelete}>
                {t('common.delete', '删除')}
              </button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
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
