import React, { useState, useEffect } from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { FloatingModal } from '../FloatingModal'
import { DateSelect } from '../DateSelect'

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

      <DateSelect
        fields={['year', 'month', 'day']}
        value={draft}
        onChange={setDraft}
        scrollKey={openKey}
        minDate={minDate}
        maxDate={maxDate}
      />

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
