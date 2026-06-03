import React, { useState, useMemo } from 'react'
import { Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { YearMonthPickerProps } from './year-month-picker.types'
import { formatYearMonthLabel } from './year-month-picker.utils'
import { yearMonthPickerStyles as styles } from './year-month-picker.styles'
import { YearMonthPickerModal } from './YearMonthPickerModal'

export const YearMonthPicker: React.FC<YearMonthPickerProps> = ({
  selectedMonth,
  onChange,
  titlePlaceholder
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [isOpen, setIsOpen] = useState(false)
  const placeholder = titlePlaceholder ?? t('diary.all_diaries')

  const displayText = useMemo(() => {
    if (!selectedMonth) return placeholder
    return formatYearMonthLabel(selectedMonth.getFullYear(), selectedMonth.getMonth(), t)
  }, [selectedMonth, placeholder, t])

  const isActive = Boolean(selectedMonth)

  return (
    <>
      <TouchableOpacity
        style={[
          styles.triggerBtn,
          {
            backgroundColor: colors.bgSurface,
            borderWidth: 1,
            borderColor: isActive ? colors.primary : colors.borderSubtle
          }
        ]}
        onPress={() => setIsOpen(true)}
      >
        <Text
          style={[
            styles.triggerText,
            { color: isActive ? colors.primary : colors.textPrimary }
          ]}
        >
          {displayText}
        </Text>
        <Text style={[styles.triggerArrow, { color: colors.textSecondary }]}>▼</Text>
      </TouchableOpacity>

      <YearMonthPickerModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        selectedMonth={selectedMonth}
        onChange={onChange}
        colors={colors}
      />
    </>
  )
}
