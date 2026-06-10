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
  ScrollView,
  TextInput,
  type LayoutChangeEvent
} from 'react-native'
import { SHORTCUT_TRACE_CHAIN, traceCall } from '@baishou/shared'
import { MaterialIcons } from '@expo/vector-icons'
import type { PromptShortcut } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { useNativeToast } from '../Toast'
import { Input } from '../Input/Input'
import { useDialog } from '../Dialog/Dialog'
import {
  mergePageReorder,
  SHORTCUT_PAGE_SIZE,
  usePromptShortcutSheet
} from './usePromptShortcutSheet'

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

const ROW_MIN_HEIGHT = 60

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

  // FlatList 在 Android + flex:1 父级下经常测到 0 高度，列表区域空白（见 ProviderSortableList）
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

  const renderShortcutRow = useCallback(
    (item: PromptShortcut, index: number) => (
      <View
        style={[
          styles.item,
          {
            backgroundColor: colors.bgSurfaceHigh,
            borderColor: colors.borderSubtle,
            minHeight: ROW_MIN_HEIGHT
          }
        ]}
      >
        {canManage ? (
          canDrag && onReorder ? (
            <View style={styles.reorderBtns}>
              <Pressable
                style={[styles.reorderBtn, { opacity: index <= 0 ? 0.3 : 1 }]}
                disabled={index <= 0}
                onPress={() => handleMoveItem(index, -1)}
                hitSlop={6}
                accessibilityLabel={t('shortcut.move_up', '上移')}
              >
                <MaterialIcons name="keyboard-arrow-up" size={22} color={colors.textTertiary} />
              </Pressable>
              <Pressable
                style={[
                  styles.reorderBtn,
                  { opacity: index >= paginatedShortcuts.length - 1 ? 0.3 : 1 }
                ]}
                disabled={index >= paginatedShortcuts.length - 1}
                onPress={() => handleMoveItem(index, 1)}
                hitSlop={6}
                accessibilityLabel={t('shortcut.move_down', '下移')}
              >
                <MaterialIcons name="keyboard-arrow-down" size={22} color={colors.textTertiary} />
              </Pressable>
            </View>
          ) : (
            <View style={styles.reorderSpacer} />
          )
        ) : null}

        <Pressable
          style={styles.itemBody}
          onPress={() => {
            onSelect(item)
            handleClose()
          }}
        >
          <Text style={[styles.itemName, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.name || t('shortcut.default_tag', '指令')}
          </Text>
          <Text style={[styles.itemContent, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.content}
          </Text>
        </Pressable>

        {canManage ? (
          <View style={styles.itemActions}>
            <Pressable
              style={styles.actionBtn}
              hitSlop={8}
              onPress={() => handleEdit(item)}
              accessibilityLabel={t('shortcut.edit', '编辑')}
            >
              <MaterialIcons name="edit" size={20} color={colors.textTertiary} />
            </Pressable>
            <Pressable
              style={styles.actionBtn}
              hitSlop={8}
              onPress={() => void handleDeletePress(item.id)}
              accessibilityLabel={t('common.delete', '删除')}
            >
              <MaterialIcons name="delete-outline" size={22} color={colors.error} />
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [
      canDrag,
      canManage,
      colors,
      handleClose,
      handleDeletePress,
      handleEdit,
      handleMoveItem,
      onReorder,
      onSelect,
      paginatedShortcuts.length,
      t
    ]
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
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.header}>
                    <Text style={[styles.headerText, { color: colors.textPrimary }]}>
                      {editingItem.id === 'new'
                        ? t('shortcut.add_custom_command', '新增自定义指令')
                        : t('shortcut.edit', '编辑')}
                    </Text>
                    <Pressable onPress={resetEditing} hitSlop={12}>
                      <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
                    </Pressable>
                  </View>

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    {t('shortcut.label_name', '指令名称')}
                  </Text>
                  <Input
                    value={draftName}
                    onChangeText={setDraftName}
                    placeholder={t('shortcut.label_hint', '例如：翻译')}
                    style={styles.fieldInput}
                  />

                  <Text style={[styles.fieldLabel, { color: colors.textSecondary, marginTop: 12 }]}>
                    {t('shortcut.content_prompt', '对应内容')}
                  </Text>
                  <Input
                    value={draftContent}
                    onChangeText={setDraftContent}
                    placeholder={t('shortcut.content_hint', '请帮我翻译下面这段文本。')}
                    multiline
                    textarea
                    style={[styles.fieldInput, styles.fieldTextArea]}
                  />

                  <View style={styles.formActions}>
                    <Pressable
                      style={[styles.formBtn, { borderColor: colors.borderMuted }]}
                      onPress={resetEditing}
                    >
                      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>
                        {t('common.cancel', '取消')}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.formBtn,
                        styles.formBtnPrimary,
                        {
                          backgroundColor: colors.primary,
                          opacity: !draftContent.trim() || saving ? 0.5 : 1
                        }
                      ]}
                      disabled={!draftContent.trim() || saving}
                      onPress={() => void handleSave()}
                    >
                      <Text style={{ color: colors.textOnPrimary, fontWeight: '600' }}>
                        {t('common.save', '保存')}
                      </Text>
                    </Pressable>
                  </View>
                </ScrollView>
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

                  <View
                    style={[
                      styles.searchRow,
                      {
                        backgroundColor: colors.bgSurfaceNormal,
                        borderColor: colors.borderMuted
                      }
                    ]}
                  >
                    <MaterialIcons name="search" size={20} color={colors.textTertiary} />
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
                        <MaterialIcons name="close" size={18} color={colors.textTertiary} />
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
                        renderItem={({ item, index }) => renderShortcutRow(item, index)}
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
                              borderColor: colors.borderMuted,
                              opacity: currentPage <= 1 ? 0.4 : 1
                            }
                          ]}
                          disabled={currentPage <= 1}
                          onPress={() => setCurrentPage(currentPage - 1)}
                        >
                          <MaterialIcons name="chevron-left" size={22} color={colors.textPrimary} />
                        </Pressable>
                        <Pressable
                          style={[
                            styles.pageNavBtn,
                            {
                              borderColor: colors.borderMuted,
                              opacity: currentPage >= totalPages ? 0.4 : 1
                            }
                          ]}
                          disabled={currentPage >= totalPages}
                          onPress={() => setCurrentPage(currentPage + 1)}
                        >
                          <MaterialIcons
                            name="chevron-right"
                            size={22}
                            color={colors.textPrimary}
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

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  safeArea: {
    width: '100%',
    alignItems: 'center',
    zIndex: 2
  },
  modalContent: {
    overflow: 'hidden'
  },
  listPane: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10
  },
  headerText: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1
  },
  closeIcon: {
    fontSize: 24,
    lineHeight: 24
  },
  addBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
    height: 40
  },
  dragHint: {
    fontSize: 11,
    marginBottom: 8
  },
  listArea: {
    flex: 1,
    minHeight: 160
  },
  list: {
    flex: 1
  },
  listContent: {
    paddingBottom: 8
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden'
  },
  reorderBtns: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'stretch',
    gap: 2
  },
  reorderSpacer: {
    width: 36,
    alignSelf: 'stretch'
  },
  reorderBtn: {
    width: 32,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center'
  },
  itemBody: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 4
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600'
  },
  itemContent: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18
  },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 6
  },
  actionBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center'
  },
  emptyAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10
  },
  paginationBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between'
  },
  pageMeta: {
    fontSize: 13
  },
  pageNavBtns: {
    flexDirection: 'row',
    gap: 8
  },
  pageNavBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center'
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6
  },
  fieldInput: {
    fontSize: 15,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  fieldTextArea: {
    minHeight: 120,
    maxHeight: 180
  },
  formActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20
  },
  formBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth
  },
  formBtnPrimary: {
    borderWidth: 0
  }
})
