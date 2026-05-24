import React, { useState } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  type ViewProps,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface AttachmentItem {
  id: string
  filename: string
  sizeInBytes: number
  mimeType: string
  createdAt: number
}

export interface AttachmentManagementViewProps extends ViewProps {
  attachments: AttachmentItem[]
  onDelete: (ids: string[]) => Promise<void>
  onRefresh: () => Promise<void>
  isLoading?: boolean
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function getMimeTypeLabel(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'IMG'
  if (mimeType.startsWith('audio/')) return 'AUD'
  if (mimeType.startsWith('video/')) return 'VID'
  if (mimeType.includes('pdf')) return 'PDF'
  if (mimeType.includes('text')) return 'TXT'
  return 'FILE'
}

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
  const totalCount = attachments.length

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

  const renderItem = ({ item }: { item: AttachmentItem }) => {
    const isSelected = selectedIds.has(item.id)
    return (
      <TouchableOpacity
        onPress={() => toggleSelect(item.id)}
        activeOpacity={0.7}
        style={[
          styles.itemRow,
          {
            backgroundColor: isSelected ? colors.primaryLight + '40' : colors.bgSurfaceNormal,
            borderColor: isSelected ? colors.primary : colors.borderSubtle,
          },
        ]}
      >
        <View
          style={[
            styles.checkbox,
            {
              borderColor: isSelected ? colors.primary : colors.borderSubtle,
              backgroundColor: isSelected ? colors.primary : 'transparent',
            },
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

  const renderHeader = () => (
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

  const renderFooter = () => (
    <View style={[styles.footer, { borderTopColor: colors.borderSubtle }]}>
      <Text style={[styles.selectionInfo, { color: colors.textSecondary }]}>
        {`${t('attachment.selected_count', '已选')} ${selectedIds.size} ${t('attachment.items', '项')}`}
      </Text>
      <TouchableOpacity
        onPress={handleDelete}
        disabled={selectedIds.size === 0 || deleting}
        activeOpacity={0.7}
        style={[
          styles.deleteButton,
          {
            backgroundColor: selectedIds.size > 0 ? colors.error : colors.borderSubtle,
            opacity: deleting ? 0.6 : 1,
          },
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

  return (
    <View style={[{ flex: 1 }, style]} {...props}>
      {renderHeader()}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={attachments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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
      {renderFooter()}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statDivider: {
    width: 1,
    height: 28,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  listContent: {
    padding: 12,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1.5,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  itemInfo: {
    flex: 1,
  },
  filename: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mimeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mimeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  metaText: {
    fontSize: 12,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  selectionInfo: {
    fontSize: 13,
  },
  deleteButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
})
