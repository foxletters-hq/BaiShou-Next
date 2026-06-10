import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { useNativeTheme } from '../theme'
import type { YearMonthPickerProps } from './year-month-picker.types'
import { yearMonthPickerStyles as styles } from './year-month-picker.styles'
import { FloatingModal } from '../FloatingModal'
import { DateSelect } from '../DateSelect'

function toMonthDate(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function YearMonthPickerModal({
  isOpen,
  onClose,
  selectedMonth,
  onChange,
  colors,
  selectionBandColor
}: {
  isOpen: boolean
  onClose: () => void
  selectedMonth: Date | null
  onChange: YearMonthPickerProps['onChange']
  colors: ReturnType<typeof useNativeTheme>['colors']
  selectionBandColor?: string
}) {
  const { t } = useTranslation()

  const [draft, setDraft] = useState(() => selectedMonth ?? new Date())

  useEffect(() => {
    if (isOpen) {
      setDraft(selectedMonth ?? new Date())
    }
  }, [isOpen, selectedMonth])

  const handleDraftChange = useCallback(
    (date: Date) => {
      setDraft(date)
      onChange(toMonthDate(date))
    },
    [onChange]
  )

  const handleClear = useCallback(() => {
    onChange(null)
    onClose()
  }, [onChange, onClose])

  const handleThisMonth = useCallback(() => {
    const now = new Date()
    onChange(toMonthDate(now))
    onClose()
  }, [onChange, onClose])

  const openKey = isOpen
    ? `${selectedMonth?.getFullYear() ?? 'all'}-${selectedMonth?.getMonth() ?? 'none'}`
    : 'closed'

  return (
    <FloatingModal visible={isOpen} onClose={onClose} maxWidth={360}>
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
          {t('diary.select_month')}
        </Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>✕</Text>
        </Pressable>
      </View>

      <DateSelect
        fields={['year', 'month']}
        value={draft}
        onChange={handleDraftChange}
        scrollKey={openKey}
        selectionBandColor={selectionBandColor}
      />

      <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
        <Pressable
          style={[styles.footerBtn, { backgroundColor: colors.bgSurfaceHighest }]}
          onPress={handleClear}
        >
          <Text
            style={[styles.footerBtnText, { color: colors.textSecondary, textAlign: 'center' }]}
            numberOfLines={2}
          >
            {t('diary.all_diaries')}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.footerBtn, { backgroundColor: colors.primary }]}
          onPress={handleThisMonth}
        >
          <Text
            style={[styles.footerBtnText, { color: colors.textOnPrimary, textAlign: 'center' }]}
            numberOfLines={2}
          >
            {t('common.this_month')}
          </Text>
        </Pressable>
      </View>
    </FloatingModal>
  )
}
