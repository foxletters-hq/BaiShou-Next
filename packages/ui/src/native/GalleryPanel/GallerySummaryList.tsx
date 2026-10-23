import React from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronRight, SquarePen } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import type { SummaryItem } from './gallery-panel.types'
import { formatDateRange, formatSummarySpan, getTitle, getPreview } from './gallery-panel.utils'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

interface GallerySummaryListProps {
  compact?: boolean
  items: SummaryItem[]
  selectedSummary?: SummaryItem
  onItemClick: (id: string) => void
  onScroll: (e: any) => void
  onViewportLayout?: (height: number) => void
  onContentSizeChange?: (height: number) => void
  activeTab?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
}

export const GallerySummaryList: React.FC<GallerySummaryListProps> = ({
  compact = false,
  items,
  selectedSummary,
  onItemClick,
  onScroll,
  onViewportLayout,
  onContentSizeChange,
  activeTab: _activeTab
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  return (
    <ScrollView
      style={[
        styles.list,
        compact && styles.listCompact,
        { backgroundColor: compact ? colors.bgApp : colors.bgSurface }
      ]}
      contentContainerStyle={[
        styles.listContent,
        compact && styles.listContentCompact,
        items.length === 0 && styles.listContentEmpty
      ]}
      onScroll={onScroll}
      onLayout={(e) => onViewportLayout?.(e.nativeEvent.layout.height)}
      onContentSizeChange={(_width, height) => onContentSizeChange?.(height)}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {items.length === 0 ? (
        <View style={styles.empty}>
          <SquarePen size={48} color={colors.textTertiary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {t('diary.no_content')}
          </Text>
          <Text style={[styles.emptyHint, { color: colors.textSecondary }]}>
            {t('summary.no_data_error')}
          </Text>
        </View>
      ) : (
        items.map((item) => {
          const id = String(item.id ?? '')
          const isSelected = !compact && selectedSummary?.id === item.id
          const preview = getPreview(item.content)
          const path = formatSummarySpan(item)

          return (
            <Pressable
              key={id}
              style={({ pressed }) =>
                compact
                  ? [
                      styles.compactCard,
                      {
                        backgroundColor: colors.bgSurface,
                        borderColor: colors.borderMuted,
                        opacity: pressed ? 0.92 : 1
                      }
                    ]
                  : [
                      styles.item,
                      {
                        backgroundColor: isSelected
                          ? `rgba(${colors.primaryRgb ?? '91, 168, 245'}, 0.1)`
                          : 'transparent',
                        borderLeftColor: isSelected ? colors.primary : 'transparent'
                      }
                    ]
              }
              onPress={() => onItemClick(id)}
            >
              <View style={styles.itemMain}>
                <View style={styles.itemHeader}>
                  <Text
                    style={[
                      styles.itemTitle,
                      compact && styles.itemTitleCompact,
                      { color: isSelected ? colors.primary : colors.textPrimary }
                    ]}
                    numberOfLines={compact ? 2 : 1}
                  >
                    {getTitle(item, t)}
                  </Text>
                  {!compact && item.type === 'weekly' ? (
                    <Text style={[styles.itemDate, { color: colors.textTertiary }]}>
                      {formatDateRange(item)}
                    </Text>
                  ) : null}
                </View>
                {compact && path ? (
                  <Text style={[styles.itemPath, { color: colors.textTertiary }]} numberOfLines={1}>
                    {path}
                  </Text>
                ) : null}
                {preview ? (
                  <Text
                    style={[styles.itemPreview, { color: colors.textSecondary }]}
                    numberOfLines={compact ? 1 : 2}
                  >
                    {preview}
                  </Text>
                ) : null}
              </View>
              {compact ? (
                <ChevronRight
                  size={22}
                  color={colors.textTertiary}
                  strokeWidth={DEFAULT_STROKE_WIDTH}
                />
              ) : null}
            </Pressable>
          )
        })
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  list: {
    width: '38%',
    minWidth: 140,
    maxWidth: 220,
    flexGrow: 0,
    flexShrink: 0
  },
  listCompact: {
    width: '100%',
    minWidth: 0,
    maxWidth: '100%',
    flex: 1,
    flexGrow: 1,
    flexShrink: 1
  },
  listContent: {
    padding: sharedTokens.spacing.sm,
    flexGrow: 1
  },
  listContentCompact: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingTop: sharedTokens.spacing.mdTight,
    paddingBottom: sharedTokens.spacing.lg,
    gap: sharedTokens.spacing.mdTight
  },
  listContentEmpty: {
    flexGrow: 1,
    justifyContent: 'center'
  },
  empty: {
    flex: 1,
    minHeight: 280,
    alignItems: 'center',
    justifyContent: 'center',
    gap: sharedTokens.spacing.mdTight,
    paddingHorizontal: sharedTokens.spacing.xl,
    paddingVertical: sharedTokens.spacing.lg
  },
  emptyTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600'
  },
  emptyHint: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 22,
    textAlign: 'center'
  },
  item: {
    paddingVertical: sharedTokens.spacing.mdSnug,
    paddingHorizontal: sharedTokens.spacing.md,
    marginBottom: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.control,
    borderLeftWidth: 3
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.lg,
    borderWidth: 1,
    borderStyle: 'solid',
    paddingVertical: sharedTokens.spacing.md,
    paddingHorizontal: sharedTokens.spacing.md
  },
  itemMain: {
    flex: 1,
    minWidth: 0
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: sharedTokens.spacing.xsPlus,
    gap: sharedTokens.spacing.sm
  },
  itemTitle: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600',
    flex: 1
  },
  itemTitleCompact: {
    fontSize: mobileTypography.primary.fontSize,
    marginBottom: 0
  },
  itemDate: {
    fontSize: mobileTypography.caption.fontSize
  },
  itemPath: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xs,
    marginBottom: sharedTokens.spacing.xs
  },
  itemPreview: {
    fontSize: mobileTypography.secondary.fontSize,
    lineHeight: 18
  }
})
