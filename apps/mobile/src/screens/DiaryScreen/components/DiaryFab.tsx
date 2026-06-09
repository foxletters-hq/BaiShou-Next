import React from 'react'
import { View, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MaterialIcons } from '@expo/vector-icons'
import { useNativeTheme } from '@baishou/ui/native'

const FAB_MARGIN_END = 28
/** Tab 页内容区底部即底边栏上沿，只需留小间距 */
const FAB_MARGIN_BOTTOM = 18

export interface DiaryFabProps {
  todayEntry: { id: number } | null
  onEditToday: () => void
  onAddNew: () => void
}

export const DiaryFab: React.FC<DiaryFabProps> = ({ todayEntry, onEditToday, onAddNew }) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  return (
    <View
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: FAB_MARGIN_BOTTOM }]}
    >
      <TouchableOpacity
        onPress={onEditToday}
        style={[
          styles.fabSmall,
          {
            backgroundColor: colors.secondaryContainer,
            shadowColor: colors.textPrimary
          }
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          todayEntry ? t('settings.edit_today_tooltip') : t('settings.write_today_tooltip')
        }
      >
        <MaterialIcons
          name={todayEntry ? 'edit-note' : 'today'}
          size={22}
          color={colors.onSecondaryContainer}
        />
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onAddNew}
        style={[
          styles.fabLarge,
          {
            backgroundColor: colors.primary,
            shadowColor: colors.textPrimary
          }
        ]}
        accessibilityRole="button"
        accessibilityLabel={t('settings.write_diary_button')}
      >
        <MaterialIcons name="add" size={28} color={colors.textOnPrimary} />
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: FAB_MARGIN_END,
    alignItems: 'center',
    gap: 12
  },
  fabSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4
  },
  fabLarge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 6
  }
})
