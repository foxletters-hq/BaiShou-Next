import React from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  SafeAreaView
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import type { NativeRecallDialogProps } from './recall-dialog.types'
import { useRecallDialog } from './useRecallDialog'
import { RecallDialogItem } from './RecallDialogItem'

export type { RecallItem, NativeRecallDialogProps } from './recall-dialog.types'

export const RecallDialog: React.FC<NativeRecallDialogProps> = ({
  isOpen,
  onClose,
  items,
  isSearching,
  onInject,
  onSearch
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const dialog = useRecallDialog(isOpen, items, onSearch, onInject, onClose)

  if (!isOpen) return null

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: 'center',
          alignItems: 'center'
        }}
        onPress={onClose}
      >
        <SafeAreaView style={{ width: '100%', alignItems: 'center' }}>
          <Pressable
            style={{
              width: '90%',
              maxWidth: maxModalWidth,
              maxHeight: '85%',
              backgroundColor: colors.bgSurface,
              borderRadius: tokens.radius.xl,
              padding: tokens.spacing.lg
            }}
            onPress={(e) => e.stopPropagation()}
          >
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: tokens.spacing.md
              }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.sm
                }}
              >
                <Text style={{ fontSize: 20 }}>📚</Text>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '600',
                    color: colors.textPrimary
                  }}
                >
                  {t('recall.title', '唤醒回忆')}
                </Text>
              </View>
              <Pressable onPress={onClose}>
                <Text style={{ fontSize: 24, color: colors.textSecondary }}>×</Text>
              </Pressable>
            </View>

            <View
              style={{
                flexDirection: 'row',
                marginBottom: tokens.spacing.sm,
                backgroundColor: colors.bgSurfaceNormal,
                borderRadius: tokens.radius.full,
                padding: 4
              }}
            >
              {(['diary', 'memory'] as const).map((tab) => (
                <Pressable
                  key={tab}
                  onPress={() => dialog.switchTab(tab)}
                  style={{
                    flex: 1,
                    paddingVertical: tokens.spacing.xs,
                    borderRadius: tokens.radius.full,
                    backgroundColor: dialog.activeTab === tab ? colors.primary : 'transparent',
                    alignItems: 'center'
                  }}
                >
                  <Text
                    style={{
                      fontSize: 14,
                      color:
                        dialog.activeTab === tab ? colors.onPrimary : colors.textSecondary,
                      fontWeight: dialog.activeTab === tab ? '600' : '400'
                    }}
                  >
                    {t(
                      tab === 'diary' ? 'recall.tab_diary' : 'recall.tab_memory',
                      tab === 'diary' ? '日记档案' : '向量记忆'
                    )}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: colors.bgSurfaceNormal,
                borderRadius: tokens.radius.md,
                paddingHorizontal: tokens.spacing.sm,
                marginBottom: tokens.spacing.md
              }}
            >
              <Text style={{ fontSize: 16, marginRight: tokens.spacing.xs }}>🔍</Text>
              <TextInput
                placeholder={t('recall.search_hint', '检索关键字或记忆片段...')}
                placeholderTextColor={colors.textTertiary}
                value={dialog.searchQuery}
                onChangeText={dialog.setSearchQuery}
                style={{
                  flex: 1,
                  paddingVertical: tokens.spacing.sm,
                  color: colors.textPrimary,
                  fontSize: 16
                }}
              />
            </View>

            <ScrollView style={{ maxHeight: 300 }}>
              {isSearching ? (
                <View style={{ padding: tokens.spacing.lg, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={{ marginTop: tokens.spacing.sm, color: colors.textSecondary }}>
                    {t('common.loading', '加载中...')}
                  </Text>
                </View>
              ) : items.length === 0 ? (
                <View style={{ padding: tokens.spacing.lg, alignItems: 'center' }}>
                  <Text style={{ fontSize: 16, color: colors.textSecondary }}>
                    {t('recall.no_results', '未在库中匹配到任何历史记忆碎片。')}
                  </Text>
                </View>
              ) : (
                items.map((item) => (
                  <RecallDialogItem
                    key={item.id}
                    item={item}
                    isSelected={dialog.selectedIds.has(item.id)}
                    onToggle={dialog.toggleSelect}
                  />
                ))
              )}
            </ScrollView>

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: tokens.spacing.md,
                paddingTop: tokens.spacing.sm,
                borderTopWidth: 1,
                borderTopColor: colors.borderSubtle
              }}
            >
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                {t('recall.selected', '已选择')}{' '}
                <Text style={{ fontWeight: '600', color: colors.primary }}>
                  {dialog.selectedIds.size}
                </Text>
              </Text>
              <Pressable
                onPress={dialog.handleInject}
                disabled={dialog.selectedIds.size === 0}
                style={({ pressed }) => ({
                  backgroundColor:
                    dialog.selectedIds.size > 0 ? colors.primary : colors.bgSurfaceNormal,
                  borderRadius: tokens.radius.full,
                  paddingHorizontal: tokens.spacing.md,
                  paddingVertical: tokens.spacing.sm,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: tokens.spacing.xs,
                  opacity: pressed ? 0.7 : 1
                })}
              >
                <Text style={{ fontSize: 16 }}>↑</Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '600',
                    color:
                      dialog.selectedIds.size > 0 ? colors.onPrimary : colors.textSecondary
                  }}
                >
                  {t('recall.inject', '提取至当前上下文对话')}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}
