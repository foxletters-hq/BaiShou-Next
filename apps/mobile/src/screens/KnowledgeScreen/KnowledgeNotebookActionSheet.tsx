import React from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Edit3, FileText, ArrowUp, ArrowDown, Trash2 } from 'lucide-react-native'
import { Modal, useNativeTheme } from '@baishou/ui/native'
import { createKnowledgeScreenStyles } from './knowledge-screen.styles'
import type { NotebookCardItem } from './KnowledgeNotebookCard'

export interface KnowledgeNotebookActionSheetProps {
  visible: boolean
  busy: boolean
  item: NotebookCardItem | null
  index: number
  totalCount: number
  onClose: () => void
  onRename: () => void
  onEditDescription: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDelete: () => void
}

export function KnowledgeNotebookActionSheet({
  visible,
  busy,
  item,
  index,
  totalCount,
  onClose,
  onRename,
  onEditDescription,
  onMoveUp,
  onMoveDown,
  onDelete
}: KnowledgeNotebookActionSheetProps) {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const styles = createKnowledgeScreenStyles(colors, tokens, isDark)

  if (!item) return null

  return (
    <Modal visible={visible} title={item.name} onClose={busy ? undefined : onClose}>
      <View style={{ gap: tokens.spacing.xs }}>
        <Pressable
          style={({ pressed }) => [
            styles.actionSheetItem,
            { backgroundColor: pressed ? colors.primaryLight : 'transparent' }
          ]}
          disabled={busy}
          onPress={() => {
            onClose()
            onEditDescription()
          }}
        >
          <FileText size={18} color={colors.textPrimary} />
          <Text style={styles.actionSheetItemText}>{t('knowledge.edit_description', '简介')}</Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionSheetItem,
            { backgroundColor: pressed ? colors.primaryLight : 'transparent' }
          ]}
          disabled={busy}
          onPress={() => {
            onClose()
            onRename()
          }}
        >
          <Edit3 size={18} color={colors.textPrimary} />
          <Text style={styles.actionSheetItemText}>{t('knowledge.rename_notebook', '重命名')}</Text>
        </Pressable>

        {index > 0 ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionSheetItem,
              { backgroundColor: pressed ? colors.primaryLight : 'transparent' }
            ]}
            disabled={busy}
            onPress={() => {
              onClose()
              onMoveUp()
            }}
          >
            <ArrowUp size={18} color={colors.textPrimary} />
            <Text style={styles.actionSheetItemText}>{t('knowledge.move_up', '上移')}</Text>
          </Pressable>
        ) : null}

        {index < totalCount - 1 ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionSheetItem,
              { backgroundColor: pressed ? colors.primaryLight : 'transparent' }
            ]}
            disabled={busy}
            onPress={() => {
              onClose()
              onMoveDown()
            }}
          >
            <ArrowDown size={18} color={colors.textPrimary} />
            <Text style={styles.actionSheetItemText}>{t('knowledge.move_down', '下移')}</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.actionSheetItem,
            { backgroundColor: pressed ? colors.errorContainer : 'transparent' }
          ]}
          disabled={busy}
          onPress={() => {
            onClose()
            onDelete()
          }}
        >
          <Trash2 size={18} color={colors.error} />
          <Text style={styles.actionSheetDestructiveText}>
            {t('knowledge.delete_notebook', '删除笔记本')}
          </Text>
        </Pressable>
      </View>
    </Modal>
  )
}
