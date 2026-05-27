import React from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { useNativeTheme } from '../theme'
import { formatFileSize } from './attachment-management.utils'
import { attachmentManagementStyles as styles } from './attachment-management.styles'

export function AttachmentManagementHeader({
  totalCount,
  totalSize,
  colors
}: {
  totalCount: number
  totalSize: number
  colors: ReturnType<typeof useNativeTheme>['colors']
}) {
  const { t } = useTranslation()

  return (
    <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>{totalCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('attachment.count', '个文件')}
          </Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: colors.borderSubtle }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: colors.textPrimary }]}>
            {formatFileSize(totalSize)}
          </Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            {t('attachment.total_size', '总大小')}
          </Text>
        </View>
      </View>
    </View>
  )
}
