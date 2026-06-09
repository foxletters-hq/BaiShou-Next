import React from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform
} from 'react-native'
import { MaterialIcons } from '@expo/vector-icons'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DashboardSharedMemoryCard } from '../DashboardSharedMemoryCard'
import type { NativeRecallDialogProps } from './recall-dialog.types'
import { useRecallDialog } from './useRecallDialog'
import { RecallDialogItem } from './RecallDialogItem'
import { RecallDialogDiaryItem } from './RecallDialogDiaryItem'

export type { RecallItem, NativeRecallDialogProps } from './recall-dialog.types'

export const RecallDialog: React.FC<NativeRecallDialogProps> = ({
  isOpen,
  onClose,
  items,
  isSearching,
  onInject,
  onSearch,
  searchMode = 'semantic',
  onToggleSearchMode,
  lookbackMonths,
  onMonthsChanged,
  onCopyContext,
  onCopyDiarySnippet
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const dialog = useRecallDialog(isOpen, items, onSearch, onInject, onClose, searchMode)
  const showSharedMemoryCard =
    dialog.activeTab === 'diary' && onCopyContext && onMonthsChanged && lookbackMonths != null

  if (!isOpen) return null

  const searchPlaceholder = t('recall.search_hint', '搜索记忆...')

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <SafeAreaView style={styles.safeArea}>
          <View
            style={[
              styles.dialog,
              {
                maxWidth: maxModalWidth,
                backgroundColor: colors.bgSurface
              }
            ]}
          >
            <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
              <View
                style={[
                  styles.tabs,
                  { backgroundColor: colors.bgSurfaceNormal }
                ]}
              >
                {(['diary', 'memory'] as const).map((tab) => {
                  const active = dialog.activeTab === tab
                  return (
                    <Pressable
                      key={tab}
                      onPress={() => dialog.switchTab(tab)}
                      style={[
                        styles.tab,
                        active && {
                          backgroundColor: colors.bgSurface,
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.05,
                          shadowRadius: 8,
                          elevation: 1
                        }
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: '700',
                          color: active ? colors.primary : colors.textSecondary
                        }}
                      >
                        {t(
                          tab === 'diary' ? 'recall.tab_diary' : 'recall.tab_memory',
                          tab === 'diary' ? '日记档案' : '向量记忆'
                        )}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>

              <Pressable
                onPress={onClose}
                style={[styles.closeBtn, { backgroundColor: colors.bgSurfaceNormal }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <MaterialIcons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>

            {dialog.activeTab === 'memory' && (
              <View style={styles.searchSection}>
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: colors.bgSurface,
                      borderColor: colors.borderMuted
                    }
                  ]}
                >
                  <View style={styles.searchInputInner}>
                    <View pointerEvents="none" style={styles.searchIconInside}>
                      <MaterialIcons name="search" size={18} color={colors.textSecondary} />
                    </View>
                    <TextInput
                      style={[styles.searchInput, { color: colors.textPrimary }]}
                      placeholder={searchPlaceholder}
                      placeholderTextColor={colors.textTertiary}
                      value={dialog.searchQuery}
                      onChangeText={dialog.setSearchQuery}
                      returnKeyType="search"
                      autoCorrect={false}
                      autoCapitalize="none"
                    />
                    {dialog.searchQuery.length > 0 ? (
                      <TouchableOpacity
                        onPress={() => dialog.setSearchQuery('')}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                        style={styles.searchClearBtn}
                      >
                        <MaterialIcons name="close" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {onToggleSearchMode && (
                  <View
                    style={[
                      styles.segmented,
                      { backgroundColor: colors.bgSurfaceNormal }
                    ]}
                  >
                    {(['semantic', 'text'] as const).map((mode) => {
                      const active = searchMode === mode
                      return (
                        <TouchableOpacity
                          key={mode}
                          activeOpacity={0.7}
                          style={[
                            styles.segmentBtn,
                            active && { backgroundColor: colors.bgSurface }
                          ]}
                          onPress={() => {
                            if (searchMode !== mode) onToggleSearchMode()
                          }}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              { color: active ? colors.primary : colors.textSecondary },
                              active && styles.segmentTextActive
                            ]}
                            numberOfLines={1}
                          >
                            {mode === 'semantic'
                              ? t('recall.search_semantic', '语义搜索')
                              : t('recall.search_text', '文本搜索')}
                          </Text>
                        </TouchableOpacity>
                      )
                    })}
                  </View>
                )}
              </View>
            )}

            <ScrollView
              style={styles.listArea}
              contentContainerStyle={styles.listContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator
            >
              {dialog.activeTab === 'diary' ? (
                <View style={styles.diaryWrap}>
                  {showSharedMemoryCard && (
                    <DashboardSharedMemoryCard
                      lookbackMonths={lookbackMonths}
                      onMonthsChanged={onMonthsChanged}
                      onCopyContext={onCopyContext}
                    />
                  )}
                  {isSearching ? (
                    <View style={styles.emptyState}>
                      <ActivityIndicator size="small" color={colors.primary} />
                      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        {t('common.loading', '加载中...')}
                      </Text>
                    </View>
                  ) : (
                    items.map((item) => (
                      <RecallDialogDiaryItem
                        key={item.id}
                        item={item}
                        onCopy={onCopyDiarySnippet}
                      />
                    ))
                  )}
                </View>
              ) : isSearching ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    {t('common.loading', '加载中...')}
                  </Text>
                </View>
              ) : items.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
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

            {dialog.activeTab === 'memory' && (
              <View
                style={[
                  styles.footer,
                  {
                    borderTopColor: colors.borderSubtle,
                    backgroundColor: colors.bgSurface
                  }
                ]}
              >
                <Text style={[styles.selectionCount, { color: colors.textPrimary }]}>
                  {t('recall.selected', '已选择')}{' '}
                  <Text style={{ fontWeight: '700', color: colors.primary }}>
                    {dialog.selectedIds.size}
                  </Text>
                </Text>
                <Pressable
                  onPress={dialog.handleInject}
                  disabled={dialog.selectedIds.size === 0}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.sm,
                    borderRadius: tokens.radius.md,
                    backgroundColor:
                      dialog.selectedIds.size > 0 ? colors.primary : colors.bgSurfaceNormal,
                    opacity: pressed ? 0.85 : dialog.selectedIds.size === 0 ? 0.6 : 1
                  })}
                >
                  <MaterialIcons
                    name="arrow-circle-up"
                    size={16}
                    color={
                      dialog.selectedIds.size > 0 ? colors.onPrimary : colors.textSecondary
                    }
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color:
                        dialog.selectedIds.size > 0 ? colors.onPrimary : colors.textSecondary
                    }}
                  >
                    {t('recall.inject', '提取至当前上下文对话')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </SafeAreaView>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    paddingHorizontal: 16
  },
  dialog: {
    width: '100%',
    height: '75%',
    maxHeight: '80%',
    minHeight: 420,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'column'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth
  },
  tabs: {
    flexDirection: 'row',
    gap: 8,
    padding: 4,
    borderRadius: 12
  },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12
  },
  searchBox: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center'
  },
  searchInputInner: {
    position: 'relative',
    minHeight: 44,
    justifyContent: 'center'
  },
  searchIconInside: {
    position: 'absolute',
    left: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    paddingLeft: 38,
    paddingRight: 36,
    minHeight: 44,
    ...(Platform.OS === 'android' ? { includeFontPadding: false, textAlignVertical: 'center' } : null)
  },
  searchClearBtn: {
    position: 'absolute',
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    zIndex: 1
  },
  segmented: {
    flexDirection: 'row',
    width: '100%',
    padding: 3,
    borderRadius: 10,
    gap: 4
  },
  segmentBtn: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  segmentText: {
    fontSize: 11,
    fontWeight: '600'
  },
  segmentTextActive: {
    fontWeight: '700'
  },
  listArea: {
    flex: 1
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12
  },
  diaryWrap: {
    gap: 12
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    gap: 8
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth
  },
  selectionCount: {
    fontSize: 14,
    fontWeight: '700'
  }
})
