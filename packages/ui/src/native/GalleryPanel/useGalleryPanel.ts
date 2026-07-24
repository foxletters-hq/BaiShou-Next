import { useState, useMemo, useEffect, useCallback } from 'react'
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native'
import type { SummaryItem } from './gallery-panel.types'
import type { SummaryTab } from './gallery-panel.utils'

const PAGE_STEP = 10
const SCROLL_BOTTOM_THRESHOLD = 24

interface UseGalleryPanelOptions {
  summaries: SummaryItem[]
  onOpen?: (id: string) => void
  onSave?: (id: string, content: string) => Promise<void>
}

export function useGalleryPanel({ summaries, onOpen, onSave }: UseGalleryPanelOptions) {
  const [activeTab, setActiveTab] = useState<SummaryTab>('weekly')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [pageSize, setPageSize] = useState(PAGE_STEP)
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editContent, setEditContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [viewportHeight, setViewportHeight] = useState(0)
  const [contentHeight, setContentHeight] = useState(0)

  const availableYears = useMemo(() => {
    const years = new Set<string>()
    summaries.forEach((s) => {
      if (s.startDate) {
        const y = new Date(s.startDate).getFullYear()
        if (!isNaN(y)) years.add(String(y))
      }
    })
    return Array.from(years).sort((a, b) => b.localeCompare(a))
  }, [summaries])

  const filteredAndSortedSummaries = useMemo(() => {
    let items = summaries.filter((s) => s.type === activeTab)
    if (selectedYear !== 'all') {
      items = items.filter(
        (s) => s.startDate && new Date(s.startDate).getFullYear().toString() === selectedYear
      )
    }
    return [...items].sort((a, b) => {
      const timeA = a.startDate ? new Date(a.startDate).getTime() : 0
      const timeB = b.startDate ? new Date(b.startDate).getTime() : 0
      return timeB - timeA
    })
  }, [summaries, activeTab, selectedYear])

  const displayedSummaries = useMemo(() => {
    if (activeTab === 'weekly') return filteredAndSortedSummaries.slice(0, pageSize)
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
  useEffect(() => {
    if (!hasMoreWeekly) return
    if (viewportHeight <= 0 || contentHeight <= 0) return
    if (contentHeight <= viewportHeight + SCROLL_BOTTOM_THRESHOLD) {
      loadMore()
    }
  }, [hasMoreWeekly, viewportHeight, contentHeight, loadMore, displayedSummaries])

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

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (activeTab !== 'weekly') return
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - SCROLL_BOTTOM_THRESHOLD) {
      loadMore()
    }
  }

  const handleViewportLayout = (height: number) => {
    setViewportHeight(height)
  }

  const handleContentSizeChange = (height: number) => {
    setContentHeight(height)
  }

  const handleSave = async () => {
    if (!selectedSummary?.id || !onSave) return
    setIsSaving(true)
    try {
      await onSave(String(selectedSummary.id), editContent)
      setIsEditing(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditContent('')
  }

  const handleStartInlineEdit = (content: string) => {
    setEditContent(content)
    setIsEditing(true)
  }

  const handleItemClick = (id: string) => {
    setSelectedId(id)
    onOpen?.(id)
  }

  return {
    activeTab,
    selectedYear,
    isYearPickerOpen,
    setIsYearPickerOpen,
    isEditing,
    editContent,
    setEditContent,
    isSaving,
    availableYears,
    displayedSummaries,
    selectedSummary,
    handleTabChange,
    handleYearChange,
    handleScroll,
    handleViewportLayout,
    handleContentSizeChange,
    handleSave,
    handleCancel,
    handleStartInlineEdit,
    handleItemClick
  }
}
