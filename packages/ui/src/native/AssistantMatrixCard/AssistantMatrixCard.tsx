import React, { useState } from 'react'
import { View, Text, TouchableOpacity, FlatList, StyleSheet, type ViewProps } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Checkbox } from '../Checkbox'
import { AssistantKindBadge } from '../AssistantKindBadge'
import type { AssistantKind } from '@baishou/shared'
import { iconSizes, mobileTypography, sharedTokens } from '../../theme/tokens'

export interface AssistantMatrixAssistant {
  id: string
  name: string
  assistantKind?: AssistantKind
}

export interface AvailableModel {
  id: string
  name: string
}

export interface AssistantMatrixCardProps extends ViewProps {
  assistants: AssistantMatrixAssistant[]
  onSelectModels: (assistantId: string, modelIds: string[]) => void
  availableModels: AvailableModel[]
}

export const AssistantMatrixCard: React.FC<AssistantMatrixCardProps> = ({
  assistants,
  onSelectModels,
  availableModels,
  style,
  ...props
}) => {
  const { colors, tokens } = useNativeTheme()
  const { t } = useTranslation()
  const [selectedModels, setSelectedModels] = useState<Record<string, Set<string>>>({})
  const [expandedAssistant, setExpandedAssistant] = useState<string | null>(null)

  const getSelectedForAssistant = (assistantId: string): Set<string> => {
    return selectedModels[assistantId] ?? new Set()
  }

  const toggleModel = (assistantId: string, modelId: string) => {
    const current = getSelectedForAssistant(assistantId)
    const next = new Set(current)
    if (next.has(modelId)) {
      next.delete(modelId)
    } else {
      next.add(modelId)
    }
    const updated = { ...selectedModels, [assistantId]: next }
    setSelectedModels(updated)
    onSelectModels(assistantId, Array.from(next))
  }

  const toggleExpand = (id: string) => {
    setExpandedAssistant((prev) => (prev === id ? null : id))
  }

  const renderAssistantItem = ({ item }: { item: AssistantMatrixAssistant }) => {
    const isExpanded = expandedAssistant === item.id
    const selected = getSelectedForAssistant(item.id)

    return (
      <View
        style={[
          styles.assistantCard,
          {
            backgroundColor: colors.bgSurfaceNormal,
            borderColor: isExpanded ? colors.primary : colors.borderSubtle
          }
        ]}
      >
        <TouchableOpacity
          onPress={() => toggleExpand(item.id)}
          activeOpacity={0.7}
          style={styles.assistantHeader}
        >
          <View style={styles.assistantNameRow}>
            <Text style={[styles.assistantName, { color: colors.textPrimary }]}>{item.name}</Text>
            <AssistantKindBadge kind={item.assistantKind} compact />
          </View>
          <View style={styles.assistantHeaderRight}>
            <View style={[styles.countBadge, { backgroundColor: colors.primaryLight + '30' }]}>
              <Text style={[styles.countBadgeText, { color: colors.primary }]}>
                {selected.size}
              </Text>
            </View>
            <Text style={[styles.expandIcon, { color: colors.textTertiary }]}>
              {isExpanded ? '▲' : '▼'}
            </Text>
          </View>
        </TouchableOpacity>

        {isExpanded && (
          <View style={[styles.modelList, { borderTopColor: colors.borderSubtle }]}>
            {availableModels.length === 0 ? (
              <Text style={[styles.noModels, { color: colors.textTertiary }]}>
                {t('assistant_matrix.no_models', '暂无可用模型')}
              </Text>
            ) : (
              availableModels.map((model) => {
                const isChecked = selected.has(model.id)
                return (
                  <TouchableOpacity
                    key={model.id}
                    onPress={() => toggleModel(item.id, model.id)}
                    activeOpacity={0.7}
                    style={[
                      styles.modelRow,
                      {
                        backgroundColor: isChecked ? colors.primaryLight + '20' : 'transparent'
                      }
                    ]}
                  >
                    <Checkbox
                      selected={isChecked}
                      style={{ marginRight: sharedTokens.spacing.smPlus }}
                    />
                    <Text
                      style={[
                        styles.modelName,
                        { color: isChecked ? colors.primary : colors.textSecondary }
                      ]}
                    >
                      {model.name}
                    </Text>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
        )}
      </View>
    )
  }

  return (
    <View style={[{ flex: 1 }, style]} {...props}>
      <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {t('assistant_matrix.title', '模型分配矩阵')}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textTertiary }]}>
          {t('assistant_matrix.subtitle', '为每个助手选择模型')}
        </Text>
      </View>
      <FlatList
        data={assistants}
        keyExtractor={(item) => item.id}
        renderItem={renderAssistantItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={{ height: tokens.spacing.sm }} />}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
              {t('assistant_matrix.empty', '暂无助手')}
            </Text>
          </View>
        }
      />
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: sharedTokens.spacing.md,
    paddingVertical: sharedTokens.spacing.mdTight,
    borderBottomWidth: 1
  },
  title: {
    fontSize: mobileTypography.title.fontSize,
    fontWeight: '600'
  },
  subtitle: {
    fontSize: mobileTypography.caption.fontSize,
    marginTop: sharedTokens.spacing.xs
  },
  listContent: {
    padding: sharedTokens.spacing.mdTight
  },
  assistantCard: {
    borderRadius: sharedTokens.radius.control,
    borderWidth: 1,
    overflow: 'hidden'
  },
  assistantHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: sharedTokens.spacing.mdSnug
  },
  assistantNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.xsPlus,
    flex: 1,
    flexWrap: 'wrap'
  },
  assistantName: {
    fontSize: mobileTypography.body.fontSize,
    fontWeight: '600'
  },
  assistantHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: sharedTokens.spacing.sm
  },
  countBadge: {
    minWidth: 24,
    height: 24,
    borderRadius: sharedTokens.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: sharedTokens.spacing.xsPlus
  },
  countBadgeText: {
    fontSize: mobileTypography.caption.fontSize,
    fontWeight: '600'
  },
  expandIcon: {
    fontSize: iconSizes.xs,
    fontWeight: '600'
  },
  modelList: {
    borderTopWidth: 1,
    paddingVertical: sharedTokens.spacing.sm,
    paddingHorizontal: sharedTokens.spacing.sm
  },
  modelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: sharedTokens.spacing.smPlus,
    paddingHorizontal: sharedTokens.spacing.sm,
    borderRadius: sharedTokens.radius.sm
  },
  modelName: {
    fontSize: mobileTypography.secondary.fontSize
  },
  noModels: {
    textAlign: 'center',
    paddingVertical: sharedTokens.spacing.mdTight,
    fontSize: mobileTypography.secondary.fontSize
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
