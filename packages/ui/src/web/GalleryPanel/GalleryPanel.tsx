import { useTranslation } from 'react-i18next'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Edit3, Trash2, Calendar, Tag, Save, X, ChevronDown } from 'lucide-react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { CodeMirrorEditor } from '../DiaryEditor'
import './GalleryPanel.css'

export interface SummaryItem {
  id?: number
  type: string
  startDate: string
  endDate: string
  content: string
  generatedAt?: string
}

export interface GalleryPanelProps {
  summaries?: SummaryItem[]
  onOpen?: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
  onSave?: (id: string, content: string) => Promise<void>
}

/** 总结类型 → i18n 键映射 */
const TYPE_I18N_MAP: Record<string, string> = {
  weekly: 'summary.stats_week',
  monthly: 'summary.stats_month',
  quarterly: 'summary.stats_quarter',
  yearly: 'summary.stats_year'
}

export const GalleryPanel: React.FC<GalleryPanelProps> = ({
  summaries = [],
  onOpen,
  onEdit,
  onDelete,
  onSave
}) => {
  const { t, i18n } = useTranslation()
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>(
    'weekly'
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 年份筛选与滚动分页状态
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [pageSize, setPageSize] = useState<number>(10)

  // 年份选择器弹窗状态与 activeYearRef 自动定位滚动
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const activeYearRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 弹窗打开时滚动到当前选中的年份
  useEffect(() => {
    if (isYearPickerOpen) {
      setTimeout(() => {
        activeYearRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
      }, 80)
    }
  }, [isYearPickerOpen])

  // 编辑模式状态
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  /** 从所有总结中动态提取并排重所有的年份，按年份降序排列 */
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    summaries.forEach((s) => {
      if (s.startDate) {
        const dateObj = new Date(s.startDate)
        const year = dateObj.getFullYear()
        if (year && !isNaN(year)) {
          years.add(String(year))
        }
      }
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [summaries])

  /** 先按类型及年份过滤，并按时间降序排序 */
  const filteredAndSortedSummaries = useMemo(() => {
    let items = summaries.filter((s) => s.type === activeTab)

    // 筛选了年份
    if (selectedYear !== 'all') {
      items = items.filter((s) => {
        if (!s.startDate) return false
        return new Date(s.startDate).getFullYear().toString() === selectedYear
      })
    }

    // 按时间降序排列 (最新总结排最前)
    return [...items].sort((a, b) => {
      const timeA = a.startDate ? new Date(a.startDate).getTime() : 0
      const timeB = b.startDate ? new Date(b.startDate).getTime() : 0
      return timeB - timeA
    })
  }, [summaries, activeTab, selectedYear])

  /** 分页截取展示，仅对周报限制分页加载，月/季/年展示全部 */
  const displayedSummaries = useMemo(() => {
    if (activeTab === 'weekly') {
      return filteredAndSortedSummaries.slice(0, pageSize)
    }
    return filteredAndSortedSummaries
  }, [filteredAndSortedSummaries, activeTab, pageSize])

  /** 当前选中的总结 */
  const selectedSummary = useMemo(() => {
    if (selectedId) {
      return filteredAndSortedSummaries.find((s) => String(s.id) === selectedId)
    }
    return filteredAndSortedSummaries[0]
  }, [filteredAndSortedSummaries, selectedId])

  /** 格式化周报起始日期 */
  const formatWeeklyStartDate = (date: Date) => {
    return date.toLocaleDateString(i18n.language, { month: 'long', day: 'numeric' })
  }

  /** 格式化日期范围 */
  const formatDateRange = (s: SummaryItem) => {
    if (!s.startDate) return ''
    const start = new Date(s.startDate)

    if (s.type === 'weekly') {
      return formatWeeklyStartDate(start)
    }
    if (!s.endDate) return ''
    if (s.type === 'monthly') {
      return start.toLocaleDateString(i18n.language, { year: 'numeric', month: 'long' })
    }
    if (s.type === 'quarterly') {
      const q = Math.ceil((start.getMonth() + 1) / 3)
      return t('summary.missing_label_quarterly', '$year Q$q')
        .replace('$year', String(start.getFullYear()))
        .replace('$q', String(q))
    }
    if (s.type === 'yearly') {
      return t('summary.missing_label_yearly', 'Year $year').replace(
        '$year',
        String(start.getFullYear())
      )
    }
    return ''
  }

  /** 获取标题 */
  const getTitle = (s: SummaryItem) => {
    if (!s.startDate) return t('gallery.summary', 'Summary')
    const dateObj = new Date(s.startDate)

    if (s.type === 'weekly') {
      const weekNum = getWeekNumber(dateObj)
      const year = dateObj.getFullYear()
      return t('summary.missing_label_weekly', 'Week $week, $year')
        .replace('$year', String(year))
        .replace('$week', String(weekNum))
    }
    if (s.type === 'monthly') {
      const month = dateObj.getMonth() + 1
      const year = dateObj.getFullYear()
      return t('summary.title_monthly', 'Monthly Report ($year-$month)')
        .replace('$year', String(year))
        .replace('$month', String(month))
    }
    if (s.type === 'quarterly') {
      const q = Math.ceil((dateObj.getMonth() + 1) / 3)
      const year = dateObj.getFullYear()
      return t('summary.missing_label_quarterly', '$year Q$q')
        .replace('$year', String(year))
        .replace('$q', String(q))
    }
    if (s.type === 'yearly') {
      const year = dateObj.getFullYear()
      return t('summary.missing_label_yearly', 'Year $year').replace('$year', String(year))
    }
    return t('gallery.summary', 'Summary')
  }

  /** 获取内容预览 */
  const getPreview = (content: string) => {
    if (!content) return ''
    const lines = content.split('\n')
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        return trimmed.replace(/[*_~`]/g, '').substring(0, 80)
      }
    }
    return ''
  }

  /** 计算周数 */
  const getWeekNumber = (date: Date) => {
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1)
    const diff = date.getTime() - firstDayOfYear.getTime()
    return Math.ceil(diff / (7 * 24 * 60 * 60 * 1000))
  }

  // 当选中项或 Tab 切换时重置编辑状态
  useEffect(() => {
    setIsEditing(false)
    setEditContent('')
  }, [selectedSummary?.id, activeTab])

  const handleTabChange = (tab: 'weekly' | 'monthly' | 'quarterly' | 'yearly') => {
    setActiveTab(tab)
    setSelectedId(null)
    setPageSize(10)
    setIsYearPickerOpen(false)
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    setSelectedId(null)
    setPageSize(10)
    setIsYearPickerOpen(false)
  }

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (activeTab !== 'weekly') return
    const target = e.currentTarget
    // 当滚动到底部 20px 阈值内时，加载更多
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
      if (pageSize < filteredAndSortedSummaries.length) {
        setPageSize((prev) => prev + 10)
      }
    }
  }

  const handleSave = async () => {
    if (!selectedSummary || !selectedSummary.id || !onSave) return
    setIsSaving(true)
    try {
      await onSave(String(selectedSummary.id), editContent)
      setIsEditing(false)
    } catch (e) {
      console.error('[GalleryPanel] Save error:', e)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditContent('')
  }

  /** 处理列表项点击 */
  const handleItemClick = (id: string) => {
    setSelectedId(id)
    onOpen?.(id)
  }

  return (
    <div className="gallery-panel">
      <div className="gallery-header-row">
        {/* 标签栏 */}
        <div className="gallery-tabs-container">
          {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((tab) => (
            <button
              key={tab}
              className={`gallery-tab-btn ${activeTab === tab ? 'active' : ''}`}
              onClick={() => handleTabChange(tab)}
            >
              {t(`summary.tab_${tab}`, tab)}
            </button>
          ))}
        </div>

        {/* 年份筛选下拉选择器：当有年份数据时在所有标签页显示 */}
        {availableYears.length > 0 && (
          <div className="gallery-filter-container">
            <button
              className={`gallery-year-select-trigger ${isYearPickerOpen ? 'open' : ''}`}
              onClick={() => setIsYearPickerOpen(true)}
            >
              <span>
                {selectedYear === 'all'
                  ? t('gallery.filter_all_years', 'All Years')
                  : `${selectedYear}${t('common.year_suffix', '')}`}
              </span>
              <ChevronDown size={16} className="gallery-select-chevron" />
            </button>
          </div>
        )}
      </div>

      {/* 传送门渲染年份选择弹窗 */}
      {mounted &&
        createPortal(
          <AnimatePresence>
            {isYearPickerOpen && (
              <motion.div
                className="gallery-year-modal-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsYearPickerOpen(false)}
              >
                <motion.div
                  className="gallery-year-modal-content"
                  initial={{ opacity: 0, y: 20, scale: 0.96 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.96,
                    transition: { duration: 0.15 }
                  }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="gallery-year-modal-header">
                    <h3>{t('gallery.select_year', 'Select Year')}</h3>
                    <button
                      className="gallery-year-modal-close"
                      onClick={() => setIsYearPickerOpen(false)}
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="gallery-year-modal-body">
                    {/* 全部年份 粘性置顶容器 */}
                    <div className="gallery-year-modal-sticky-header">
                      <button
                        ref={selectedYear === 'all' ? activeYearRef : null}
                        className={`gallery-year-modal-all-btn ${
                          selectedYear === 'all' ? 'active' : ''
                        }`}
                        onClick={() => {
                          handleYearChange('all')
                          setIsYearPickerOpen(false)
                        }}
                      >
                        {t('gallery.filter_all_years', '全部年份')}
                      </button>
                    </div>

                    {/* 年份网格 */}
                    <div className="gallery-year-modal-grid">
                      {availableYears.map((year) => {
                        const isSelected = selectedYear === year
                        return (
                          <button
                            key={year}
                            ref={isSelected ? activeYearRef : null}
                            className={`gallery-year-modal-grid-item ${
                              isSelected ? 'active' : ''
                            }`}
                            onClick={() => {
                              handleYearChange(year)
                              setIsYearPickerOpen(false)
                            }}
                          >
                            {year}
                            {t('common.year_suffix', '')}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}

      {/* 双栏布局 */}
      <div className="gallery-layout">
        {/* 左侧列表 */}
        <div className="gallery-list" onScroll={handleScroll}>
          {displayedSummaries.length === 0 ? (
            <div className="gallery-list-empty">
              <Edit3 size={32} className="gallery-empty-icon" />
              <div className="gallery-empty-text">{t('diary.no_content', '暂无内容')}</div>
            </div>
          ) : (
            displayedSummaries.map((item) => {
              const id = String(item.id ?? '')
              const isSelected = selectedSummary?.id === item.id

              return (
                <div
                  key={id}
                  className={`gallery-list-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleItemClick(id)}
                >
                  <div className="gallery-list-item-header">
                    <span className="gallery-list-item-title">{getTitle(item)}</span>
                    {item.type === 'weekly' && (
                      <span className="gallery-list-item-date">{formatDateRange(item)}</span>
                    )}
                  </div>
                  {getPreview(item.content) && (
                    <div className="gallery-list-item-preview">{getPreview(item.content)}</div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* 分隔线 */}
        <div className="gallery-divider" />

        {/* 右侧详情 */}
        <div className={`gallery-detail ${isEditing ? 'editing' : ''}`}>
          {selectedSummary ? (
            <>
              <div className="gallery-detail-header">
                <div className="gallery-detail-meta">
                  <span className="gallery-detail-type-badge">
                    <Tag size={12} />
                    {t(
                      TYPE_I18N_MAP[selectedSummary.type] || selectedSummary.type,
                      selectedSummary.type
                    )}
                  </span>
                  <span className="gallery-detail-date">
                    <Calendar size={12} />
                    {formatDateRange(selectedSummary)}
                  </span>
                </div>
                <div className="gallery-detail-actions">
                  {isEditing ? (
                    <>
                      <button
                        className="gallery-action-btn"
                        onClick={handleSave}
                        disabled={isSaving}
                        title={t('common.save', '保存')}
                      >
                        <Save size={16} />
                      </button>
                      <button
                        className="gallery-action-btn"
                        onClick={handleCancel}
                        disabled={isSaving}
                        title={t('common.cancel', '取消')}
                      >
                        <X size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="gallery-action-btn"
                        onClick={() => {
                          if (onSave) {
                            setEditContent(selectedSummary.content)
                            setIsEditing(true)
                          } else {
                            onEdit?.(String(selectedSummary.id))
                          }
                        }}
                        title={t('common.edit', '编辑')}
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        className="gallery-action-btn danger"
                        onClick={() => onDelete?.(String(selectedSummary.id))}
                        title={t('common.delete', '删除')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className={`gallery-detail-content ${isEditing ? 'editing' : ''}`}>
                {isEditing ? (
                  <CodeMirrorEditor content={editContent} onChange={setEditContent} />
                ) : (
                  <MarkdownRenderer content={selectedSummary.content} />
                )}
              </div>
            </>
          ) : (
            <div className="gallery-detail-empty">
              <Edit3 size={48} className="gallery-empty-icon" />
              <div className="gallery-empty-text">
                {t('gallery.select_summary', '选择一个总结查看详情')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
