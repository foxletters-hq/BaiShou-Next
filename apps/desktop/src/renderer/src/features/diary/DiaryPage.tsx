import { useTranslation } from 'react-i18next'
import React, { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { normalizeWeatherId, type WeatherId } from '@baishou/shared'
import { WEATHER_IDS } from '@baishou/shared'
import { useDiaryData } from './hooks/useDiaryData'
import type { DiaryEntry } from './DiaryCard'
import { useToast } from '@baishou/ui'
import { DiaryAppBar } from './components/DiaryAppBar'
import { DiaryGrid } from './components/DiaryGrid'
import './DiaryPage.css'

export const DiaryPage: React.FC = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const toast = useToast()

  // 搜索与月份状态（持久化到 sessionStorage）
  const [searchQuery, setSearchQuery] = useState(
    () => sessionStorage.getItem('diary_searchQuery') || ''
  )
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

  // 筛选状态（持久化到 sessionStorage）
  const [filterWeathers, setFilterWeathers] = useState<string[]>(() => {
    try {
      const saved = sessionStorage.getItem('diary_filterWeathers')
      if (!saved) return []
      const parsed = JSON.parse(saved) as unknown
      if (!Array.isArray(parsed)) return []
      const ids = parsed
        .map((w) => normalizeWeatherId(String(w)))
        .filter((w): w is WeatherId => (WEATHER_IDS as readonly string[]).includes(w))
      return [...new Set(ids)]
    } catch {
      return []
    }
  })
  const [filterFavorite, setFilterFavorite] = useState(
    () => sessionStorage.getItem('diary_filterFavorite') === 'true'
  )

  // 分页状态（持久化到 sessionStorage）
  const [currentPage, setCurrentPage] = useState(() => {
    const saved = sessionStorage.getItem('diary_currentPage')
    return saved ? Math.max(1, Number(saved)) : 1
  })
  const [pageSize, setPageSize] = useState(() => {
    const saved = sessionStorage.getItem('diary_pageSize')
    return saved ? Number(saved) : 50
  })

  const [todayEntry, setTodayEntry] = useState<DiaryEntry | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [attachmentBasePath, setAttachmentBasePath] = useState<string>('')
  const gridScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const api = (window as any).api
    if (!api?.diary?.onSyncEvent) return

    const unsubscribe = api.diary.onSyncEvent((event: { type?: string }) => {
      if (event?.type === 'saved') {
        gridScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
      }
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // sessionStorage 同步
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
  useEffect(() => {
    sessionStorage.setItem('diary_currentPage', String(currentPage))
  }, [currentPage])
  useEffect(() => {
    sessionStorage.setItem('diary_pageSize', String(pageSize))
  }, [pageSize])

  // 筛选条件变化时重置到第一页，并将列表滚回顶部
  useEffect(() => {
    setCurrentPage(1)
    gridScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [selectedMonth, searchQuery, filterWeathers, filterFavorite])

  useEffect(() => {
    gridScrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [currentPage])

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

  // 页码越界时自动修正
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  // 获取今日日记（用于决定顶部按钮状态）
  useEffect(() => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
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

  // 获取当前月份的附件目录路径
  useEffect(() => {
    if (!selectedMonth) return
    const dateStr = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}-01`
    ;(window as any).api?.diary
      ?.getAttachmentDir?.(dateStr)
      ?.then((res: any) => {
        if (res?.success && res.path) setAttachmentBasePath(res.path)
      })
      .catch(() => {})
  }, [selectedMonth])

  const goToEditor = (dateStr: string) => {
    sessionStorage.setItem('desktop_last_nav', '/diary')
    navigate(`/diary/${dateStr}`)
  }

  const handleEditToday = () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    sessionStorage.setItem('desktop_last_nav', '/diary')
    navigate(todayEntry ? `/diary/${dateStr}?append=1` : `/diary/${dateStr}`)
  }

  const handleAddNew = () => {
    const today = new Date()
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    sessionStorage.setItem('desktop_last_nav', '/diary')
    navigate(`/diary/new?date=${dateStr}`)
  }

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

  const displayEntries = useMemo(() => {
    if (!entries || entries.length === 0) return []
    return entries.map(
      (e) =>
        ({
          id: e.id,
          date: e.date ? new Date(e.date) : new Date(),
          content: e.content || '',
          tags: e.tags || [],
          preview: e.preview || e.content?.substring(0, 500) || '',
          weather: e.weather,
          mood: e.mood,
          location: e.location,
          isFavorite: e.isFavorite,
          hasMedia: e.hasMedia || false
        }) as DiaryEntry
    )
  }, [entries])

  return (
    <div className="diary-page-container">
      <DiaryAppBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        selectedMonth={selectedMonth}
        onMonthChange={setSelectedMonth}
        filterWeathers={filterWeathers}
        onFilterWeathersChange={setFilterWeathers}
        filterFavorite={filterFavorite}
        onFilterFavoriteChange={setFilterFavorite}
        todayEntry={todayEntry}
        onEditToday={handleEditToday}
        onAddNew={handleAddNew}
      />

      <DiaryGrid
        scrollRef={gridScrollRef}
        entries={displayEntries}
        totalCount={totalCount}
        currentPage={currentPage}
        pageSize={pageSize}
        selectedMonth={selectedMonth}
        loading={loading}
        attachmentBasePath={attachmentBasePath}
        onGoToEditor={goToEditor}
        onDeleteEntry={setDeletingId}
        onPageChange={setCurrentPage}
        onPageSizeChange={setPageSize}
        onViewAll={() => setSelectedMonth(null)}
      />

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
