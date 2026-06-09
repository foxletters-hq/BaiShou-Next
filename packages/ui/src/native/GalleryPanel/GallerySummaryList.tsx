import React from 'react'
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
import type { SummaryItem } from './gallery-panel.types'
import { formatDateRange, formatSummarySpan, getTitle, getPreview } from './gallery-panel.utils'

interface GallerySummaryListProps {
  compact?: boolean
  items: SummaryItem[]
  selectedSummary?: SummaryItem
  onItemClick: (id: string) => void
  onScroll: (e: any) => void
  activeTab?: 'weekly' | 'monthly' | 'quarterly' | 'yearly'
}

export const GallerySummaryList: React.FC<GallerySummaryListProps> = ({
  compact = false,
  items,
  selectedSummary,
  onItemClick,
  onScroll,
  activeTab
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
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    >
      {items.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="edit-note" size={48} color={colors.textTertiary} />
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
                <MaterialIcons name="chevron-right" size={22} color={colors.textTertiary} />
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
    padding: 8,
    flexGrow: 1
  },
  listContentCompact: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12
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
    gap: 12,
    paddingHorizontal: 32,
    paddingVertical: 24
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600'
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center'
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
    borderRadius: 10,
    borderLeftWidth: 3
  },
  compactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    paddingVertical: 16,
    paddingHorizontal: 16
  },
  itemMain: {
    flex: 1,
    minWidth: 0
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1
  },
  itemTitleCompact: {
    fontSize: 16,
    marginBottom: 0
  },
  itemDate: {
    fontSize: 12
  },
  itemPath: {
    fontSize: 12,
    marginTop: 4,
    marginBottom: 4
  },
  itemPreview: {
    fontSize: 13,
    lineHeight: 18
  }
})
