import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Modal,
  SafeAreaView,
  StyleSheet,
  Dimensions,
  type LayoutChangeEvent
} from 'react-native'
import DraggableFlatList, { type RenderItemParams } from 'react-native-draggable-flatlist'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import {
  SHORTCUT_TRACE_CHAIN,
  traceCall,
  findShortcutCommandConflict,
  getDefaultShortcutLabelsFromT,
  isProtectedSkill
} from '@baishou/shared'
import type { PromptShortcut } from '@baishou/shared'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { Button } from '../Button'
import { useNativeToast } from '../Toast'
import { useDialog } from '../Dialog'
import {
  isSameShortcutOrder,
  mergePageReorder,
  SHORTCUT_PAGE_SIZE,
  usePromptShortcutSheet
} from './usePromptShortcutSheet'
import { PromptShortcutRow } from './PromptShortcutRow'
import { PromptShortcutEditor } from './PromptShortcutEditor'
import {
  PromptShortcutEmptyState,
  PromptShortcutPaginationBar,
  PromptShortcutSearchSection
} from './PromptShortcutSheetSections'
import { nativeLightHaptic } from './native-light-haptic.util'
import {
  buildShortcutEditorPayload,
  resolveShortcutEditorDraft
} from './prompt-shortcut-editor.util'
import { promptShortcutSheetStyles as styles } from './prompt-shortcut-sheet.styles'

/** 夹紧回弹，避免按住顶部条目时下列条目弹簧超调弹一下 */
const DRAG_SPRING = {
  damping: 20,
  mass: 0.2,
  stiffness: 100,
  overshootClamping: true,
  restSpeedThreshold: 0.2,
  restDisplacementThreshold: 0.2
}

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
  const { colors, tokens, maxModalWidth, isDark } = useNativeTheme()
  const canManage = Boolean(onAdd && onUpdate && onDelete)
  const defaultShortcutLabels = useMemo(() => getDefaultShortcutLabelsFromT(t), [t])
  const shortcutsRef = useRef(shortcuts)
  shortcutsRef.current = shortcuts

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

  const [listData, setListData] = useState(paginatedShortcuts)
  const listDataRef = useRef(paginatedShortcuts)
  listDataRef.current = listData

  useEffect(() => {
    if (isSameShortcutOrder(listDataRef.current, paginatedShortcuts)) return
    setListData(paginatedShortcuts)
  }, [paginatedShortcuts])

  const [listAreaHeight, setListAreaHeight] = useState<number | null>(null)
  const listAreaHeightRef = useRef<number | null>(null)
  const listSizeStyle = useMemo(
    () => (listAreaHeight != null ? { height: listAreaHeight } : styles.list),
    [listAreaHeight]
  )
  const handleListAreaLayout = useCallback((event: LayoutChangeEvent) => {
    const height = event.nativeEvent.layout.height
    if (height > 0 && height !== listAreaHeightRef.current) {
      listAreaHeightRef.current = height
      setListAreaHeight(height)
    }
  }, [])

  const [editingItem, setEditingItem] = useState<PromptShortcut | null>(null)
  const [draftCommand, setDraftCommand] = useState('')
  const [draftDescription, setDraftDescription] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [saving, setSaving] = useState(false)

  const windowHeight = Dimensions.get('window').height
  const modalHeight = Math.min(windowHeight * 0.72, 580)

  const resetEditing = useCallback(() => {
    setEditingItem(null)
    setDraftCommand('')
    setDraftDescription('')
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
    setDraftCommand('')
    setDraftDescription('')
    setDraftContent('')
  }, [])

  const handleEdit = useCallback((item: PromptShortcut) => {
    if (isProtectedSkill(item)) return
    const draft = resolveShortcutEditorDraft(item)
    setEditingItem(item)
    setDraftCommand(draft.command)
    setDraftDescription(draft.description)
    setDraftContent(draft.content)
  }, [])

  const handleDeletePress = useCallback(
    async (id: string) => {
      if (!onDelete || isProtectedSkill({ id })) return
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
      ...buildShortcutEditorPayload(
        editingItem,
        {
          command: draftCommand,
          description: draftDescription,
          content: draftContent
        },
        t('shortcut.default_tag', '指令')
      ),
      id: isNew ? `custom-${Date.now()}` : editingItem.id,
      icon: ''
    }

    if (isProtectedSkill(payload)) {
      toast.showError(t('shortcut.reserved_command', '该名称已保留，请换一个 Skill 名称'))
      return
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
    draftCommand,
    draftContent,
    draftDescription,
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

  const handleDragBegin = useCallback(() => {
    nativeLightHaptic()
  }, [])

  const handleDragEnd = useCallback(
    ({ data }: { data: PromptShortcut[] }) => {
      if (!onReorder || isSearchActive) return
      setListData((prev) => (isSameShortcutOrder(prev, data) ? prev : data))
      const next = mergePageReorder(shortcutsRef.current, pageStartIndex, pageSize, data)
      if (isSameShortcutOrder(shortcutsRef.current, next)) return
      void onReorder(next).catch((error) => {
        console.warn('[PromptShortcutSheet] reorder failed', error)
        toast.showError(t('common.errors.save_failed', '保存失败'))
      })
    },
    [isSearchActive, onReorder, pageSize, pageStartIndex, t, toast]
  )

  const handleSelectShortcut = useCallback(
    (shortcut: PromptShortcut) => {
      onSelect(shortcut)
      handleClose()
    },
    [handleClose, onSelect]
  )

  const renderShortcutRow = useCallback(
    (item: PromptShortcut, drag?: () => void, isDragging?: boolean) => (
      <PromptShortcutRow
        item={item}
        canManage={canManage}
        canDrag={canDrag && Boolean(onReorder)}
        isDragging={isDragging}
        isDark={isDark}
        colors={colors}
        defaultShortcutLabels={defaultShortcutLabels}
        onSelect={handleSelectShortcut}
        onEdit={handleEdit}
        onDelete={handleDeletePress}
        onDrag={drag}
      />
    ),
    [
      canDrag,
      canManage,
      colors,
      defaultShortcutLabels,
      handleDeletePress,
      handleEdit,
      handleSelectShortcut,
      isDark,
      onReorder
    ]
  )

  const renderDraggableItem = useCallback(
    ({ item, drag, isActive }: RenderItemParams<PromptShortcut>) =>
      renderShortcutRow(item, drag, isActive),
    [renderShortcutRow]
  )

  if (!visible) return null

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
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
                  backgroundColor: isDark ? colors.bgSurface : colors.bgApp,
                  borderRadius: tokens.radius.xl,
                  padding: tokens.spacing.lg
                }
              ]}
            >
              {editingItem ? (
                <PromptShortcutEditor
                  editingItem={editingItem}
                  draftCommand={draftCommand}
                  draftDescription={draftDescription}
                  draftContent={draftContent}
                  saving={saving}
                  colors={colors}
                  onChangeCommand={setDraftCommand}
                  onChangeDescription={setDraftDescription}
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
                        <Button size="sm" onPress={handleCreateNew}>
                          + {t('shortcut.add_short', '新增')}
                        </Button>
                      ) : null}
                      <Pressable onPress={handleClose} hitSlop={12}>
                        <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>×</Text>
                      </Pressable>
                    </View>
                  </View>

                  <PromptShortcutSearchSection
                    hint={t(
                      'shortcut.input_slash_hint',
                      '在空输入框输入 / 可快速匹配快捷指令；继续输入可过滤，按回车或点击条目即可插入正文。'
                    )}
                    searchQuery={searchQuery}
                    onChangeSearchQuery={setSearchQuery}
                    placeholder={t('shortcut.search_placeholder', '搜索快捷指令...')}
                    dragHint={
                      canManage && canDrag
                        ? t('shortcut.drag_sort_hint', '按住条目即可拖动排序')
                        : undefined
                    }
                    colors={colors}
                  />

                  <View style={styles.listArea} onLayout={handleListAreaLayout}>
                    {paginatedShortcuts.length === 0 ? (
                      <PromptShortcutEmptyState
                        text={
                          isSearchActive
                            ? t('shortcut.no_match', '找不到任何匹配的快捷指令')
                            : t('shortcut.no_shortcuts_hint', '暂无任何快捷指令，立即创建一个吧。')
                        }
                        canAdd={canManage && !isSearchActive}
                        addLabel={t('shortcut.add_custom_command', '新增自定义指令')}
                        onAdd={handleCreateNew}
                        colors={colors}
                      />
                    ) : canDrag && onReorder ? (
                      <DraggableFlatList
                        style={listSizeStyle}
                        containerStyle={listSizeStyle}
                        contentContainerStyle={styles.listContent}
                        data={listData}
                        keyExtractor={(item) => item.id}
                        renderItem={renderDraggableItem}
                        onDragBegin={handleDragBegin}
                        onDragEnd={handleDragEnd}
                        activationDistance={0}
                        autoscrollThreshold={tokens.spacing.sm}
                        animationConfig={DRAG_SPRING}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      />
                    ) : (
                      <FlatList
                        style={listSizeStyle}
                        contentContainerStyle={styles.listContent}
                        data={paginatedShortcuts}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) => renderShortcutRow(item)}
                        keyboardShouldPersistTaps="handled"
                        showsVerticalScrollIndicator={false}
                      />
                    )}
                  </View>

                  {filteredShortcuts.length > 0 && totalPages > 1 ? (
                    <PromptShortcutPaginationBar
                      pageInfo={t('common.page_info', '{{current}} / {{total}}', {
                        current: currentPage,
                        total: totalPages
                      })}
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onChangePage={setCurrentPage}
                      colors={colors}
                    />
                  ) : null}
                </View>
              )}
            </View>
          </SafeAreaView>
        </View>
      </GestureHandlerRootView>
    </Modal>
  )
}
