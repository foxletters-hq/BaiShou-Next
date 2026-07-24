import { useState, useMemo, useEffect, useRef, useCallback, type UIEvent } from 'react'
import type { SummaryItem } from './gallery-panel.types'
import type { SummaryTab } from './gallery-panel.utils'

const PAGE_STEP = 10
const SCROLL_BOTTOM_THRESHOLD = 20

interface UseGalleryPanelOptions {
  summaries: SummaryItem[]
  onOpen?: (id: string) => void
  onSave?: (id: string, content: string) => Promise<void>
}

export function useGalleryPanel({ summaries, onOpen, onSave }: UseGalleryPanelOptions) {
  const [activeTab, setActiveTab] = useState<SummaryTab>('weekly')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [pageSize, setPageSize] = useState<number>(PAGE_STEP)
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const activeYearRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (isYearPickerOpen) {
      setTimeout(() => {
        activeYearRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' })
      }, 80)
    }
  }, [isYearPickerOpen])

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

  const filteredAndSortedSummaries = useMemo(() => {
    let items = summaries.filter((s) => s.type === activeTab)

    if (selectedYear !== 'all') {
      items = items.filter((s) => {
        if (!s.startDate) return false
        return new Date(s.startDate).getFullYear().toString() === selectedYear
      })
    }

    return [...items].sort((a, b) => {
      const timeA = a.startDate ? new Date(a.startDate).getTime() : 0
      const timeB = b.startDate ? new Date(b.startDate).getTime() : 0
      return timeB - timeA
    })
  }, [summaries, activeTab, selectedYear])

  const displayedSummaries = useMemo(() => {
    if (activeTab === 'weekly') {
      return filteredAndSortedSummaries.slice(0, pageSize)
    }
    return filteredAndSortedSummaries
  }, [filteredAndSortedSummaries, activeTab, pageSize])

  const selectedSummary = useMemo(() => {
    if (selectedId) {
      const found = filteredAndSortedSummaries.find((s) => String(s.id) === selectedId)
      if (found) return found
    }
    return filteredAndSortedSummaries[0]
  }, [filteredAndSortedSummaries, selectedId])

  useEffect(() => {
    setIsEditing(false)
    setEditContent('')
  }, [selectedSummary?.id, activeTab])

  const totalCount = filteredAndSortedSummaries.length
  const hasMoreWeekly = activeTab === 'weekly' && pageSize < totalCount

  const loadMore = useCallback(() => {
    setPageSize((prev) => (prev < totalCount ? prev + PAGE_STEP : prev))
  }, [totalCount])

  /** 大屏首屏内容撑不满时不会产生 scroll，需主动补页直到可滚动或没有更多 */
  const fillViewportIfNeeded = useCallback(() => {
    if (!hasMoreWeekly) return
    const el = listRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + SCROLL_BOTTOM_THRESHOLD) {
      loadMore()
    }
  }, [hasMoreWeekly, loadMore])

  useEffect(() => {
    fillViewportIfNeeded()
  }, [fillViewportIfNeeded, displayedSummaries])

  useEffect(() => {
    const el = listRef.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      fillViewportIfNeeded()
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [fillViewportIfNeeded])

  const handleTabChange = (tab: SummaryTab) => {
    setActiveTab(tab)
    setSelectedId(null)
    setPageSize(PAGE_STEP)
    setIsYearPickerOpen(false)
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    setSelectedId(null)
    setPageSize(PAGE_STEP)
    setIsYearPickerOpen(false)
  }

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (activeTab !== 'weekly') return
    const target = e.currentTarget
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + SCROLL_BOTTOM_THRESHOLD) {
      loadMore()
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

  const handleItemClick = (id: string) => {
    setSelectedId(id)
    onOpen?.(id)
  }

  return {
    activeTab,
    selectedYear,
    pageSize,
    isYearPickerOpen,
    setIsYearPickerOpen,
    mounted,
    activeYearRef,
    listRef,
    isEditing,
    setIsEditing,
    editContent,
    setEditContent,
    isSaving,
    availableYears,
    displayedSummaries,
    selectedSummary,
    handleTabChange,
    handleYearChange,
    handleScroll,
    handleSave,
    handleCancel,
    handleItemClick
  }
}
