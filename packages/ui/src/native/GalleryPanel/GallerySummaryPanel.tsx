import React from 'react'
import { View, Text, Pressable, FlatList, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { SummaryItem } from './gallery-panel.types'
import {
  SUMMARY_TABS,
  formatDateRange,
  getTitle,
  getPreview,
  type SummaryTab
} from './gallery-panel.utils'
import { galleryPanelStyles as styles } from './gallery-panel.styles'

interface GallerySummaryPanelProps {
  activeTab: SummaryTab
  selectedYear: string
  selectedId: string | null
  availableYears: string[]
  filteredAndSortedSummaries: SummaryItem[]
  onTabChange: (tab: SummaryTab) => void
  onYearChange: (year: string) => void
  onItemClick: (id: string) => void
  onEdit?: (id: string) => void
  onDelete?: (id: string) => void
}

export const GallerySummaryPanel: React.FC<GallerySummaryPanelProps> = ({
  activeTab,
  selectedYear,
  selectedId,
  availableYears,
  filteredAndSortedSummaries,
  onTabChange,
  onYearChange,
  onItemClick,
  onEdit,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View style={styles.summaryContainer}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
      >
        {SUMMARY_TABS.map((tab) => (
          <Pressable
            key={tab}
            style={[
              styles.tabButton,
              {
                backgroundColor: activeTab === tab ? colors.primary + '20' : 'transparent',
                borderColor: activeTab === tab ? colors.primary : colors.borderSubtle
              }
            ]}
            onPress={() => onTabChange(tab)}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === tab ? colors.primary : colors.textSecondary }
              ]}
            >
              {t(`summary.tab_${tab}`, tab)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {availableYears.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.yearContainer}
          contentContainerStyle={styles.yearContent}
        >
          <Pressable
            style={[
              styles.yearButton,
              {
                backgroundColor: selectedYear === 'all' ? colors.primary + '20' : 'transparent',
                borderColor: selectedYear === 'all' ? colors.primary : colors.borderSubtle
              }
            ]}
            onPress={() => onYearChange('all')}
          >
            <Text
              style={[
                styles.yearText,
                { color: selectedYear === 'all' ? colors.primary : colors.textSecondary }
              ]}
            >
              {t('gallery.filter_all_years', '全部年份')}
            </Text>
          </Pressable>
          {availableYears.map((year) => (
            <Pressable
              key={year}
              style={[
                styles.yearButton,
                {
                  backgroundColor: selectedYear === year ? colors.primary + '20' : 'transparent',
                  borderColor: selectedYear === year ? colors.primary : colors.borderSubtle
                }
              ]}
              onPress={() => onYearChange(year)}
            >
              <Text
                style={[
                  styles.yearText,
                  { color: selectedYear === year ? colors.primary : colors.textSecondary }
                ]}
              >
                {year}年
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {filteredAndSortedSummaries.length === 0 ? (
        <View style={styles.emptySummary}>
          <Text style={[styles.emptyIcon, { color: colors.textTertiary }]}>📋</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            {t('summary.no_data', '无聚合数据产生')}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredAndSortedSummaries}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.summaryItem,
                {
                  backgroundColor:
                    String(item.id) === selectedId ? colors.primary + '10' : colors.bgSurfaceNormal,
                  borderColor:
                    String(item.id) === selectedId ? colors.primary : colors.borderSubtle
                }
              ]}
              onPress={() => onItemClick(String(item.id))}
            >
              <View style={styles.summaryItemHeader}>
                <Text style={[styles.summaryItemTitle, { color: colors.textPrimary }]}>
                  {getTitle(item, t)}
                </Text>
                <Text style={[styles.summaryItemDate, { color: colors.textTertiary }]}>
                  {formatDateRange(item)}
                </Text>
              </View>
              <Text
                style={[styles.summaryItemPreview, { color: colors.textSecondary }]}
                numberOfLines={2}
              >
                {getPreview(item.content)}
              </Text>
              <View style={styles.summaryItemActions}>
                {onEdit && (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.primary + '20' }]}
                    onPress={() => onEdit(String(item.id))}
                  >
                    <Text style={[styles.actionText, { color: colors.primary }]}>
                      {t('common.edit', '编辑')}
                    </Text>
                  </Pressable>
                )}
                {onDelete && (
                  <Pressable
                    style={[styles.actionButton, { backgroundColor: colors.error + '20' }]}
                    onPress={() => onDelete(String(item.id))}
                  >
                    <Text style={[styles.actionText, { color: colors.error }]}>
                      {t('common.delete', '删除')}
                    </Text>
                  </Pressable>
                )}
              </View>
            </Pressable>
          )}
          scrollEnabled={false}
        />
      )}
    </View>
  )
}
