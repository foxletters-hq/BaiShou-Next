import React from 'react'
import { View, Text, TouchableOpacity, Modal, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import type { ChatBubbleMessage } from './chat-bubble.types'

interface ThemeColors {
  bgSurface: string
  textPrimary: string
  textSecondary: string
  borderSubtle: string
  error?: string
}
import { chatBubbleStyles as styles } from './chat-bubble.styles'

interface NativeChatBubbleActionSheetProps {
  visible: boolean
  colors: ThemeColors
  isUser: boolean
  isAssistant: boolean
  hasContext: boolean
  message: ChatBubbleMessage
  onClose: () => void
  onStartEdit: () => void
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
  onResend,
  onReadAloud,
  onShowContext,
  onRegenerate,
  onBranch,
  onDelete
}) => {
  const { t } = useTranslation()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.actionOverlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.actionSheet, { backgroundColor: colors.bgSurface }]}>
          <Text style={[styles.actionSheetTitle, { color: colors.textPrimary }]}>
            {t('agent.chat.message_actions', '消息操作')}
          </Text>
          <ScrollView>
            {isUser && onResend && (
              <TouchableOpacity
                onPress={() => {
                  onResend()
                  onClose()
                }}
                style={styles.actionItem}
              >
                <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>
                  🔄 {t('agent.chat.resend', '重新发送')}
                </Text>
              </TouchableOpacity>
            )}
            {(isUser || isAssistant) && (
              <TouchableOpacity onPress={onStartEdit} style={styles.actionItem}>
                <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>
                  ✏️ {t('common.edit', '编辑')}
                </Text>
              </TouchableOpacity>
            )}
            {isAssistant && onReadAloud && (
              <TouchableOpacity
                onPress={() => {
                  onReadAloud(message.content)
                  onClose()
                }}
                style={styles.actionItem}
              >
                <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>
                  🔈 {t('agent.chat.read_aloud', '朗读')}
                </Text>
              </TouchableOpacity>
            )}
            {isAssistant && hasContext && onShowContext && (
              <TouchableOpacity
                onPress={() => {
                  onShowContext(message)
                  onClose()
                }}
                style={styles.actionItem}
              >
                <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>
                  🌿 {t('agent.chat.context_chain', '上下文链')}
                </Text>
              </TouchableOpacity>
            )}
            {isAssistant && onRegenerate && (
              <TouchableOpacity
                onPress={() => {
                  onRegenerate()
                  onClose()
                }}
                style={styles.actionItem}
              >
                <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>
                  🔄 {t('agent.chat.regenerate', '重新生成')}
                </Text>
              </TouchableOpacity>
            )}
            {isAssistant && onBranch && (
              <TouchableOpacity
                onPress={() => {
                  onBranch()
                  onClose()
                }}
                style={styles.actionItem}
              >
                <Text style={[styles.actionItemText, { color: colors.textPrimary }]}>
                  🔀 {t('agent.chat.branch', '创建分支')}
                </Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                onPress={() => {
                  onDelete()
                  onClose()
                }}
                style={styles.actionItem}
              >
                <Text style={[styles.actionItemText, { color: colors.error || '#ef4444' }]}>
                  🗑️ {t('common.delete', '删除')}
                </Text>
              </TouchableOpacity>
            )}
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
