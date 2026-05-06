import { useTranslation } from 'react-i18next';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Edit3, CalendarCheck, Filter, X, Heart, Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Thermometer } from 'lucide-react';
import { useDiaryData } from './hooks/useDiaryData';
import { motion, AnimatePresence } from 'framer-motion';
import { DiaryCard } from './DiaryCard';
import type { DiaryEntry } from './DiaryCard';
import { YearMonthPicker, useToast } from '@baishou/ui';
import './DiaryPage.css';

export const DiaryPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // 筛选状态
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filterWeathers, setFilterWeathers] = useState<string[]>([]);
  const [filterFavorite, setFilterFavorite] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭筛选面板
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };

    if (isFilterOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isFilterOpen]);

  const { entries, loadEntries } = useDiaryData();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const toast = useToast();

  /** 执行删除操作 */
  const performDelete = async () => {
    if (deletingId === null) return;
    try {
      await window.api.diary.delete(deletingId);
      loadEntries();
      setDeletingId(null);
      toast.showSuccess(t('diary.delete_success', '日记已删除'));
    } catch (e) {
      console.error('Delete failed', e);
      toast.showError(t('diary.delete_failed', '删除失败'));
    }
  };

  /** 查找今天的日记条目 */
  const todayEntry = useMemo(() => {
    if (!entries) return null;
    const today = new Date();
    return entries.find((e: DiaryEntry) => {
      const d = e.date ? new Date(e.date) : null;
      return d && d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate();
    }) || null;
  }, [entries]);

  /** 编辑今日日记：有则追加，无则新建 */
  const handleEditToday = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    if (todayEntry) {
      navigate(`/diary/${dateStr}?append=1`);
    } else {
      navigate(`/diary/${dateStr}`);
    }
  };

  /** 新建日记 */
  const handleAddNew = () => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const d = String(today.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    navigate(`/diary/new?date=${dateStr}`);
  };

  /** 处理过滤和排序 */
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
        preview: e.preview || e.content?.substring(0, 500) || '',
        weather: e.weather,
        mood: e.mood,
        location: e.location,
        isFavorite: e.isFavorite,
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

    // 天气筛选（多选）
    if (filterWeathers.length > 0) {
      filtered = filtered.filter(e => e.weather && filterWeathers.includes(e.weather));
    }

    // 收藏筛选
    if (filterFavorite) {
      filtered = filtered.filter(e => e.isFavorite);
    }

    // 按日期降序排序
    filtered.sort((a, b) => b.date.getTime() - a.date.getTime());

    return filtered;
  }, [entries, selectedMonth, searchQuery]);

  /** 格式化日期字符串为 YYYY-MM-DD */
  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  /** 获取天气图标 */
  const getWeatherIcon = (weather: string) => {
    switch (weather) {
      case 'sunny': return <Sun size={16} />;
      case 'cloudy': return <Cloud size={16} />;
      case 'overcast': return <Cloud size={16} />;
      case 'light_rain': return <CloudRain size={16} />;
      case 'heavy_rain': return <CloudRain size={16} />;
      case 'snow': return <CloudSnow size={16} />;
      case 'fog': return <Cloud size={16} />;
      case 'windy': return <Wind size={16} />;
      default: return <Thermometer size={16} />;
    }
  };

  /** 获取天气名称 */
  const getWeatherName = (weather: string) => {
    const weatherMap: Record<string, string> = {
      'sunny': t('diary.weather.sunny', '晴'),
      'cloudy': t('diary.weather.cloudy', '多云'),
      'overcast': t('diary.weather.overcast', '阴'),
      'light_rain': t('diary.weather.light_rain', '小雨'),
      'heavy_rain': t('diary.weather.heavy_rain', '大雨'),
      'snow': t('diary.weather.snow', '雪'),
      'fog': t('diary.weather.fog', '雾'),
      'windy': t('diary.weather.windy', '风'),
    };
    return weatherMap[weather] || weather;
  };

  /** 清除所有筛选 */
  const clearFilters = () => {
    setFilterWeathers([]);
    setFilterFavorite(false);
  };

  /** 是否有激活的筛选 */
  const hasActiveFilters = filterWeathers.length > 0 || filterFavorite;

  return (
    <motion.div
      className="diary-page-container"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2 }}
    >
      {/* 顶部工具栏 */}
      <div className="diary-appbar">
        <div className="diary-appbar-left">
          <div className="diary-month-selector">
            <YearMonthPicker
              selectedMonth={selectedMonth}
              onChange={setSelectedMonth}
              titlePlaceholder={t('diary.all_diaries', '全部日记')}
            />
          </div>

          {/* 筛选按钮 */}
          <div className="diary-filter-wrapper" ref={filterRef}>
            <button
              className={`diary-filter-btn ${hasActiveFilters ? 'active' : ''}`}
              onClick={() => setIsFilterOpen(!isFilterOpen)}
            >
              <Filter size={16} />
              {hasActiveFilters && <span className="diary-filter-badge" />}
            </button>

            {/* 筛选面板 */}
            <AnimatePresence>
              {isFilterOpen && (
                <motion.div
                  className="diary-filter-panel"
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  onClick={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                >
                  <div className="diary-filter-header">
                    <span className="diary-filter-title">{t('diary.filter', '筛选')}</span>
                    {hasActiveFilters && (
                      <button className="diary-filter-clear" onClick={(e) => { e.stopPropagation(); clearFilters(); }}>
                        <X size={14} />
                        {t('diary.clear_filter', '清除')}
                      </button>
                    )}
                  </div>

                  {/* 收藏筛选 */}
                  <div className="diary-filter-section">
                    <button
                      className={`diary-filter-option ${filterFavorite ? 'active' : ''}`}
                      onClick={(e) => { e.stopPropagation(); setFilterFavorite(!filterFavorite); }}
                    >
                      <Heart size={16} fill={filterFavorite ? 'currentColor' : 'none'} />
                      <span>{t('diary.filter_favorite', '收藏')}</span>
                    </button>
                  </div>

                  {/* 天气筛选 */}
                  <div className="diary-filter-section">
                    <div className="diary-filter-section-label">{t('diary.filter_weather', '天气')}</div>
                    <div className="diary-filter-weather-grid">
                      {['sunny', 'cloudy', 'overcast', 'light_rain', 'heavy_rain', 'snow', 'fog', 'windy'].map(weather => (
                        <button
                          key={weather}
                          className={`diary-filter-weather-btn ${filterWeathers.includes(weather) ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterWeathers(prev =>
                              prev.includes(weather)
                                ? prev.filter(w => w !== weather)
                                : [...prev, weather]
                            );
                          }}
                          title={getWeatherName(weather)}
                        >
                          {getWeatherIcon(weather)}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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

          <button className="diary-add-btn" onClick={handleAddNew}>
            <Plus size={18} />
            {t('settings.write_diary_button', '写日记')}
          </button>

        </div>
      </div>

        {/* 筛选遮罩层 */}
        <AnimatePresence>
          {isFilterOpen && (
            <motion.div
              className="diary-filter-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsFilterOpen(false)}
            />
          )}
        </AnimatePresence>

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
            <button className="diary-view-all-btn" onClick={() => setSelectedMonth(null)}>
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
                  onClick={() => navigate(`/diary/${formatDateStr(entry.date)}`)}
                  onEdit={() => navigate(`/diary/${formatDateStr(entry.date)}`)}
                  onDelete={() => setDeletingId(entry.id)}
                  t={t}
                />
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* 删除确认弹窗 */}
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
