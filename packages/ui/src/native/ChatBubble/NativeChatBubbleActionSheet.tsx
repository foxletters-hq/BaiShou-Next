import React from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ChatBubbleMessage } from './chat-bubble.types'
import { chatBubbleStyles as styles } from './chat-bubble.styles'

interface ThemeColors {
  bgSurface: string
  textPrimary: string
  textSecondary: string
  borderSubtle: string
  error?: string
}

interface NativeChatBubbleActionSheetProps {
  visible: boolean
  colors: ThemeColors
  isUser: boolean
  isAssistant: boolean
  hasContext: boolean
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
  colors,
  isUser,
  isAssistant,
  hasContext,
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

  const renderItem = (label: string, onPress: () => void, destructive = false) => (
    <TouchableOpacity
      onPress={() => {
        onPress()
        onClose()
      }}
      style={styles.actionItem}
    >
      <Text
        style={[styles.actionItemText, { color: destructive ? colors.error : colors.textPrimary }]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  )

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.actionSheet, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.actionSheetTitle, { color: colors.textPrimary }]}>
            {t('agent.chat.message_actions', '消息操作')}
          </Text>
          <ScrollView>
            {onCopy && renderItem(t('common.copy', '复制'), onCopy)}
            {isUser && onResend && renderItem(t('agent.chat.resend', '重新发送'), onResend)}
            {(isUser || isAssistant) &&
              renderItem(
                t(isAssistant ? 'agent.chat.edit_ai' : 'agent.chat.edit', '编辑'),
                onStartEdit
              )}
            {isAssistant &&
              onReadAloud &&
              renderItem(t('agent.chat.readAloud', '语音朗读'), () => onReadAloud(message.content))}
            {isAssistant &&
              hasContext &&
              onShowContext &&
              renderItem(t('agent.chat.context_chain', '上下文链'), () => onShowContext(message))}
            {isAssistant &&
              onRegenerate &&
              renderItem(t('agent.chat.regenerate', '重新生成'), onRegenerate)}
            {isAssistant &&
              onBranch &&
              renderItem(t('agent.chat.branch', '从此处创建分支'), onBranch)}
            {onDelete && renderItem(t('common.delete', '删除'), onDelete, true)}
          </ScrollView>
          <TouchableOpacity
            onPress={onClose}
            style={[styles.actionCancel, { borderTopColor: colors.borderSubtle }]}
          >
            <Text style={[styles.actionCancelText, { color: colors.textSecondary }]}>
              {t('common.cancel', '取消')}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  )
}
