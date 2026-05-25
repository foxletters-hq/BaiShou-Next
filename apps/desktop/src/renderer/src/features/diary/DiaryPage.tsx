import { useTranslation } from 'react-i18next'
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  Plus,
  Edit3,
  CalendarCheck,
  Filter,
  X,
  Heart,
  Cloud,
  Sun,
  CloudRain,
  CloudSnow,
  CloudLightning,
  Wind,
  Thermometer
} from 'lucide-react'
import { useDiaryData } from './hooks/useDiaryData'
import { motion, AnimatePresence } from 'framer-motion'
import { DiaryCard } from './DiaryCard'
import type { DiaryEntry } from './DiaryCard'
import { YearMonthPicker, PageSizeSelector, Pagination, useToast } from '@baishou/ui'
import './DiaryPage.css'

export const DiaryPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [searchQuery, setSearchQuery] = useState(() => {
    return sessionStorage.getItem('diary_searchQuery') || ''
  })
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(() => {
    const saved = sessionStorage.getItem('diary_selectedMonth')
    if (saved === 'all') return null
    if (saved) {
      try {
        const d = new Date(saved)
        if (!isNaN(d.getTime())) return d
      } catch {
        /* ignore */
      }
    }
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // 筛选状态
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [filterWeathers, setFilterWeathers] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('diary_filterWeathers')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [filterFavorite, setFilterFavorite] = useState(() => {
    return sessionStorage.getItem('diary_filterFavorite') === 'true'
  })
  const filterRef = useRef<HTMLDivElement>(null)

  // 保存筛选状态到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem('diary_searchQuery', searchQuery)
  }, [searchQuery])
  useEffect(() => {
    sessionStorage.setItem(
      'diary_selectedMonth',
      selectedMonth ? selectedMonth.toISOString() : 'all'
    )
  }, [selectedMonth])
  useEffect(() => {
    sessionStorage.setItem('diary_filterWeathers', JSON.stringify(filterWeathers))
  }, [filterWeathers])
  useEffect(() => {
    sessionStorage.setItem('diary_filterFavorite', String(filterFavorite))
  }, [filterFavorite])

  // 分页状态（持久化到 sessionStorage）
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('diary_currentPage')
    return saved ? Math.max(1, Number(saved)) : 1
  })
  const [pageSize, setPageSize] = useState(() => {
    const saved = sessionStorage.getItem('diary_pageSize')
    return saved ? Number(saved) : 50
  })

  const diaryQuery = useMemo(
    () => ({
      selectedMonth,
      searchQuery,
      filterWeathers,
      filterFavorite,
      page: currentPage,
      pageSize
    }),
    [selectedMonth, searchQuery, filterWeathers, filterFavorite, currentPage, pageSize]
  )

  const { entries, totalCount, loading, loadEntries } = useDiaryData(diaryQuery)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null)
  const toast = useToast()
  const [attachmentBasePath, setAttachmentBasePath] = useState<string>('')

  // 保存分页状态到 sessionStorage
  useEffect(() => {
    sessionStorage.setItem('diary_currentPage', String(currentPage))
  }, [currentPage])
  useEffect(() => {
    sessionStorage.setItem('diary_pageSize', String(pageSize))
  }, [pageSize])

  // 筛选条件变化时重置到第一页
  useEffect(() => {
    setCurrentPage(1)
  }, [selectedMonth, searchQuery, filterWeathers, filterFavorite])

  /** 格式化日期字符串为 YYYY-MM-DD */
  const formatDateStr = (date: Date): string => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // 获取当前月份的附件目录路径
  useEffect(() => {
    if (!selectedMonth) return
    const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-01`
    ;(window as any).api?.diary
      ?.getAttachmentDir?.(dateStr)
      ?.then((res: any) => {
        if (res?.success && res.path) {
          setAttachmentBasePath(res.path)
        }
      })
      .catch(() => {})
  }, [selectedMonth])

  useEffect(() => {
    const today = new Date()
    const dateStr = formatDateStr(today)
    ;(window as any).api?.diary
      ?.findByDate?.(dateStr)
      ?.then((entry: any) => {
        if (!entry) {
          setTodayEntry(null)
          return
        }
        setTodayEntry({
          id: entry.id,
          date: entry.date ? new Date(entry.date) : today,
          content: entry.content || '',
          tags: [],
          preview: entry.content?.substring(0, 500) || ''
        })
      })
      .catch(() => setTodayEntry(null))
  }, [loadEntries])

  /** 执行删除操作 */
  const performDelete = async () => {
    if (deletingId === null) return
    try {
      await window.api.diary.delete(deletingId)
      loadEntries()
      setDeletingId(null)
      toast.showSuccess(t('diary.delete_success', '日记已删除'))
    } catch (e) {
      console.error('Delete failed', e)
      toast.showError(t('diary.delete_failed', '删除失败'))
    }
  }

  /** 编辑今日日记：有则追加，无则新建 */
  const handleEditToday = () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    if (todayEntry) {
      sessionStorage.setItem('desktop_last_nav', '/diary')
      navigate(`/diary/${dateStr}?append=1`)
    } else {
      sessionStorage.setItem('desktop_last_nav', '/diary')
      navigate(`/diary/${dateStr}`)
    }
  }

  /** 新建日记 */
  const handleAddNew = () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    const dateStr = `${y}-${m}-${d}`
    sessionStorage.setItem('desktop_last_nav', '/diary')
    navigate(`/diary/new?date=${dateStr}`)
  }

  const goToEditor = (dateStr: string) => {
    sessionStorage.setItem('desktop_last_nav', '/diary')
    navigate(`/diary/${dateStr}`)
  }

  const displayEntries = useMemo(() => {
    if (!entries || entries.length === 0) return []

    return entries.map((e) => {
      const parsedDate = e.date ? new Date(e.date) : new Date()
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
        hasMedia: e.hasMedia || false
      } as DiaryEntry
    })
  }, [entries])

  const showPagination = totalCount > pageSize
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const safeCurrentPage = Math.min(currentPage, totalPages)

  // 页码越界时自动修正
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages)
    }
  }, [currentPage, totalPages])

  /** 获取天气图标 */
  const getWeatherIcon = (weather: string) => {
    switch (weather) {
      case 'sunny':
        return <Sun size={16} />
      case 'cloudy':
        return <Cloud size={16} />
      case 'overcast':
        return <Cloud size={16} />
      case 'light_rain':
        return <CloudRain size={16} />
      case 'heavy_rain':
        return <CloudRain size={16} />
      case 'snow':
        return <CloudSnow size={16} />
      case 'fog':
        return <Cloud size={16} />
      case 'windy':
        return <Wind size={16} />
      default:
        return <Thermometer size={16} />
    }
  }

  /** 获取天气名称 */
  const getWeatherName = (weather: string) => {
    const weatherMap: Record<string, string> = {
      sunny: t('diary.weather.sunny', '晴'),
      cloudy: t('diary.weather.cloudy', '多云'),
      overcast: t('diary.weather.overcast', '阴'),
      light_rain: t('diary.weather.light_rain', '小雨'),
      heavy_rain: t('diary.weather.heavy_rain', '大雨'),
      snow: t('diary.weather.snow', '雪'),
      fog: t('diary.weather.fog', '雾'),
      windy: t('diary.weather.windy', '风')
    }
    return weatherMap[weather] || weather
  }

  /** 清除所有筛选 */
  const clearFilters = () => {
    setFilterWeathers([])
    setFilterFavorite(false)
  }

  /** 是否有激活的筛选 */
  const hasActiveFilters = filterWeathers.length > 0 || filterFavorite

  return (
    <div className="diary-page-container">
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

            {/* 筛选遮罩层（在 wrapper 内，panel 外，阻止事件穿透） */}
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
                >
                  <div className="diary-filter-header">
                    <span className="diary-filter-title">{t('diary.filter', '筛选')}</span>
                    {hasActiveFilters && (
                      <button
                        className="diary-filter-clear"
                        onClick={(e) => {
                          e.stopPropagation()
                          clearFilters()
                        }}
                      >
                        <X size={14} />
                        {t('diary.clear_filter', '清除')}
                      </button>
                    )}
                  </div>

                  {/* 收藏筛选 */}
                  <div className="diary-filter-section">
                    <button
                      className={`diary-filter-option ${filterFavorite ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        setFilterFavorite(!filterFavorite)
                      }}
                    >
                      <Heart size={16} fill={filterFavorite ? 'currentColor' : 'none'} />
                      <span>{t('diary.filter_favorite', '收藏')}</span>
                    </button>
                  </div>

                  {/* 天气筛选 */}
                  <div className="diary-filter-section">
                    <div className="diary-filter-section-label">
                      {t('diary.filter_weather', '天气')}
                    </div>
                    <div className="diary-filter-weather-grid">
                      {[
                        'sunny',
                        'cloudy',
                        'overcast',
                        'light_rain',
                        'heavy_rain',
                        'snow',
                        'fog',
                        'windy'
                      ].map((weather) => (
                        <button
                          key={weather}
                          className={`diary-filter-weather-btn ${filterWeathers.includes(weather) ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setFilterWeathers((prev) =>
                              prev.includes(weather)
                                ? prev.filter((w) => w !== weather)
                                : [...prev, weather]
                            )
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
            title={
              todayEntry
                ? t('settings.edit_today_tooltip', '编辑今日记录')
                : t('settings.write_today_tooltip', '记录今天')
            }
          >
            {todayEntry ? <Edit3 size={18} /> : <CalendarCheck size={18} />}
          </button>

          <button className="diary-add-btn" onClick={handleAddNew}>
            <Plus size={18} />
            {t('settings.write_diary_button', '写日记')}
          </button>
        </div>
      </div>

      {/* 内容区 */}
      {loading ? (
        <div className="diary-empty-state">
          <div className="diary-empty-text">{t('common.loading', '加载中...')}</div>
        </div>
      ) : totalCount === 0 ? (
        <div className="diary-empty-state">
          <Edit3 size={56} className="diary-empty-icon" />
          <div className="diary-empty-text">
            {selectedMonth
              ? t('diary.no_diaries_month', '本月暂无日记')
              : t('diary.no_diaries', '暂无日记，开始记录吧')}
          </div>
          {selectedMonth && (
            <button className="diary-view-all-btn" onClick={() => setSelectedMonth(null)}>
              {t('common.view_all', '查看全部')}
            </button>
          )}
        </div>
      ) : (
        <div className="diary-grid">
          {/* 顶部分页控制栏 */}
          {showPagination && (
            <div className="diary-pagination-top">
              <div className="diary-pagination-info">
                {t('diary.pagination_info', '共 $total 条，第 $page / $pages 页')
                  .replace('$total', String(totalCount))
                  .replace('$page', String(safeCurrentPage))
                  .replace('$pages', String(totalPages))}
              </div>
              <div className="diary-pagination-controls">
                <PageSizeSelector
                  value={pageSize}
                  options={[50, 80, 100, 200]}
                  onChange={(size) => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  label={t('diary.per_page', '条/页')}
                />
                <Pagination
                  current={safeCurrentPage}
                  total={totalPages}
                  onChange={setCurrentPage}
                  siblingCount={1}
                  showFirstLast={true}
                  showJumper={true}
                  jumperPlaceholder={t('diary.jump_to_page', '跳转')}
                />
              </div>
            </div>
          )}

          <div className="diary-grid-inner">
            {displayEntries.map((entry) => (
              <motion.div
                layout="position"
                key={entry.id}
                style={{ height: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              >
                <DiaryCard
                  entry={entry}
                  onClick={() => goToEditor(formatDateStr(entry.date))}
                  onEdit={() => goToEditor(formatDateStr(entry.date))}
                  onDelete={() => setDeletingId(entry.id)}
                  t={t as any}
                  basePath={attachmentBasePath}
                />
              </motion.div>
            ))}
          </div>

          {/* 底部分页控制栏 */}
          {showPagination && (
            <div className="diary-pagination">
              <div className="diary-pagination-info">
                {t('diary.pagination_info', '共 $total 条，第 $page / $pages 页')
                  .replace('$total', String(totalCount))
                  .replace('$page', String(safeCurrentPage))
                  .replace('$pages', String(totalPages))}
              </div>
              <div className="diary-pagination-controls">
                <PageSizeSelector
                  value={pageSize}
                  options={[50, 80, 100, 200]}
                  onChange={(size) => {
                    setPageSize(size)
                    setCurrentPage(1)
                  }}
                  label={t('diary.per_page', '条/页')}
                />
                <Pagination
                  current={safeCurrentPage}
                  total={totalPages}
                  onChange={setCurrentPage}
                  siblingCount={1}
                  showFirstLast={true}
                  showJumper={true}
                  jumperPlaceholder={t('diary.jump_to_page', '跳转')}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 删除确认弹窗 */}
      {deletingId !== null && (
        <div className="diary-delete-modal-overlay" onClick={() => setDeletingId(null)}>
          <div className="diary-delete-modal" onClick={(e) => e.stopPropagation()}>
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
    </div>
  )
}
