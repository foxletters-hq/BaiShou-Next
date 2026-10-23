import React, { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { mobileTypography, sharedTokens } from '../../theme/tokens'
import { useNativeTheme } from '../theme'
import { Button } from '../Button'
import { FloatingModal } from '../FloatingModal'
import { DateSelect } from '../DateSelect'

export interface DatePickerFloatingModalProps {
  visible: boolean
  value: Date
  onClose: () => void
  onConfirm: (date: Date) => void
  minDate?: Date
  maxDate?: Date
  title?: string
}

export const DatePickerFloatingModal: React.FC<DatePickerFloatingModalProps> = ({
  visible,
  value,
  onClose,
  onConfirm,
  minDate,
  maxDate,
  title
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
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
          {title ?? t('diary.edit_date')}
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

      <View
        style={[styles.footer, { borderTopColor: colors.borderSubtle, gap: tokens.spacing.sm }]}
      >
        <Button variant="outlined" size="sm" onPress={onClose}>
          {t('common.cancel')}
        </Button>
        <Button variant="outlined" size="sm" onPress={() => onConfirm(draft)}>
          {t('common.confirm')}
        </Button>
      </View>
    </FloatingModal>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdSnug,
    borderBottomWidth: 1
  },
  headerTitle: {
    fontSize: mobileTypography.primary.fontSize,
    fontWeight: '600',
    textAlign: 'center'
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    flexWrap: 'wrap',
    padding: sharedTokens.spacing.mdTight,
    borderTopWidth: 1
  }
})

/** @deprecated 使用 DatePickerFloatingModal */
export const DatePickerFullScreenModal = DatePickerFloatingModal
