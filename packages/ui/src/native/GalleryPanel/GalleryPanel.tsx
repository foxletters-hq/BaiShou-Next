import React from 'react'
import { View, StyleSheet, useWindowDimensions } from 'react-native'
import { useNativeTheme } from '../theme'
import type { GalleryPanelProps } from './gallery-panel.types'
import { useGalleryPanel } from './useGalleryPanel'
import { GalleryTabsHeader } from './GalleryTabsHeader'
import { GalleryYearPickerModal } from './GalleryYearPickerModal'
import { GallerySummaryList } from './GallerySummaryList'
import { GallerySummaryDetail } from './GallerySummaryDetail'
import { GalleryImageGrid } from './GalleryImageGrid'

export type { GalleryImage, SummaryItem, GalleryPanelProps } from './gallery-panel.types'
export type { SummaryTab } from './gallery-panel.utils'

const COMPACT_BREAKPOINT = 720

/** 记忆画廊：宽屏双栏；手机列表 + 点击进入详情 */
export const GalleryPanel: React.FC<GalleryPanelProps> = ({
  images,
  onImagePress,
  summaries,
  onOpen,
  onEdit,
  onDelete,
  onSave
}) => {
  const isSummaryMode = summaries !== undefined
  const summaryItems = summaries ?? []
  const { width } = useWindowDimensions()
  const isCompact = width < COMPACT_BREAKPOINT

  if (!isSummaryMode) {
    return <GalleryImageGrid images={images ?? []} onImagePress={onImagePress} />
  }

  const { colors } = useNativeTheme()
  const panel = useGalleryPanel({ summaries: summaryItems, onOpen, onSave })

  const handleListItemPress = (id: string) => {
    if (isCompact) {
      onOpen?.(id)
      return
    }
    panel.handleItemClick(id)
  }

  return (
    <View style={styles.root}>
      <GalleryTabsHeader
        compact={isCompact}
        activeTab={panel.activeTab}
        selectedYear={panel.selectedYear}
        availableYears={panel.availableYears}
        isYearPickerOpen={panel.isYearPickerOpen}
        onTabChange={panel.handleTabChange}
        onOpenYearPicker={() => panel.setIsYearPickerOpen(true)}
      />

      <GalleryYearPickerModal
        isOpen={panel.isYearPickerOpen}
        selectedYear={panel.selectedYear}
        availableYears={panel.availableYears}
        onClose={() => panel.setIsYearPickerOpen(false)}
        onYearChange={panel.handleYearChange}
      />

      {isCompact ? (
        <GallerySummaryList
          compact
          items={panel.displayedSummaries}
          onItemClick={handleListItemPress}
          onScroll={panel.handleScroll}
        />
      ) : (
        <View
          style={[
            styles.layout,
            {
              backgroundColor: colors.bgSurface,
              borderColor: colors.borderSubtle
            }
          ]}
        >
          <GallerySummaryList
            items={panel.displayedSummaries}
            selectedSummary={panel.selectedSummary}
            onItemClick={handleListItemPress}
            onScroll={panel.handleScroll}
          />
          <GallerySummaryDetail
            summary={panel.selectedSummary}
            isEditing={panel.isEditing}
            editContent={panel.editContent}
            isSaving={panel.isSaving}
            canInlineEdit={!!onSave}
            onEditContentChange={panel.setEditContent}
            onStartInlineEdit={panel.handleStartInlineEdit}
            onEdit={onEdit}
            onDelete={onDelete}
            onSave={panel.handleSave}
            onCancel={panel.handleCancel}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0
  },
  layout: {
    flex: 1,
    flexDirection: 'row',
    minHeight: 0,
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden'
  },
})
