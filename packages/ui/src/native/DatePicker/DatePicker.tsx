import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface DatePickerProps {
  value: Date
  onChange: (date: Date) => void
  minDate?: Date
  maxDate?: Date
}

export const DatePicker: React.FC<DatePickerProps> = ({
  value,
  onChange,
  minDate,
  maxDate
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()

  const currentYear = value.getFullYear()
  const currentMonth = value.getMonth()
  const currentDay = value.getDate()

  const startYear = minDate?.getFullYear() ?? currentYear - 10
  const endYear = maxDate?.getFullYear() ?? currentYear + 10

  const years = useMemo(() => {
    const result: number[] = []
    for (let y = startYear; y <= endYear; y++) {
      result.push(y)
    }
    return result
  }, [startYear, endYear])

  const months = useMemo(
    () => Array.from({ length: 12 }, (_, i) => i),
    []
  )

  const daysInMonth = useMemo(() => {
    return new Date(currentYear, currentMonth + 1, 0).getDate()
  }, [currentYear, currentMonth])

  const days = useMemo(
    () => Array.from({ length: daysInMonth }, (_, i) => i + 1),
    [daysInMonth]
  )

  const isDayDisabled = useCallback(
    (day: number) => {
      const date = new Date(currentYear, currentMonth, day)
      if (minDate && date < minDate) return true
      if (maxDate && date > maxDate) return true
      return false
    },
    [currentYear, currentMonth, minDate, maxDate]
  )

  const isMonthDisabled = useCallback(
    (month: number) => {
      const date = new Date(currentYear, month, 1)
      if (minDate && new Date(currentYear, month + 1, 0) < minDate) return true
      if (maxDate && date > maxDate) return true
      return false
    },
    [currentYear, minDate, maxDate]
  )

  const handleYearChange = (year: number) => {
    const newDate = new Date(value)
    newDate.setFullYear(year)
    const maxDay = new Date(year, currentMonth + 1, 0).getDate()
    if (newDate.getDate() > maxDay) {
      newDate.setDate(maxDay)
    }
    if (minDate && newDate < minDate) return
    if (maxDate && newDate > maxDate) return
    onChange(newDate)
  }

  const handleMonthChange = (month: number) => {
    const newDate = new Date(value)
    newDate.setMonth(month)
    const maxDay = new Date(currentYear, month + 1, 0).getDate()
    if (newDate.getDate() > maxDay) {
      newDate.setDate(maxDay)
    }
    if (minDate && newDate < minDate) return
    if (maxDate && newDate > maxDate) return
    onChange(newDate)
  }

  const handleDayChange = (day: number) => {
    const newDate = new Date(value)
    newDate.setDate(day)
    onChange(newDate)
  }

  const pad = (n: number) => n.toString().padStart(2, '0')

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.bgSurface,
          borderColor: colors.borderSubtle
        }
      ]}
    >
      {/* Display */}
      <View style={[styles.display, { backgroundColor: colors.bgSurfaceNormal }]}>
        <Text style={[styles.displayText, { color: colors.textPrimary }]}>
          {currentYear}-{pad(currentMonth + 1)}-{pad(currentDay)}
        </Text>
      </View>

      {/* Year Picker */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t('datePicker.year', '年份')}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pickerRow}
        contentContainerStyle={styles.pickerContent}
      >
        {years.map((year) => (
          <Pressable
            key={year}
            style={[
              styles.pickerItem,
              {
                backgroundColor:
                  year === currentYear ? colors.primary : colors.bgSurfaceNormal,
                borderRadius: 8
              }
            ]}
            onPress={() => handleYearChange(year)}
          >
            <Text
              style={[
                styles.pickerItemText,
                {
                  color: year === currentYear ? colors.onPrimary : colors.textPrimary
                }
              ]}
            >
              {year}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Month Picker */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t('datePicker.month', '月份')}
      </Text>
      <View style={styles.gridRow}>
        {months.map((month) => {
          const disabled = isMonthDisabled(month)
          return (
            <Pressable
              key={month}
              style={[
                styles.gridItem,
                {
                  backgroundColor:
                    month === currentMonth ? colors.primary : colors.bgSurfaceNormal,
                  opacity: disabled ? 0.3 : 1,
                  borderRadius: 8
                }
              ]}
              onPress={() => !disabled && handleMonthChange(month)}
              disabled={disabled}
            >
              <Text
                style={[
                  styles.gridItemText,
                  {
                    color:
                      month === currentMonth ? colors.onPrimary : colors.textPrimary
                  }
                ]}
              >
                {month + 1}月
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Day Picker */}
      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>
        {t('datePicker.day', '日期')}
      </Text>
      <View style={styles.gridRow}>
        {days.map((day) => {
          const disabled = isDayDisabled(day)
          return (
            <Pressable
              key={day}
              style={[
                styles.gridItem,
                {
                  backgroundColor:
                    day === currentDay ? colors.primary : colors.bgSurfaceNormal,
                  opacity: disabled ? 0.3 : 1,
                  borderRadius: 8
                }
              ]}
              onPress={() => !disabled && handleDayChange(day)}
              disabled={disabled}
            >
              <Text
                style={[
                  styles.gridItemText,
                  {
                    color: day === currentDay ? colors.onPrimary : colors.textPrimary
                  }
                ]}
              >
                {day}
              </Text>
            </Pressable>
          )
        })}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16
  },
  display: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center'
  },
  displayText: {
    fontSize: 24,
    fontWeight: '700'
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8
  },
  pickerRow: {
    marginBottom: 14,
    maxHeight: 48
  },
  pickerContent: {
    gap: 8,
    paddingVertical: 4
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 60,
    alignItems: 'center'
  },
  pickerItemText: {
    fontSize: 15,
    fontWeight: '600'
  },
  gridRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4
  },
  gridItem: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 48,
    alignItems: 'center'
  },
  gridItemText: {
    fontSize: 13,
    fontWeight: '500'
  }
})
