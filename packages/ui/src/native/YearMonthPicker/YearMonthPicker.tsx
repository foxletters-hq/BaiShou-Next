import React, { useState, useMemo } from 'react'
import { Text, TouchableOpacity } from 'react-native'
import { useNativeTheme } from '../theme'
import type { YearMonthPickerProps } from './year-month-picker.types'
import { MONTH_NAMES } from './year-month-picker.utils'
import { yearMonthPickerStyles as styles } from './year-month-picker.styles'
import { YearMonthPickerModal } from './YearMonthPickerModal'

export const YearMonthPicker: React.FC<YearMonthPickerProps> = ({
  selectedMonth,
  onChange,
  titlePlaceholder = '全部日期'
}) => {
  const { colors } = useNativeTheme()
  const [isOpen, setIsOpen] = useState(false)

  const displayText = useMemo(() => {
    if (!selectedMonth) return titlePlaceholder
    const y = selectedMonth.getFullYear()
    const m = MONTH_NAMES[selectedMonth.getMonth()]
    return `${y}年${m}`
  }, [selectedMonth, titlePlaceholder])

  return (
    <>
      <TouchableOpacity
        style={[styles.triggerBtn, { backgroundColor: colors.bgSurfaceHighest }]}
        onPress={() => setIsOpen(true)}
      >
        <Text
          style={[
            styles.triggerText,
            { color: selectedMonth ? colors.primary : colors.textSecondary }
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
