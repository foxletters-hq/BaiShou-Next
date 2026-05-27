import { useMemo, useState } from 'react'
import type { SummaryItem } from './gallery-panel.types'
import type { SummaryTab } from './gallery-panel.utils'

export function useGallerySummaryFilter(summaries: SummaryItem[]) {
  const [activeTab, setActiveTab] = useState<SummaryTab>('weekly')
  const [selectedYear, setSelectedYear] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

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

  const selectedSummary = useMemo(() => {
    if (selectedId) {
      return filteredAndSortedSummaries.find((s) => String(s.id) === selectedId)
    }
    return filteredAndSortedSummaries[0]
  }, [filteredAndSortedSummaries, selectedId])

  const handleTabChange = (tab: SummaryTab) => {
    setActiveTab(tab)
    setSelectedId(null)
    setSelectedYear('all')
  }

  const handleYearChange = (year: string) => {
    setSelectedYear(year)
    setSelectedId(null)
  }

  const handleItemClick = (id: string, onOpen?: (id: string) => void) => {
    setSelectedId(id)
    onOpen?.(id)
  }

  return {
    activeTab,
    selectedYear,
    selectedId,
    availableYears,
    filteredAndSortedSummaries,
    selectedSummary,
    handleTabChange,
    handleYearChange,
    handleItemClick
  }
}
