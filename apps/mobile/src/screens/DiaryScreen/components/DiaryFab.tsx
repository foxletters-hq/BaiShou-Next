import React from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Edit3, CalendarCheck, Plus } from 'lucide-react-native'
import { getNativeElevationStyle, useNativeTheme } from '@baishou/ui/native'

const FAB_MARGIN_END = 28
/** Tab 页内容区底部默认间距 */
const FAB_MARGIN_BOTTOM_DEFAULT = 24
/** 当底部出现待整理状态栏时，自动向上抬升避让状态条（高度约 34px），避免重叠 */
const FAB_MARGIN_BOTTOM_WITH_STATUS = 52

export interface DiaryFabProps {
  todayEntry: { id: number } | null
  onEditToday: () => void
  onAddNew: () => void
  hasPendingStatus?: boolean
  bottomOffset?: number
}

export const DiaryFab: React.FC<DiaryFabProps> = ({
  todayEntry,
  onEditToday,
  onAddNew,
  hasPendingStatus = false,
  bottomOffset
}) => {
  const { t } = useTranslation()
  const { colors, isDark } = useNativeTheme()
  const fabShadowSubtle = getNativeElevationStyle(isDark, 'subtle')
  const fabShadowRaised = getNativeElevationStyle(isDark, 'raised')

  const resolvedBottom =
    bottomOffset ?? (hasPendingStatus ? FAB_MARGIN_BOTTOM_WITH_STATUS : FAB_MARGIN_BOTTOM_DEFAULT)

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: resolvedBottom }]}>
      <TouchableOpacity
        onPress={onEditToday}
        style={[
          styles.fabSmall,
          {
            backgroundColor: isDark ? colors.bgSurfaceHigh : colors.secondaryContainer
          },
          fabShadowSubtle
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          todayEntry ? t('settings.edit_today_tooltip') : t('settings.write_today_tooltip')
        }
      >
        {todayEntry ? (
          <Edit3
            size={22}
            color={isDark ? colors.textSecondary : colors.onSecondaryContainer}
            strokeWidth={2}
          />
        ) : (
          <CalendarCheck
            size={22}
            color={isDark ? colors.textSecondary : colors.onSecondaryContainer}
            strokeWidth={2}
          />
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onAddNew}
        style={[styles.fabLarge, { backgroundColor: colors.primary }, fabShadowRaised]}
        accessibilityRole="button"
        accessibilityLabel={t('settings.write_diary_button')}
      >
        <Plus size={28} color={colors.textOnPrimary} strokeWidth={2} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: FAB_MARGIN_END,
    alignItems: 'center',
    gap: 14
  },
  fabSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fabLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center'
  }
})
