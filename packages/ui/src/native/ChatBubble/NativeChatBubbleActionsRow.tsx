import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
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
  onEdit?: () => void
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
  colors,
  isUser,
  isAssistant,
  hasContext,
  message,
  isTtsPlaying,
  onEdit,
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

  return (
    <View style={styles.actionsRow}>
      {isUser && onResend && (
        <TouchableOpacity onPress={onResend} style={styles.actionChip}>
          <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>
            🔄 {t('agent.chat.resend', '重发')}
          </Text>
        </TouchableOpacity>
      )}
      {isUser && onEdit && (
        <TouchableOpacity onPress={onStartEdit} style={styles.actionChip}>
          <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>
            ✏️ {t('common.edit', '编辑')}
          </Text>
        </TouchableOpacity>
      )}
      {isAssistant && onReadAloud && (
        <TouchableOpacity onPress={() => onReadAloud(message.content)} style={styles.actionChip}>
          <Text
            style={[
              styles.actionChipText,
              { color: isTtsPlaying ? colors.primary : colors.textTertiary }
            ]}
          >
            {isTtsPlaying ? '🔊' : '🔈'} {t('agent.chat.read_aloud', '朗读')}
          </Text>
        </TouchableOpacity>
      )}
      {isAssistant && hasContext && onShowContext && (
        <TouchableOpacity onPress={() => onShowContext(message)} style={styles.actionChip}>
          <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>
            🌿 {t('agent.chat.context_chain', '上下文')}
          </Text>
        </TouchableOpacity>
      )}
      {isAssistant && onRegenerate && (
        <TouchableOpacity onPress={onRegenerate} style={styles.actionChip}>
          <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>
            🔄 {t('agent.chat.regenerate', '重新生成')}
          </Text>
        </TouchableOpacity>
      )}
      {isAssistant && onBranch && (
        <TouchableOpacity onPress={onBranch} style={styles.actionChip}>
          <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>
            🔀 {t('agent.chat.branch', '分支')}
          </Text>
        </TouchableOpacity>
      )}
      {isAssistant && onSaveEdit && (
        <TouchableOpacity onPress={onStartEdit} style={styles.actionChip}>
          <Text style={[styles.actionChipText, { color: colors.textTertiary }]}>
            ✏️ {t('common.edit', '编辑')}
          </Text>
        </TouchableOpacity>
      )}
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={styles.actionChip}>
          <Text style={[styles.actionChipText, { color: colors.error }]}>
            🗑️ {t('common.delete', '删除')}
          </Text>
        </TouchableOpacity>
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
