import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DatePickerFloatingModal } from '../DatePicker/DatePickerFloatingModal'

interface DiaryEditorAppBarTitleProps {
  isSummaryMode: boolean
  selectedDate: Date
  onDateChanged?: (date: Date) => void
}

export const DiaryEditorAppBarTitle: React.FC<DiaryEditorAppBarTitleProps> = ({
  isSummaryMode,
  selectedDate,
  onDateChanged
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [pickerOpen, setPickerOpen] = useState(false)

  const weekdayKeys = [
    'diary.weekday_sun',
    'diary.weekday_mon',
    'diary.weekday_tue',
    'diary.weekday_wed',
    'diary.weekday_thu',
    'diary.weekday_fri',
    'diary.weekday_sat'
  ] as const
  const monthNames = t('common.months', { returnObjects: true }) as string[]
  const month = selectedDate.getMonth() + 1
  const day = selectedDate.getDate()
  const weekday = t(weekdayKeys[selectedDate.getDay()])
  const monthShort = Array.isArray(monthNames) ? monthNames[selectedDate.getMonth()] : String(month)

  const formattedDate = t(
    'diary.date_format_editor_title',
    '{{year}}年{{month}}月{{day}}日 {{weekday}}',
    {
      year: selectedDate.getFullYear(),
      month,
      monthShort,
      day,
      weekday
    }
  )

  const openPicker = () => {
    if (isSummaryMode || !onDateChanged) return
    setPickerOpen(true)
  }

  return (
    <>
      <TouchableOpacity
        style={styles.container}
        activeOpacity={0.6}
        onPress={openPicker}
        disabled={isSummaryMode || !onDateChanged}
      >
        <View style={styles.titleContent}>
          <Text style={[styles.titleText, { color: colors.textPrimary }]} numberOfLines={1}>
            {isSummaryMode ? t('diary.edit_summary') : formattedDate}
          </Text>
          {!isSummaryMode && onDateChanged && (
            <Text style={[styles.titleIcon, { color: colors.textSecondary }]}>▼</Text>
          )}
        </View>
      </TouchableOpacity>

      <DatePickerFloatingModal
        visible={pickerOpen}
        value={selectedDate}
        onClose={() => setPickerOpen(false)}
        onConfirm={(date) => {
          onDateChanged?.(date)
          setPickerOpen(false)
        }}
      />
    </>
  )
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 20,
    backgroundColor: 'transparent',
    maxWidth: '100%'
  },
  titleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6
  },
  titleText: {
    fontSize: 17,
    fontWeight: 'bold'
  },
  titleIcon: {
    fontSize: 10
  }
})
