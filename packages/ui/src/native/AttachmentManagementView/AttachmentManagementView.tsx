import React, { useState } from 'react'
import { View, Text, FlatList, ActivityIndicator } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { AttachmentManagementViewProps } from './attachment-management.types'
import { attachmentManagementStyles as styles } from './attachment-management.styles'
import { AttachmentListItem } from './AttachmentListItem'
import { AttachmentManagementHeader } from './AttachmentManagementHeader'
import { AttachmentManagementFooter } from './AttachmentManagementFooter'

export type { AttachmentItem, AttachmentManagementViewProps } from './attachment-management.types'

export const AttachmentManagementView: React.FC<AttachmentManagementViewProps> = ({
  attachments,
  onDelete,
  onRefresh,
  isLoading = false,
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const { t } = useTranslation()
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [deleting, setDeleting] = useState(false)

  const totalSize = attachments.reduce((sum, a) => sum + a.sizeInBytes, 0)

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleDelete = async () => {
    if (selectedIds.size === 0) return
    setDeleting(true)
    try {
      await onDelete(Array.from(selectedIds))
      setSelectedIds(new Set())
    } finally {
      setDeleting(false)
    }
  }

  return (
    <View style={[{ flex: 1 }, style]} {...props}>
      <AttachmentManagementHeader
        totalCount={attachments.length}
        totalSize={totalSize}
        colors={colors}
      />
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={attachments}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AttachmentListItem
              item={item}
              isSelected={selectedIds.has(item.id)}
              onToggle={toggleSelect}
              colors={colors}
            />
          )}
          contentContainerStyle={styles.listContent}
          refreshing={isLoading}
          onRefresh={onRefresh}
          ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.xs }} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
                {t('attachment.empty', '暂无附件')}
              </Text>
            </View>
          }
        />
      )}
      <AttachmentManagementFooter
        selectedCount={selectedIds.size}
        deleting={deleting}
        onDelete={handleDelete}
        colors={colors}
      />
    </View>
  )
}
