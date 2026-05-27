import React from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, type ViewProps } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'

export interface AssistantItem {
  id: string
  name: string
  providerId: string
  modelId: string
  isDefault: boolean
}

export interface AssistantManagementViewProps extends ViewProps {
  assistants: AssistantItem[]
  onSelect: (id: string) => void
  onCreate: () => void
  onDelete: (id: string) => Promise<void>
}

export const AssistantManagementView: React.FC<AssistantManagementViewProps> = ({
  assistants,
  onSelect,
  onCreate,
  onDelete,
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const { t } = useTranslation()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await onDelete(id)
    } finally {
      setDeletingId(null)
    }
  }

  const renderItem = ({ item }: { item: AssistantItem }) => {
    const isDeleting = deletingId === item.id
    return (
      <TouchableOpacity
        onPress={() => onSelect(item.id)}
        activeOpacity={0.7}
        style={[
          styles.itemRow,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: colors.borderSubtle
          }
        ]}
      >
        <View style={styles.itemContent}>
          <View style={styles.itemHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: tokens.spacing.sm }}>
              <Text style={[styles.itemName, { color: colors.textPrimary }]}>{item.name}</Text>
              {item.isDefault && (
                <View
                  style={[styles.defaultBadge, { backgroundColor: colors.primaryLight + '30' }]}
                >
                  <Text style={[styles.defaultBadgeText, { color: colors.primary }]}>
                    {t('assistant.default', '默认')}
                  </Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              onPress={() => handleDelete(item.id)}
              disabled={isDeleting}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={[styles.deleteBtn, { borderColor: colors.error + '40' }]}
            >
              <Text style={[styles.deleteBtnText, { color: colors.error }]}>
                {isDeleting ? '...' : t('assistant.delete', '删除')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.itemMeta}>
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.providerId}</Text>
            <View style={[styles.metaDot, { backgroundColor: colors.textTertiary }]} />
            <Text style={[styles.metaText, { color: colors.textTertiary }]}>{item.modelId}</Text>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  return (
    <View style={[{ flex: 1 }, style]} {...props}>
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('assistant.title', '助手管理')}
        </Text>
        <TouchableOpacity
          onPress={onCreate}
          activeOpacity={0.7}
          style={[styles.createButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.createButtonText, { color: colors.bgSurface }]}>
            + {t('assistant.create', '新建')}
          </Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={assistants}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.xs }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              {t('assistant.empty', '暂无助手')}
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1
  },
  title: {
    fontSize: 18,
    fontWeight: '700'
  },
  createButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  createButtonText: {
    fontSize: 14,
    fontWeight: '600'
  },
  listContent: {
    padding: 12
  },
  itemRow: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14
  },
  itemContent: {
    flex: 1
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600'
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600'
  },
  deleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1
  },
  deleteBtnText: {
    fontSize: 12,
    fontWeight: '600'
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 6
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: 2
  },
  metaText: {
    fontSize: 12
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 14
  }
})
