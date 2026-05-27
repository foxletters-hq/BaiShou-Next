import React from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Plus, Edit3, CalendarCheck, Filter, X, Heart } from 'lucide-react'
import {
  WEATHER_IDS,
  getWeatherEmoji,
  normalizeWeatherId,
  weatherI18nKey,
  type WeatherId
} from '@baishou/shared'
import { YearMonthPicker } from '@baishou/ui'
import { motion, AnimatePresence } from 'framer-motion'

interface DiaryAppBarProps {
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedMonth: Date | null
  onMonthChange: (m: Date | null) => void
  filterWeathers: string[]
  onFilterWeathersChange: (weathers: string[]) => void
  filterFavorite: boolean
  onFilterFavoriteChange: (v: boolean) => void
  todayEntry: { id: number } | null
  onEditToday: () => void
  onAddNew: () => void
}

/** 日记页面顶部工具栏：包含月份选择、天气/收藏筛选面板、搜索框与操作按钮 */
export const DiaryAppBar: React.FC<DiaryAppBarProps> = ({
  searchQuery,
  onSearchChange,
  selectedMonth,
  onMonthChange,
  filterWeathers,
  onFilterWeathersChange,
  filterFavorite,
  onFilterFavoriteChange,
  todayEntry,
  onEditToday,
  onAddNew
}) => {
  const { t } = useTranslation()
  const [isFilterOpen, setIsFilterOpen] = React.useState(false)
  const filterRef = React.useRef<HTMLDivElement>(null)

  const hasActiveFilters = filterWeathers.length > 0 || filterFavorite

  const weatherLabelFallback: Record<WeatherId, string> = {
    sunny: '晴',
    cloudy: '多云',
    overcast: '阴',
    light_rain: '小雨',
    heavy_rain: '大雨',
    snow: '雪',
    fog: '雾',
    windy: '风'
  }

  const getWeatherLabel = (id: WeatherId) =>
    t(`diary.weather.${weatherI18nKey(id)}`, weatherLabelFallback[id])

  const clearFilters = () => {
    onFilterWeathersChange([])
    onFilterFavoriteChange(false)
  }

  return (
    <div className="diary-appbar">
      <div className="diary-appbar-left">
        <div className="diary-month-selector">
          <YearMonthPicker
            selectedMonth={selectedMonth}
            onChange={onMonthChange}
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
                      onFilterFavoriteChange(!filterFavorite)
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
                    {WEATHER_IDS.map((weather) => (
                      <button
                        key={weather}
                        className={`diary-filter-weather-btn ${filterWeathers.includes(weather) ? 'active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          onFilterWeathersChange(
                            filterWeathers.includes(weather)
                              ? filterWeathers.filter((w) => w !== weather)
                              : [...filterWeathers, weather]
                          )
                        }}
                        title={getWeatherLabel(weather)}
                        aria-label={getWeatherLabel(weather)}
                      >
                        <span className="diary-filter-weather-emoji">
                          {getWeatherEmoji(weather)}
                        </span>
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
            onChange={(e) => onSearchChange(e.target.value)}
            className="diary-search-input"
          />
        </div>

        <button
          className="diary-today-btn"
          onClick={onEditToday}
          title={
            todayEntry
              ? t('settings.edit_today_tooltip', '编辑今日记录')
              : t('settings.write_today_tooltip', '记录今天')
          }
        >
          {todayEntry ? <Edit3 size={18} /> : <CalendarCheck size={18} />}
        </button>

        <button className="diary-add-btn" onClick={onAddNew}>
          <Plus size={18} />
          {t('settings.write_diary_button', '写日记')}
        </button>
      </div>
    </div>
  )
}
