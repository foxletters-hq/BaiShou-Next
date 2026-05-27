import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import type { useNativeTheme } from '../theme'
import type { AttachmentItem } from './attachment-management.types'
import { formatFileSize, formatDate, getMimeTypeLabel } from './attachment-management.utils'
import { attachmentManagementStyles as styles } from './attachment-management.styles'

export function AttachmentListItem({
  item,
  isSelected,
  onToggle,
  colors
}: {
  item: AttachmentItem
  isSelected: boolean
  onToggle: (id: string) => void
  colors: ReturnType<typeof useNativeTheme>['colors']
}) {
  return (
    <TouchableOpacity
      onPress={() => onToggle(item.id)}
      activeOpacity={0.7}
      style={[
        styles.itemRow,
        {
          backgroundColor: isSelected ? colors.primaryLight + '40' : colors.bgSurfaceNormal,
          borderColor: isSelected ? colors.primary : colors.borderSubtle
        }
      ]}
    >
      <View
        style={[
          styles.checkbox,
          {
            borderColor: isSelected ? colors.primary : colors.borderSubtle,
            backgroundColor: isSelected ? colors.primary : 'transparent'
          }
        ]}
      >
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </View>
      <View style={styles.itemInfo}>
        <Text style={[styles.filename, { color: colors.textPrimary }]} numberOfLines={1}>
          {item.filename}
        </Text>
        <View style={styles.itemMeta}>
          <View style={[styles.mimeBadge, { backgroundColor: colors.primaryLight + '30' }]}>
            <Text style={[styles.mimeText, { color: colors.primary }]}>
              {getMimeTypeLabel(item.mimeType)}
            </Text>
          </View>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {formatFileSize(item.sizeInBytes)}
          </Text>
          <Text style={[styles.metaText, { color: colors.textTertiary }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}
