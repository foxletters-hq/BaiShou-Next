import React from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, type ViewProps } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { mobileTypography, sharedTokens } from '../../theme/tokens'

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
                    {t('agent.assistant.default_tag')}
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
                {isDeleting ? '...' : t('common.delete')}
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
          {t('agent.assistant.title')}
        </Text>
        <TouchableOpacity
          onPress={onCreate}
          activeOpacity={0.7}
          style={[styles.createButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.createButtonText, { color: colors.bgSurface }]}>
            + {t('agent.assistant.create_new')}
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
              {t('agent.assistant.empty_hint')}
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
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderBottomWidth: 1
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  createButton: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm
  },
  createButtonText: {
    fontSize: mobileTypography.secondary.fontSize,
    fontWeight: '600'
  },
  listContent: {
    padding: sharedTokens.spacing.mdTight
  },
  itemRow: {
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    padding: sharedTokens.spacing.mdSnug
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
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  defaultBadge: {
    paddingHorizontal: sharedTokens.spacing.sm,
    paddingVertical: sharedTokens.spacing.xxs,
    borderRadius: sharedTokens.radius.xs
  },
  defaultBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  deleteBtn: {
    paddingHorizontal: sharedTokens.spacing.mdTight,
    paddingVertical: sharedTokens.spacing.xs,
    borderRadius: sharedTokens.radius.xsPlus,
    borderWidth: 1
  },
  deleteBtnText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  itemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: sharedTokens.spacing.sm,
    gap: sharedTokens.spacing.xsPlus
  },
  metaDot: {
    width: 4,
    height: 4,
    borderRadius: sharedTokens.radius.xxs
  },
  metaText: {
    fontSize: mobileTypography.caption.fontSize
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sharedTokens.spacing.xlPlus
  },
  emptyText: {
    fontSize: mobileTypography.secondary.fontSize
  }
})
