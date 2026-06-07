import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Modal } from '../Modal/Modal'
import { useNativeTheme } from '../theme'
import type { ChatBubbleMessage } from './chat-bubble.types'

interface NativeChatBubbleActionSheetProps {
  visible: boolean
  isUser: boolean
  isAssistant: boolean
  message: ChatBubbleMessage
  onClose: () => void
  onStartEdit: () => void
  onCopy?: () => void
  onResend?: () => void
  onReadAloud?: (content: string) => void
  onShowContext?: (msg: ChatBubbleMessage) => void
  onRegenerate?: () => void
  onBranch?: () => void
  onDelete?: () => void
}

export const NativeChatBubbleActionSheet: React.FC<NativeChatBubbleActionSheetProps> = ({
  visible,
  isUser,
  isAssistant,
  message,
  onClose,
  onStartEdit,
  onCopy,
  onResend,
  onReadAloud,
  onShowContext,
  onRegenerate,
  onBranch,
  onDelete
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()

  const run = (action?: () => void) => {
    if (!action) return
    action()
    onClose()
  }

  const items: Array<{ key: string; label: string; onPress?: () => void; destructive?: boolean }> =
    []

  if (onCopy) {
    items.push({ key: 'copy', label: t('common.copy', '复制'), onPress: onCopy })
  }
  if (isUser && onResend) {
    items.push({ key: 'resend', label: t('agent.chat.resend', '重新发送'), onPress: onResend })
  }
  if (isUser || isAssistant) {
    items.push({
      key: 'edit',
      label: t(isAssistant ? 'agent.chat.edit_ai' : 'agent.chat.edit', '编辑'),
      onPress: onStartEdit
    })
  }
  if (isAssistant && onReadAloud) {
    items.push({
      key: 'read',
      label: t('agent.chat.readAloud', '语音朗读'),
      onPress: () => onReadAloud(message.content)
    })
  }
  if (isAssistant && onShowContext) {
    items.push({
      key: 'context',
      label: t('chat.viewContextTree', '查看发送给 AI 的上下文'),
      onPress: () => onShowContext(message)
    })
  }
  if (isAssistant && onRegenerate) {
    items.push({
      key: 'regen',
      label: t('agent.chat.regenerate', '重新生成'),
      onPress: onRegenerate
    })
  }
  if (isAssistant && onBranch) {
    items.push({
      key: 'branch',
      label: t('agent.chat.branch', '从此处创建分支'),
      onPress: onBranch
    })
  }
  if (onDelete) {
    items.push({
      key: 'delete',
      label: t('common.delete', '删除'),
      onPress: onDelete,
      destructive: true
    })
  }

  return (
    <Modal
      visible={visible}
      onClose={onClose}
      title={t('agent.chat.message_actions', '消息操作')}
      animationType="fade"
    >
      <View style={styles.list}>
        {items.map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => run(item.onPress)}
            style={({ pressed }) => [
              styles.item,
              index > 0 && {
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: colors.borderSubtle
              },
              pressed && { opacity: 0.7 }
            ]}
          >
            <Text
              style={[
                styles.itemText,
                { color: item.destructive ? colors.error : colors.textPrimary }
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>
      <Pressable
        onPress={onClose}
        style={({ pressed }) => [
          styles.cancelBtn,
          {
            marginTop: tokens.spacing.sm,
            borderColor: colors.borderSubtle,
            opacity: pressed ? 0.7 : 1
          }
        ]}
      >
        <Text style={[styles.cancelText, { color: colors.textSecondary }]}>
          {t('common.cancel', '取消')}
        </Text>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  list: {
    width: '100%'
  },
  item: {
    paddingVertical: 14,
    paddingHorizontal: 4,
    alignItems: 'center'
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500'
  },
  cancelBtn: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center'
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600'
  }
})
