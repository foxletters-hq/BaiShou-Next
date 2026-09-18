import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  TextInput,
  type LayoutChangeEvent
} from 'react-native'
import {
  SHORTCUT_TRACE_CHAIN,
  traceCall,
  findShortcutCommandConflict,
  getDefaultShortcutLabelsFromT
} from '@baishou/shared'
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react-native'
import type { PromptShortcut } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { DEFAULT_STROKE_WIDTH } from '../../shared/icons/icon-sizes'
import { useNativeToast } from '../Toast'
import { useDialog } from '../Dialog/Dialog'
import {
  mergePageReorder,
  SHORTCUT_PAGE_SIZE,
  usePromptShortcutSheet
} from './usePromptShortcutSheet'
import { PromptShortcutRow } from './PromptShortcutRow'
import { PromptShortcutEditor } from './PromptShortcutEditor'
import { promptShortcutSheetStyles as styles } from './prompt-shortcut-sheet.styles'

export interface PromptShortcutSheetProps {
  visible: boolean
  onClose: () => void
  shortcuts: PromptShortcut[]
  onSelect: (shortcut: PromptShortcut) => void
  onAdd?: (shortcut: PromptShortcut) => Promise<void>
  onUpdate?: (shortcut: PromptShortcut) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  onReorder?: (shortcuts: PromptShortcut[]) => Promise<void>
}

export const PromptShortcutSheet: React.FC<PromptShortcutSheetProps> = ({
  visible,
  onClose,
  shortcuts,
  onSelect,
  onAdd,
  onUpdate,
  onDelete,
  onReorder
}) => {
  const { t } = useTranslation()
  const dialog = useDialog()
  const toast = useNativeToast()
  const { colors, tokens, maxModalWidth } = useNativeTheme()
  const canManage = Boolean(onAdd && onUpdate && onDelete)
  const defaultShortcutLabels = getDefaultShortcutLabelsFromT(t)

  const {
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    pageSize,
    filteredShortcuts,
    paginatedShortcuts,
    totalPages,
    pageStartIndex,
    isSearchActive,
    canDrag
  } = usePromptShortcutSheet(shortcuts)

  const [listAreaHeight, setListAreaHeight] = useState<number | null>(null)
  const listAreaHeightRef = useRef<number | null>(null)
  const handleListAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height
    if (height > 0 && height !== listAreaHeightRef.current) {
      listAreaHeightRef.current = height
      setListAreaHeight(height)
    }
  }, [])

  const [editingItem, setEditingItem] = useState<PromptShortcut | null>(null)
  const [draftName, setDraftName] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [saving, setSaving] = useState(false)

  const windowHeight = Dimensions.get('window').height
  const modalHeight = Math.min(windowHeight * 0.72, 580)

  const resetEditing = useCallback(() => {
    setEditingItem(null)
    setDraftName('')
    setDraftContent('')
  }, [])

  const handleClose = useCallback(() => {
    resetEditing()
    setSearchQuery('')
    onClose()
  }, [onClose, resetEditing, setSearchQuery])

  useEffect(() => {
    if (!visible) return
    setSearchQuery('')
    setCurrentPage(1)
    listAreaHeightRef.current = null
    setListAreaHeight(null)
  }, [visible, setCurrentPage, setSearchQuery])

  const handleCreateNew = useCallback(() => {
    setEditingItem({ id: 'new', icon: '', name: '', content: '' })
    setDraftName('')
    setDraftContent('')
  }, [])

  const handleEdit = useCallback((item: PromptShortcut) => {
    setEditingItem(item)
    setDraftName(item.name || '')
    setDraftContent(item.content || '')
  }, [])

  const handleDeletePress = useCallback(
    async (id: string) => {
      if (!onDelete) return
      const confirmed = await dialog.confirm(
        t('shortcut.delete_confirm', '确定删除这条快捷指令吗？'),
        {
          confirmText: t('common.delete', '删除'),
          cancelText: t('common.cancel', '取消'),
          destructive: true
        }
      )
      if (confirmed) {
        try {
          await onDelete(id)
        } catch (error) {
          console.warn('[PromptShortcutSheet] delete failed', error)
          toast.showError(t('common.errors.save_failed', '保存失败'))
        }
      }
    },
    [dialog, onDelete, t, toast]
  )

  const handleSave = useCallback(async () => {
    if (!editingItem || !draftContent.trim()) {
      await traceCall(SHORTCUT_TRACE_CHAIN, 'UI.save.skip', async () => ({
        reason: 'empty-content',
        draftContentLength: draftContent.trim().length
      }))
      return
    }
    const isNew = editingItem.id === 'new'
    if (isNew && !onAdd) return
    if (!isNew && !onUpdate) return

    const payload: PromptShortcut = {
      ...editingItem,
      id: isNew ? `custom-${Date.now()}` : editingItem.id,
      icon: '',
      name: draftName.trim() || t('shortcut.default_tag', '指令'),
      content: draftContent.trim()
    }

    if (findShortcutCommandConflict(shortcuts, payload, isNew ? undefined : payload.id)) {
      toast.showError(t('shortcut.duplicate_command', '已存在相同快捷短语的指令，请换一个短语'))
      return
    }

    const nextCount = isNew ? shortcuts.length + 1 : shortcuts.length

    setSaving(true)
    try {
      await traceCall(
        SHORTCUT_TRACE_CHAIN,
        'UI.save',
        async () => {
          if (isNew) {
            await onAdd!(payload)
            setCurrentPage(Math.max(1, Math.ceil(nextCount / SHORTCUT_PAGE_SIZE)))
          } else {
            await onUpdate!(payload)
          }
          setSearchQuery('')
          resetEditing()
          return { count: nextCount, id: payload.id }
        },
        { isNew, payload }
      )
    } catch {
      toast.showError(t('common.errors.save_failed', '保存失败'))
    } finally {
      setSaving(false)
    }
    // shortcuts 只取 length，避免整表引用变化就重建保存回调
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    draftContent,
    draftName,
    editingItem,
    shortcuts.length,
    onAdd,
    onUpdate,
    resetEditing,
    setCurrentPage,
    setSearchQuery,
    t,
    toast
  ])

  const handleMoveItem = useCallback(
    (index: number, direction: -1 | 1) => {
      if (!onReorder || isSearchActive) return
      const targetIndex = index + direction
      if (targetIndex < 0 || targetIndex >= paginatedShortcuts.length) return

      const pageItems = paginatedShortcuts.slice()
      const [moved] = pageItems.splice(index, 1)
      pageItems.splice(targetIndex, 0, moved)
      const next = mergePageReorder(shortcuts, pageStartIndex, pageSize, pageItems)
      void onReorder(next).catch((error) => {
        console.warn('[PromptShortcutSheet] reorder failed', error)
        toast.showError(t('common.errors.save_failed', '保存失败'))
      })
    },
    [isSearchActive, onReorder, pageSize, pageStartIndex, paginatedShortcuts, shortcuts, t, toast]
  )

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.gestureRoot}>
        <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close', '关闭')}
          />

          <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
            <View
              style={[
                styles.modalContent,
                {
                  width: '94%',
                  maxWidth: maxModalWidth,
                  height: modalHeight,
                  backgroundColor: colors.bgSurface,
                  borderRadius: tokens.radius.xl,
                  padding: tokens.spacing.lg
                }
              ]}
            >
              {editingItem ? (
                <PromptShortcutEditor
                  editingItem={editingItem}
                  draftName={draftName}
                  draftContent={draftContent}
                  saving={saving}
                  colors={colors}
                  onChangeName={setDraftName}
                  onChangeContent={setDraftContent}
                  onCancel={resetEditing}
                  onSave={() => void handleSave()}
                />
              ) : (
                <View style={styles.listPane}>
                  <View style={styles.header}>
                    <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                      {t('input.shortcut_command', '快捷指令')}
                    </Text>
                    <View style={styles.headerActions}>
                      {canManage ? (
                        <Pressable
                          style={[styles.addBtn, { backgroundColor: colors.primary }]}
                          onPress={handleCreateNew}
                        >
                          <Text
                            style={{ color: colors.textOnPrimary, fontWeight: '600', fontSize: 13 }}
                          >
                            + {t('shortcut.add_short', '新增')}
                          </Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={handleClose} hitSlop={12}>
                        <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
                      </Pressable>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.slashHint,
                      {
                        color: colors.textSecondary,
                        backgroundColor: colors.primaryContainer,
                        borderColor: colors.borderMuted
                      }
                    ]}
                  >
                    {t(
                      'shortcut.input_slash_hint',
                      '在空输入框输入 / 可快速匹配快捷指令；继续输入可过滤，按回车或点击条目即可插入正文。'
                    )}
                  </Text>

                  <View
                    style={[
                      styles.searchRow,
                      {
                        backgroundColor: colors.bgSurface,
                        borderColor: colors.borderControl
                      }
                    ]}
                  >
                    <Search
                      size={20}
                      color={colors.textTertiary}
                      strokeWidth={DEFAULT_STROKE_WIDTH}
                    />
                    <TextInput
                      value={searchQuery}
                      onChangeText={setSearchQuery}
                      placeholder={t('shortcut.search_placeholder', '搜索快捷指令...')}
                      placeholderTextColor={colors.textTertiary}
                      style={[styles.searchInput, { color: colors.textPrimary }]}
                      returnKeyType="search"
                      clearButtonMode="while-editing"
                    />
                    {searchQuery.length > 0 ? (
                      <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
                        <X
                          size={18}
                          color={colors.textTertiary}
                          strokeWidth={DEFAULT_STROKE_WIDTH}
                        />
                      </Pressable>
                    ) : null}
                  </View>

                  {canManage && canDrag ? (
                    <Text style={[styles.dragHint, { color: colors.textTertiary }]}>
                      {t('shortcut.drag_sort_hint', '长按左侧把手拖动排序')}
                    </Text>
                  ) : null}

                  <View style={styles.listArea} onLayout={handleListAreaLayout}>
                    {paginatedShortcuts.length === 0 ? (
                      <View style={[styles.emptyContainer, { padding: tokens.spacing.lg }]}>
                        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                          {isSearchActive
                            ? t('shortcut.no_match', '找不到任何匹配的快捷指令')
                            : t('shortcut.no_shortcuts_hint', '暂无任何快捷指令，立即创建一个吧。')}
                        </Text>
                        {canManage && !isSearchActive ? (
                          <Pressable
                            style={[styles.emptyAddBtn, { backgroundColor: colors.primary }]}
                            onPress={handleCreateNew}
                          >
                            <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
                              + {t('shortcut.add_custom_command', '新增自定义指令')}
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>
                    ) : (
                      <FlatList
                        style={listAreaHeight != null ? { height: listAreaHeight } : styles.list}
                        contentContainerStyle={styles.listContent}
                        data={paginatedShortcuts}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item, index }) => (
                          <PromptShortcutRow
                            item={item}
                            index={index}
                            pageLength={paginatedShortcuts.length}
                            canManage={canManage}
                            canDrag={canDrag}
                            colors={colors}
                            defaultShortcutLabels={defaultShortcutLabels}
                            onSelect={(shortcut) => {
                              onSelect(shortcut)
                              handleClose()
                            }}
                            onEdit={handleEdit}
                            onDelete={(id) => void handleDeletePress(id)}
                            onMove={handleMoveItem}
                            onReorder={onReorder}
                          />
                        )}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      />
                    )}
                  </View>

                  {filteredShortcuts.length > 0 && totalPages > 1 ? (
                    <View style={[styles.paginationBar, { borderTopColor: colors.borderSubtle }]}>
                      <Text style={[styles.pageMeta, { color: colors.textSecondary }]}>
                        {t('common.page_info', '{{current}} / {{total}}', {
                          current: currentPage,
                          total: totalPages
                        })}
                      </Text>
                      <View style={styles.pageNavBtns}>
                        <Pressable
                          style={[
                            styles.pageNavBtn,
                            {
                              borderColor: colors.borderControl,
                              opacity: currentPage <= 1 ? 0.4 : 1
                            }
                          ]}
                          disabled={currentPage <= 1}
                          onPress={() => setCurrentPage(currentPage - 1)}
                        >
                          <ChevronLeft
                            size={22}
                            color={colors.textPrimary}
                            strokeWidth={DEFAULT_STROKE_WIDTH}
                          />
                        </Pressable>
                        <Pressable
                          style={[
                            styles.pageNavBtn,
                            {
                              borderColor: colors.borderControl,
                              opacity: currentPage >= totalPages ? 0.4 : 1
                            }
                          ]}
                          disabled={currentPage >= totalPages}
                          onPress={() => setCurrentPage(currentPage + 1)}
                        >
                          <ChevronRight
                            size={22}
                            color={colors.textPrimary}
                            strokeWidth={DEFAULT_STROKE_WIDTH}
                          />
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </View>
    </Modal>
  )
}
