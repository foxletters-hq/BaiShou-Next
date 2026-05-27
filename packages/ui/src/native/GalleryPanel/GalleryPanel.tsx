import React from 'react'
import type { GalleryPanelProps } from './gallery-panel.types'
import { useGallerySummaryFilter } from './useGallerySummaryFilter'
import { GalleryImageGrid } from './GalleryImageGrid'
import { GallerySummaryPanel } from './GallerySummaryPanel'

export type { GalleryImage, SummaryItem, GalleryPanelProps } from './gallery-panel.types'
export type { SummaryTab } from './gallery-panel.utils'

export const GalleryPanel: React.FC<GalleryPanelProps> = ({
  images,
  onImagePress,
  summaries = [],
  onOpen,
  onEdit,
  onDelete
}) => {
  const isSummaryMode = summaries.length > 0
  const summaryFilter = useGallerySummaryFilter(summaries)

  if (isSummaryMode) {
    return (
      <GallerySummaryPanel
        activeTab={summaryFilter.activeTab}
        selectedYear={summaryFilter.selectedYear}
        selectedId={summaryFilter.selectedId}
        availableYears={summaryFilter.availableYears}
        filteredAndSortedSummaries={summaryFilter.filteredAndSortedSummaries}
        onTabChange={summaryFilter.handleTabChange}
        onYearChange={summaryFilter.handleYearChange}
        onItemClick={(id) => summaryFilter.handleItemClick(id, onOpen)}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    )
  }

  return <GalleryImageGrid images={images ?? []} onImagePress={onImagePress} />
}
