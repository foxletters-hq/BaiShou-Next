import React from 'react'
import { useTranslation } from 'react-i18next'
import type { GalleryPanelProps } from './gallery-panel.types'
import { useGalleryPanel } from './useGalleryPanel'
import { GalleryTabsHeader, GalleryYearPickerModal } from './GalleryYearPickerModal'
import { GallerySummaryList } from './GallerySummaryList'
import { GallerySummaryDetail } from './GallerySummaryDetail'
import './GalleryPanel.css'

export type { GalleryImage, SummaryItem, GalleryPanelProps } from './gallery-panel.types'

export const GalleryPanel: React.FC<GalleryPanelProps> = ({
  summaries = [],
  onOpen,
  onEdit,
  onDelete,
  onSave
}) => {
  const { t, i18n } = useTranslation()
  const panel = useGalleryPanel({ summaries, onOpen, onSave })

  return (
    <div className="gallery-panel">
      <GalleryTabsHeader
        activeTab={panel.activeTab}
        selectedYear={panel.selectedYear}
        availableYears={panel.availableYears}
        isYearPickerOpen={panel.isYearPickerOpen}
        onTabChange={panel.handleTabChange}
        onOpenYearPicker={() => panel.setIsYearPickerOpen(true)}
      />

      <GalleryYearPickerModal
        mounted={panel.mounted}
        isOpen={panel.isYearPickerOpen}
        selectedYear={panel.selectedYear}
        availableYears={panel.availableYears}
        activeYearRef={panel.activeYearRef}
        onClose={() => panel.setIsYearPickerOpen(false)}
        onYearChange={panel.handleYearChange}
      />

      <div className="gallery-layout">
        <GallerySummaryList
          items={panel.displayedSummaries}
          selectedSummary={panel.selectedSummary}
          language={i18n.language}
          onItemClick={panel.handleItemClick}
          onScroll={panel.handleScroll}
        />
        <div className="gallery-divider" />
        <GallerySummaryDetail
          summary={panel.selectedSummary}
          language={i18n.language}
          isEditing={panel.isEditing}
          editContent={panel.editContent}
          isSaving={panel.isSaving}
          canInlineEdit={!!onSave}
          onEditContentChange={panel.setEditContent}
          onStartInlineEdit={(content) => {
            panel.setEditContent(content)
            panel.setIsEditing(true)
          }}
          onEdit={onEdit}
          onDelete={onDelete}
          onSave={panel.handleSave}
          onCancel={panel.handleCancel}
        />
      </div>
    </div>
  )
}
