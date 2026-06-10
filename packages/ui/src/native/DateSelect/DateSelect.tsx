import React, { useMemo, useCallback } from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { DateSelectField, DateSelectProps } from './date-select.types'
import { DateSelectWheelColumn } from './DateSelectWheelColumn'
import {
  clampDateParts,
  getDatePickerYears,
  getDayWheelLabels,
  getMonthWheelLabels
} from './date-select.utils'

const DEFAULT_FIELDS: DateSelectField[] = ['year', 'month', 'day']

function clampWithBounds(date: Date, minDate?: Date, maxDate?: Date): Date {
  let next = date
  if (minDate && next < minDate) next = minDate
  if (maxDate && next > maxDate) next = maxDate
  return next
}

/**
 * 通用日期滚轮选择器。通过 `fields` 控制展示哪些列：
 * - `['year']` 仅年
 * - `['year', 'month']` 年月
 * - `['year', 'month', 'day']` 完整日期（默认）
 */
export const DateSelect: React.FC<DateSelectProps> = ({
  value,
  onChange,
  fields = DEFAULT_FIELDS,
  scrollKey = 'default',
  minDate,
  maxDate,
  selectionBandColor
}) => {
  const { t } = useTranslation()
  const years = useMemo(() => getDatePickerYears(), [])
  const monthLabels = useMemo(() => getMonthWheelLabels(t), [t])

  const showYear = fields.includes('year')
  const showMonth = fields.includes('month')
  const showDay = fields.includes('day')

  const yearIndex = Math.max(0, years.indexOf(value.getFullYear()))
  const monthIndex = value.getMonth()
  const dayIndex = value.getDate() - 1

  const dayLabels = useMemo(
    () => getDayWheelLabels(value.getFullYear(), value.getMonth()),
    [value.getFullYear(), value.getMonth()]
  )

  const applyParts = useCallback(
    (year: number, month: number, day: number) => {
      const resolvedDay = showDay ? day : 1
      const resolvedMonth = showMonth ? month : value.getMonth()
      const resolvedYear = showYear ? year : value.getFullYear()
      const next = clampDateParts(resolvedYear, resolvedMonth, resolvedDay)
      onChange(clampWithBounds(next, minDate, maxDate))
    },
    [showDay, showMonth, showYear, value, onChange, minDate, maxDate]
  )

  const handleYearIndex = useCallback(
    (index: number) => {
      const y = years[index] ?? value.getFullYear()
      applyParts(y, value.getMonth(), value.getDate())
    },
    [years, value, applyParts]
  )

  const handleMonthIndex = useCallback(
    (index: number) => {
      applyParts(value.getFullYear(), index, value.getDate())
    },
    [value, applyParts]
  )

  const handleDayIndex = useCallback(
    (index: number) => {
      applyParts(value.getFullYear(), value.getMonth(), index + 1)
    },
    [value, applyParts]
  )

  const dayScrollKey = showDay
    ? `${scrollKey}-d-${value.getFullYear()}-${value.getMonth()}`
    : `${scrollKey}-d`

  return (
    <View style={styles.row}>
      {showYear && (
        <DateSelectWheelColumn
          scrollKey={`${scrollKey}-y`}
          items={years.map(String)}
          selectedIndex={yearIndex}
          onIndexChange={handleYearIndex}
          selectionBandColor={selectionBandColor}
        />
      )}
      {showMonth && (
        <DateSelectWheelColumn
          scrollKey={`${scrollKey}-m`}
          items={monthLabels}
          selectedIndex={monthIndex}
          onIndexChange={handleMonthIndex}
          selectionBandColor={selectionBandColor}
        />
      )}
      {showDay && (
        <DateSelectWheelColumn
          scrollKey={dayScrollKey}
          items={dayLabels}
          selectedIndex={Math.min(dayIndex, dayLabels.length - 1)}
          onIndexChange={handleDayIndex}
          selectionBandColor={selectionBandColor}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8
  }
})
