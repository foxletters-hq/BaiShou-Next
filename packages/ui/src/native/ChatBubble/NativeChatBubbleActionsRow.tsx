import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MessageActionBar } from '../MessageActionBar/MessageActionBar'
import { NativeIconButton } from '../icons/NativeIconButton'
import type { ChatBubbleMessage } from './chat-bubble.types'
import { chatBubbleStyles as styles } from './chat-bubble.styles'

interface ThemeColors {
  primary: string
  textOnPrimary: string
  textPrimary: string
  textSecondary: string
  textTertiary: string
  borderSubtle: string
  error?: string
}

interface NativeChatBubbleActionsRowProps {
  colors: ThemeColors
  isUser: boolean
  isAssistant: boolean
  hasContext: boolean
  message: ChatBubbleMessage
  isTtsPlaying: boolean
  onCopy: () => void
  onStartEdit: () => void
  onResend?: () => void
  onReadAloud?: (content: string) => void
  onShowContext?: (msg: ChatBubbleMessage) => void
  onRegenerate?: () => void
  onBranch?: () => void
  onSaveEdit?: (content: string) => void
  onDelete?: () => void
}

export const NativeChatBubbleActionsRow: React.FC<NativeChatBubbleActionsRowProps> = ({
  isUser,
  isAssistant,
  hasContext,
  message,
  isTtsPlaying,
  onCopy,
  onStartEdit,
  onResend,
  onReadAloud,
  onShowContext,
  onRegenerate,
  onBranch,
  onSaveEdit,
  onDelete
}) => {
  const { t } = useTranslation()
  const canEdit = isUser || Boolean(onSaveEdit)

  return (
    <View style={styles.actionsRow}>
      <MessageActionBar
        onCopy={onCopy}
        onEdit={canEdit ? onStartEdit : undefined}
        onRetry={isUser ? onResend : onRegenerate}
        onReadAloud={isAssistant && onReadAloud ? () => onReadAloud(message.content) : undefined}
        onBranch={isAssistant ? onBranch : undefined}
        onDelete={onDelete}
        isAI={isAssistant}
        isTtsPlaying={isTtsPlaying}
      />
      {isAssistant && hasContext && onShowContext && (
        <NativeIconButton
          name="account-tree"
          onPress={() => onShowContext(message)}
          accessibilityLabel={t('agent.chat.context_chain', '上下文链')}
        />
      )}
    </View>
  )
}

interface NativeChatBubbleEditActionsProps {
  colors: ThemeColors
  isUser: boolean
  isAssistant: boolean
  onCancel: () => void
  onResendEdit?: () => void
  onSaveEdit?: () => void
}

export const NativeChatBubbleEditActions: React.FC<NativeChatBubbleEditActionsProps> = ({
  colors,
  isUser,
  isAssistant,
  onCancel,
  onResendEdit,
  onSaveEdit
}) => {
  const { t } = useTranslation()

  return (
    <View style={styles.editActions}>
      <TouchableOpacity
        onPress={onCancel}
        style={[styles.editBtn, { borderColor: colors.borderSubtle }]}
      >
        <Text style={[styles.editBtnText, { color: colors.textSecondary }]}>
          {t('common.cancel', '取消')}
        </Text>
      </TouchableOpacity>
      {isUser && onResendEdit && (
        <TouchableOpacity
          onPress={onResendEdit}
          style={[styles.editBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.editBtnText, { color: colors.textOnPrimary }]}>
            {t('agent.chat.resend', '重新发送')}
          </Text>
        </TouchableOpacity>
      )}
      {isAssistant && onSaveEdit && (
        <TouchableOpacity
          onPress={onSaveEdit}
          style={[styles.editBtn, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.editBtnText, { color: colors.textOnPrimary }]}>
            {t('common.save', '保存')}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

export const NativeChatBubbleTokenRow: React.FC<{
  colors: ThemeColors
  message: ChatBubbleMessage
}> = ({ colors, message }) => {
  if (!message.inputTokens && !message.outputTokens) return null

  return (
    <View style={styles.tokenRow}>
      {message.inputTokens ? (
        <Text style={[styles.tokenText, { color: colors.textTertiary }]}>
          ↑{message.inputTokens}
        </Text>
      ) : null}
      {message.outputTokens ? (
        <Text style={[styles.tokenText, { color: colors.textTertiary }]}>
          ↓{message.outputTokens}
        </Text>
      ) : null}
      {message.costMicros ? (
        <Text style={[styles.tokenText, { color: colors.textTertiary }]}>
          ${(message.costMicros / 1_000_000).toFixed(4)}
        </Text>
      ) : null}
    </View>
  )
}
