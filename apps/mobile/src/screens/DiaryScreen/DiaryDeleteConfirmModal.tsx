import React from 'react'
import { Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Modal, modalActionsStyle, useNativeTheme } from '@baishou/ui/native'
import { mobileTypography } from '@baishou/ui/theme/tokens'

export function DiaryDeleteConfirmModal(props: {
  visible: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const { visible, onCancel, onConfirm } = props

  return (
    <Modal visible={visible} title={t('diary.delete_confirm_title')} onClose={onCancel}>
      <Text
        style={{
          color: colors.textSecondary,
          fontSize: mobileTypography.secondary.fontSize,
          fontWeight: mobileTypography.secondary.fontWeight,
          lineHeight: 20,
          marginBottom: tokens.spacing.md
        }}
      >
        {t('diary.delete_confirm_content')}
      </Text>
      <View style={modalActionsStyle}>
        <Button size="sm" variant="outlined" onPress={onCancel}>
          {t('common.cancel')}
        </Button>
        <Button size="sm" destructive onPress={onConfirm}>
          {t('common.delete')}
        </Button>
      </View>
    </Modal>
  )
}
