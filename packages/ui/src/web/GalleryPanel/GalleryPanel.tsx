import { useTranslation } from 'react-i18next'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { Edit3, Trash2, Calendar, Tag, Save, X, ChevronDown } from 'lucide-react'
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
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'weekly' | 'monthly' | 'quarterly' | 'yearly'>(
    'weekly'
  )
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // 年份筛选与滚动分页状态
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [pageSize, setPageSize] = useState<number>(10)

  // 自定义年份下拉框展开状态与 Ref
  const [isYearDropdownOpen, setIsYearDropdownOpen] = useState(false)
  const yearDropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭年份下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(event.target as Node)) {
        setIsYearDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

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

  /** 格式化日期范围 */
  const formatDateRange = (s: SummaryItem) => {
    if (!s.startDate || !s.endDate) return ''
    const start = new Date(s.startDate)
    const end = new Date(s.endDate)

    if (s.type === 'weekly') {
      return `${start.getMonth() + 1}/${start.getDate()} - ${end.getMonth() + 1}/${end.getDate()}`
    }
    if (s.type === 'monthly') {
      return `${start.getFullYear()}年${start.getMonth() + 1}月`
    }
    if (s.type === 'quarterly') {
      const q = Math.ceil((start.getMonth() + 1) / 3)
      return `${start.getFullYear()}年 Q${q}`
    }
    if (s.type === 'yearly') {
      return `${start.getFullYear()}年`
    }
    return ''
  }

  /** 获取标题 */
  const getTitle = (s: SummaryItem) => {
    if (!s.startDate) return t('gallery.summary', '总结')
    const dateObj = new Date(s.startDate)

    if (s.type === 'weekly') {
      const weekNum = getWeekNumber(dateObj)
      return t('summary.card_week_title', '第 $week 周').replace('$week', String(weekNum))
    }
    if (s.type === 'monthly') {
      const month = dateObj.getMonth() + 1
      return t('summary.card_month_title', '$month月').replace('$month', String(month))
    }
    if (s.type === 'quarterly') {
      const q = Math.ceil((dateObj.getMonth() + 1) / 3)
      const year = dateObj.getFullYear()
      return t('summary.missing_label_quarterly', '$year年Q$q')
        .replace('$year', String(year))
        .replace('$q', String(q))
    }
    if (s.type === 'yearly') {
      const year = dateObj.getFullYear()
      return t('summary.card_year_suffix', '$year年').replace('$year', String(year))
    }
    return t('gallery.summary', '总结')
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
    setSelectedYear('all')
    setPageSize(10)
    setIsYearDropdownOpen(false)
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    setSelectedId(null)
    setPageSize(10)
    setIsYearDropdownOpen(false)
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
          <div className="gallery-filter-container" ref={yearDropdownRef}>
            <button
              className={`gallery-year-select-trigger ${isYearDropdownOpen ? 'open' : ''}`}
              onClick={() => setIsYearDropdownOpen((prev) => !prev)}
            >
              <span>
                {selectedYear === 'all'
                  ? t('gallery.filter_all_years', '全部年份')
                  : `${selectedYear}年`}
              </span>
              <ChevronDown size={16} className="gallery-select-chevron" />
            </button>
            {isYearDropdownOpen && (
              <div className="gallery-year-select-dropdown">
                <div
                  className={`gallery-year-select-option ${selectedYear === 'all' ? 'active' : ''}`}
                  onClick={() => handleYearChange('all')}
                >
                  {t('gallery.filter_all_years', '全部年份')}
                </div>
                {availableYears.map((year) => (
                  <div
                    key={year}
                    className={`gallery-year-select-option ${selectedYear === year ? 'active' : ''}`}
                    onClick={() => handleYearChange(year)}
                  >
                    {year}年
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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
                    <span className="gallery-list-item-date">{formatDateRange(item)}</span>
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
