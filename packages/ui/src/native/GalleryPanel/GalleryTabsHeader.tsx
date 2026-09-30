import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { SUMMARY_TABS, type SummaryTab } from './gallery-panel.utils'

interface GalleryTabsHeaderProps {
  compact?: boolean
  activeTab: SummaryTab
  selectedYear: string
  availableYears: string[]
  isYearPickerOpen: boolean
  onTabChange: (tab: SummaryTab) => void
  onOpenYearPicker: () => void
}

export const GalleryTabsHeader: React.FC<GalleryTabsHeaderProps> = ({
  compact = false,
  activeTab,
  selectedYear,
  availableYears,
  isYearPickerOpen,
  onTabChange,
  onOpenYearPicker
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const tabButtons = SUMMARY_TABS.map((tab) => {
    const active = activeTab === tab
    return (
      <Pressable
        key={tab}
        style={[
          styles.tabBtn,
          {
            borderColor: active ? colors.borderSubtle : 'transparent',
            backgroundColor: active ? colors.bgSurface : 'transparent'
          }
        ]}
        onPress={() => onTabChange(tab)}
      >
        <Text
          style={[
            styles.tabText,
            {
              color: active ? colors.primary : colors.textSecondary,
              fontWeight: active ? '600' : '500'
            }
          ]}
        >
          {t(`summary.tab_${tab}`)}
        </Text>
      </Pressable>
    )
  })

  if (compact) {
    return (
      <View
        style={[
          styles.compactRoot,
          {
            backgroundColor: colors.bgSurface,
            borderBottomColor: colors.borderSubtle
          }
        ]}
      >
        <View
          style={[
            styles.compactTabsRow,
            {
              backgroundColor: colors.bgSurfaceNormal,
              borderColor: colors.borderControl
            }
          ]}
        >
          {tabButtons}
        </View>
        {availableYears.length > 0 ? (
          <Pressable
            style={[
              styles.compactYearRow,
              {
                backgroundColor: colors.bgSurface,
                borderTopColor: colors.borderSubtle
              }
            ]}
            onPress={onOpenYearPicker}
          >
            <Text style={[styles.yearTriggerText, { color: colors.textPrimary }]}>
              {selectedYear === 'all'
                ? t('gallery.filter_all_years')
                : `${selectedYear}${t('common.year_suffix')}`}
            </Text>
            {isYearPickerOpen ? (
              <ChevronUp
                size={18}
                color={colors.textSecondary}
                strokeWidth={DEFAULT_STROKE_WIDTH}
              />
            ) : (
              <ChevronDown
                size={18}
                color={colors.textSecondary}
                strokeWidth={DEFAULT_STROKE_WIDTH}
              />
            )}
          </Pressable>
        ) : null}
      </View>
    )
  }

  return (
    <View style={styles.headerRow}>
      <View
        style={[
          styles.tabsContainer,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderControl
          }
        ]}
      >
        {tabButtons}
      </View>

      {availableYears.length > 0 && (
        <Pressable
          style={[
            styles.yearTrigger,
            {
              backgroundColor: colors.bgSurface,
              borderColor: isYearPickerOpen
                ? colors.primary
                : `rgba(${colors.primaryRgb ?? '91, 168, 245'}, 0.2)`
            }
          ]}
          onPress={onOpenYearPicker}
        >
          <Text style={[styles.yearTriggerText, { color: colors.textPrimary }]}>
            {selectedYear === 'all'
              ? t('gallery.filter_all_years')
              : `${selectedYear}${t('common.year_suffix')}`}
          </Text>
          {isYearPickerOpen ? (
            <ChevronUp size={16} color={colors.textSecondary} strokeWidth={DEFAULT_STROKE_WIDTH} />
          ) : (
            <ChevronDown
              size={16}
              color={colors.textSecondary}
              strokeWidth={DEFAULT_STROKE_WIDTH}
            />
          )}
        </Pressable>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  compactRoot: {
    width: '100%',
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  compactTabsRow: {
    flexDirection: 'row',
    alignSelf: 'stretch',
    marginHorizontal: 12,
    marginVertical: 8,
    gap: 0,
    padding: 3,
    borderRadius: 10,
    borderWidth: 1
  },
  compactYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 0,
    gap: 8
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 0,
    padding: 3,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: 0
  },
  tabBtn: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: 'center'
  },
  tabText: {
    fontSize: 13,
    textAlign: 'center'
  },
  yearTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 100
  },
  yearTriggerText: {
    fontSize: 14,
    fontWeight: '600'
  }
})
