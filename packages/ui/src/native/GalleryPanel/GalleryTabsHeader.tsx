import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '../theme'
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
          active && {
            backgroundColor: colors.primary,
            shadowColor: colors.primary,
            shadowOpacity: 0.3,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 4 },
            elevation: 4
          }
        ]}
        onPress={() => onTabChange(tab)}
      >
        <Text
          style={[
            styles.tabText,
            { color: active ? '#ffffff' : colors.textSecondary, fontWeight: active ? '600' : '500' }
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
        <View style={[styles.compactTabsRow, { backgroundColor: colors.bgSurface }]}>
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
            <MaterialIcons
              name={isYearPickerOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
              size={18}
              color={colors.textSecondary}
            />
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
            backgroundColor: colors.bgSurface,
            borderColor: colors.borderSubtle
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
              borderColor: isYearPickerOpen ? colors.primary : `rgba(${colors.primaryRgb ?? '91, 168, 245'}, 0.2)`
            }
          ]}
          onPress={onOpenYearPicker}
        >
          <Text style={[styles.yearTriggerText, { color: colors.textPrimary }]}>
            {selectedYear === 'all'
              ? t('gallery.filter_all_years')
              : `${selectedYear}${t('common.year_suffix')}`}
          </Text>
          <MaterialIcons
            name={isYearPickerOpen ? 'keyboard-arrow-up' : 'keyboard-arrow-down'}
            size={16}
            color={colors.textSecondary}
          />
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
    width: '100%',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8
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
    alignItems: 'flex-end',
    width: '100%',
    marginBottom: 0,
    gap: 8
  },
  tabsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderWidth: 1,
    borderBottomWidth: 0,
    minWidth: 0
  },
  tabBtn: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 8,
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
