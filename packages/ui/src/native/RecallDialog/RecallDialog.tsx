import React from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  useWindowDimensions
} from 'react-native'
import { ArrowUpCircle, Search, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { DashboardSharedMemoryCard } from '../DashboardSharedMemoryCard'
import { Pagination } from '../Pagination'
import type { NativeRecallDialogProps } from './recall-dialog.types'
import { useRecallDialog, RECALL_MEMORY_PAGE_SIZE } from './useRecallDialog'
import { RecallDialogItem } from './RecallDialogItem'
import { RecallDialogDiaryItem } from './RecallDialogDiaryItem'
import { styles } from './recall-dialog.styles'

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
  onCopyDiarySnippet,
  copyPreview,
  copyPreviewLoading,
  copyPrefix,
  onCopyPrefixChange
}) => {
  const { t } = useTranslation()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const { height: windowHeight } = useWindowDimensions()
  const modalHeight = Math.min(Math.max(windowHeight * 0.75, 420), Math.floor(windowHeight * 0.82))
  const dialog = useRecallDialog(isOpen, items, onSearch, onInject, onClose, searchMode)
  const showSharedMemoryCard =
    dialog.activeTab === 'diary' && onCopyContext && onMonthsChanged && lookbackMonths != null

  const memoryPageCount = Math.max(1, Math.ceil(items.length / RECALL_MEMORY_PAGE_SIZE))
  const safeMemoryPage = Math.min(dialog.memoryPage, memoryPageCount)
  const pagedMemoryItems =
    dialog.activeTab === 'memory'
      ? items.slice(
          (safeMemoryPage - 1) * RECALL_MEMORY_PAGE_SIZE,
          safeMemoryPage * RECALL_MEMORY_PAGE_SIZE
        )
      : items

  if (!isOpen) return null

  const searchPlaceholder = t('recall.search_hint', '搜索记忆...')

  return (
    <Modal visible={isOpen} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', '关闭')}
        />

        <View style={styles.dialogWrap} pointerEvents="box-none">
          <View
            style={[
              styles.dialog,
              {
                width: '94%',
                maxWidth: maxModalWidth,
                height: modalHeight,
                backgroundColor: colors.bgSurface
              }
            ]}
          >
            <View style={[styles.header, { borderBottomColor: colors.borderSubtle }]}>
              <View
                style={[
                  styles.tabs,
                  {
                    backgroundColor: colors.bgSurfaceNormal,
                    borderColor: colors.borderControl
                  }
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
                          borderColor: colors.borderSubtle
                        }
                      ]}
                    >
                      <Text
                        style={{
                          fontSize: 13.6,
                          lineHeight: 18.4,
                          fontWeight: active ? '600' : '500',
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
                <X size={16} color={colors.textSecondary} strokeWidth={3} />
              </Pressable>
            </View>

            {dialog.activeTab === 'memory' && (
              <View style={styles.searchSection}>
                <View
                  style={[
                    styles.searchBox,
                    {
                      backgroundColor: colors.bgSurface,
                      borderColor: colors.borderControl
                    }
                  ]}
                >
                  <View style={styles.searchInputInner}>
                    <View pointerEvents="none" style={styles.searchIconInside}>
                      <Search
                        size={18}
                        color={colors.textSecondary}
                        strokeWidth={DEFAULT_STROKE_WIDTH}
                      />
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
                        <X
                          size={16}
                          color={colors.textTertiary}
                          strokeWidth={DEFAULT_STROKE_WIDTH}
                        />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>

                {onToggleSearchMode && (
                  <View
                    style={[
                      styles.segmented,
                      {
                        backgroundColor: colors.bgSurfaceNormal,
                        borderColor: colors.borderControl
                      }
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
                            active && {
                              backgroundColor: colors.bgSurface,
                              borderColor: colors.borderSubtle
                            }
                          ]}
                          onPress={() => {
                            if (searchMode !== mode) onToggleSearchMode()
                          }}
                        >
                          <Text
                            style={[
                              styles.segmentText,
                              {
                                color: active ? colors.primary : colors.textSecondary,
                                fontWeight: active ? '600' : '500'
                              }
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
                      copyPreview={copyPreview}
                      copyPreviewLoading={copyPreviewLoading}
                      copyPrefix={copyPrefix}
                      onCopyPrefixChange={onCopyPrefixChange}
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
                pagedMemoryItems.map((item) => (
                  <RecallDialogItem
                    key={item.id}
                    item={item}
                    isSelected={dialog.selectedIds.has(item.id)}
                    onToggle={dialog.toggleSelect}
                  />
                ))
              )}
            </ScrollView>

            {dialog.activeTab === 'memory' && items.length > RECALL_MEMORY_PAGE_SIZE ? (
              <View style={[styles.paginationArea, { borderTopColor: colors.borderSubtle }]}>
                <Pagination
                  current={safeMemoryPage}
                  total={memoryPageCount}
                  onChange={dialog.setMemoryPage}
                  showJumper={false}
                  siblingCount={0}
                />
              </View>
            ) : null}

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
                  <Text style={{ fontWeight: '600', color: colors.primary }}>
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
                  <ArrowUpCircle
                    size={16}
                    color={dialog.selectedIds.size > 0 ? colors.onPrimary : colors.textSecondary}
                    strokeWidth={DEFAULT_STROKE_WIDTH}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: dialog.selectedIds.size > 0 ? colors.onPrimary : colors.textSecondary
                    }}
                  >
                    {t('recall.inject', '提取至当前上下文对话')}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  )
}
