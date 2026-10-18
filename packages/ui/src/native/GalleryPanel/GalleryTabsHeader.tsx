import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp } from 'lucide-react-native'
import { useNativeTheme } from '../theme'
import { SegmentedControl } from '../SegmentedControl'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { SUMMARY_TABS, type SummaryTab } from './gallery-panel.utils'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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

  const tabOptions = SUMMARY_TABS.map((tab) => ({
    value: tab,
    label: t(`summary.tab_${tab}`)
  }))

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
        <View style={styles.compactTabsWrap}>
          <SegmentedControl
            size="small"
            value={activeTab}
            options={tabOptions}
            onChange={onTabChange}
          />
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
      <View style={styles.tabsWrap}>
        <SegmentedControl
          size="small"
          value={activeTab}
          options={tabOptions}
          onChange={onTabChange}
        />
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
  compactTabsWrap: {
    alignSelf: 'stretch',
    marginHorizontal: sharedTokens.spacing.mdTight,
    marginVertical: sharedTokens.spacing.sm
  },
  compactYearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.smPlus,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 0,
    gap: sharedTokens.spacing.sm
  },
  tabsWrap: {
    flex: 1,
    minWidth: 0
  },
  yearTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.mdSnug,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm,
    borderWidth: 1,
    minWidth: 100
  },
  yearTriggerText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  }
})
