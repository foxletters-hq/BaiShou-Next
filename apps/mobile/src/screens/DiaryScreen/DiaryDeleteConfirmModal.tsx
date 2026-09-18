import React from 'react'
import { Modal, Text, TouchableOpacity, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '@baishou/ui/native'
import { diaryScreenStyles as styles } from './diary-screen.styles'

export function DiaryDeleteConfirmModal(props: {
  visible: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const { visible, onCancel, onConfirm } = props

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <TouchableOpacity
        style={[styles.deleteOverlay, { backgroundColor: colors.bgOverlay }]}
        activeOpacity={1}
        onPress={onCancel}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[styles.deleteModal, { backgroundColor: colors.bgSurface }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.deleteTitle, { color: colors.textPrimary }]}>
            {t('diary.delete_confirm_title')}
          </Text>
          <Text style={[styles.deleteContent, { color: colors.textSecondary }]}>
            {t('diary.delete_confirm_content')}
          </Text>
          <View style={styles.deleteActions}>
            <TouchableOpacity
              style={[styles.deleteCancel, { backgroundColor: colors.bgSurfaceHighest }]}
              onPress={onCancel}
            >
              <Text style={{ color: colors.textSecondary }}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.deleteConfirm, { backgroundColor: colors.error }]}
              onPress={onConfirm}
            >
              <Text style={{ color: colors.textOnPrimary }}>{t('common.delete')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  )
}
