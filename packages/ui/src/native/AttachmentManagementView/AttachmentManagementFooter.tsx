import React from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { useNativeTheme } from '../theme'
import { attachmentManagementStyles as styles } from './attachment-management.styles'

export function AttachmentManagementFooter({
  selectedCount,
  deleting,
  onDelete,
  colors
}: {
  selectedCount: number
  deleting: boolean
  onDelete: () => void
  colors: ReturnType<typeof useNativeTheme>['colors']
}) {
  const { t } = useTranslation()

  return (
    <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
      <Text style={[styles.selectionInfo, { color: colors.textSecondary }]}>
        {`${t('attachment.selected_count', '已选')} ${selectedCount} ${t('attachment.items', '项')}`}
      </Text>
      <TouchableOpacity
        onPress={onDelete}
        disabled={selectedCount === 0 || deleting}
        activeOpacity={0.7}
        style={[
          styles.deleteButton,
          {
            backgroundColor: selectedCount > 0 ? colors.error : colors.borderSubtle,
            opacity: deleting ? 0.6 : 1
          }
        ]}
      >
        {deleting ? (
          <ActivityIndicator size="small" color={colors.bgSurface} />
        ) : (
          <Text style={[styles.deleteButtonText, { color: colors.bgSurface }]}>
            {t('attachment.delete', '删除')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  )
}
