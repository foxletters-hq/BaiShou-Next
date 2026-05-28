import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { FloatingModal } from '../FloatingModal'
import { MONTH_I18N_KEYS } from '../YearMonthPicker/year-month-picker.utils'
import { DatePickerWheelColumn } from './DatePickerWheelColumn'
import {
  clampDateParts,
  daysInMonth,
  getDatePickerYears
} from './date-picker.utils'

export interface DatePickerFloatingModalProps {
  visible: boolean
  value: Date
  onClose: () => void
  onConfirm: (date: Date) => void
  minDate?: Date
  maxDate?: Date
}

export const DatePickerFloatingModal: React.FC<DatePickerFloatingModalProps> = ({
  visible,
  value,
  onClose,
  onConfirm,
  minDate,
  maxDate
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (visible) setDraft(value)
  }, [visible, value])

  const years = useMemo(() => getDatePickerYears(), [])
  const yearIndex = Math.max(0, years.indexOf(draft.getFullYear()))
  const monthIndex = draft.getMonth()
  const dayIndex = draft.getDate() - 1

  const monthLabels = useMemo(
    () => MONTH_I18N_KEYS.map((key) => t(`diary.${key}`)),
    [t]
  )

  const dayLabels = useMemo(() => {
    const count = daysInMonth(draft.getFullYear(), draft.getMonth())
    return Array.from({ length: count }, (_, i) => String(i + 1).padStart(2, '0'))
  }, [draft])

  const pad = (n: number) => String(n).padStart(2, '0')
  const headline = `${draft.getFullYear()}-${pad(draft.getMonth() + 1)}-${pad(draft.getDate())}`

  const applyDraft = useCallback(
    (next: Date) => {
      let clamped = clampDateParts(next.getFullYear(), next.getMonth(), next.getDate())
      if (minDate && clamped < minDate) clamped = minDate
      if (maxDate && clamped > maxDate) clamped = maxDate
      setDraft(clamped)
    },
    [minDate, maxDate]
  )

  const handleYearIndex = (index: number) => {
    const y = years[index] ?? draft.getFullYear()
    applyDraft(clampDateParts(y, draft.getMonth(), draft.getDate()))
  }

  const handleMonthIndex = (index: number) => {
    applyDraft(clampDateParts(draft.getFullYear(), index, draft.getDate()))
  }

  const handleDayIndex = (index: number) => {
    applyDraft(new Date(draft.getFullYear(), draft.getMonth(), index + 1))
  }

  const openKey = visible
    ? `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}`
    : 'closed'

  return (
    <FloatingModal visible={visible} onClose={onClose} maxWidth={360}>
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('diary.edit_date')}
        </Text>
      </View>

      <View style={[styles.display, { backgroundColor: colors.bgSurfaceHighest }]}>
        <Text style={[styles.displayText, { color: colors.textPrimary }]}>{headline}</Text>
      </View>

      <View style={styles.wheelsRow}>
        <DatePickerWheelColumn
          scrollKey={`${openKey}-y-${draft.getFullYear()}`}
          items={years.map(String)}
          selectedIndex={yearIndex}
          onIndexChange={handleYearIndex}
        />
        <DatePickerWheelColumn
          scrollKey={`${openKey}-m-${draft.getFullYear()}-${draft.getMonth()}`}
          items={monthLabels}
          selectedIndex={monthIndex}
          onIndexChange={handleMonthIndex}
        />
        <DatePickerWheelColumn
          scrollKey={`${openKey}-d-${draft.getFullYear()}-${draft.getMonth()}`}
          items={dayLabels}
          selectedIndex={Math.min(dayIndex, dayLabels.length - 1)}
          onIndexChange={handleDayIndex}
        />
      </View>

      <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
        <Pressable
          style={[styles.footerBtn, { backgroundColor: colors.bgSurfaceHighest }]}
          onPress={onClose}
        >
          <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, { backgroundColor: colors.primary }]}
          onPress={() => onConfirm(draft)}
        >
          <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
            {t('common.confirm')}
          </Text>
        </Pressable>
      </View>
    </FloatingModal>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center'
  },
  display: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  },
  displayText: {
    fontSize: 22,
    fontWeight: '800'
  },
  wheelsRow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 8,
    maxHeight: 260
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    borderTopWidth: 1
  },
  footerBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center'
  }
})

/** @deprecated 使用 DatePickerFloatingModal */
export const DatePickerFullScreenModal = DatePickerFloatingModal
