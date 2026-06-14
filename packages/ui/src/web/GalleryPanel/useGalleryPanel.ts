import { useState, useMemo, useEffect, useRef, type UIEvent } from 'react'
import type { SummaryItem } from './gallery-panel.types'
import type { SummaryTab } from './gallery-panel.utils'

interface UseGalleryPanelOptions {
  summaries: SummaryItem[]
  onOpen?: (id: string) => void
  onSave?: (id: string, content: string) => Promise<void>
}

export function useGalleryPanel({ summaries, onOpen, onSave }: UseGalleryPanelOptions) {
  const [activeTab, setActiveTab] = useState<SummaryTab>('weekly')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [pageSize, setPageSize] = useState<number>(10)
  const [isYearPickerOpen, setIsYearPickerOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const activeYearRef = useRef<HTMLButtonElement>(null)
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

  const handleTabChange = (tab: SummaryTab) => {
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

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    if (activeTab !== 'weekly') return
    const target = e.currentTarget
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
