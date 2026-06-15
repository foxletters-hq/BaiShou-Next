import React from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { MessageActionBar } from '../MessageActionBar/MessageActionBar'
import type { ChatBubbleMessage } from './chat-bubble.types'
import { chatBubbleStyles as styles } from './chat-bubble.styles'
import { formatCompactTokenCount, hasTokenUsageStats } from '../../shared/token-usage-display'

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
  colors,
  isUser,
  isAssistant,
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
  const canEdit = isUser || Boolean(onSaveEdit)

  return (
    <View style={styles.actionsRow}>
      <MessageActionBar
        onCopy={onCopy}
        onEdit={canEdit ? onStartEdit : undefined}
        onRetry={isUser ? onResend : onRegenerate}
        onReadAloud={isAssistant && onReadAloud ? () => onReadAloud(message.content) : undefined}
        onBranch={isAssistant ? onBranch : undefined}
        onShowContext={isAssistant && onShowContext ? () => onShowContext(message) : undefined}
        onDelete={onDelete}
        isAI={isAssistant}
        isTtsPlaying={isTtsPlaying}
      />
      {isAssistant ? <NativeChatBubbleTokenRow colors={colors} message={message} /> : null}
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
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={[styles.editBtn, { borderColor: colors.borderSubtle }]}
      >
        <Text style={[styles.editBtnText, { color: colors.textSecondary }]}>
          {t('common.cancel', '取消')}
        </Text>
      </TouchableOpacity>
      {isUser && onResendEdit && (
        <TouchableOpacity
          onPress={onResendEdit}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
  const { t } = useTranslation()
  const usage = {
    inputTokens: message.inputTokens,
    outputTokens: message.outputTokens,
    cacheReadInputTokens: message.cacheReadInputTokens,
    cacheWriteInputTokens: message.cacheWriteInputTokens,
    costMicros: message.costMicros
  }

  if (!hasTokenUsageStats(usage)) return null

  return (
    <View style={styles.tokenRow}>
      {message.inputTokens ? (
        <Text style={[styles.tokenText, { color: colors.textTertiary }]}>
          ↑{formatCompactTokenCount(message.inputTokens)}
        </Text>
      ) : null}
      {message.outputTokens ? (
        <Text style={[styles.tokenText, { color: colors.textTertiary }]}>
          ↓{formatCompactTokenCount(message.outputTokens)}
        </Text>
      ) : null}
      {message.costMicros ? (
        <Text style={[styles.tokenText, { color: colors.textTertiary }]}>
          ${(message.costMicros / 1_000_000).toFixed(4)}
        </Text>
      ) : null}
      {(message.cacheReadInputTokens ?? 0) > 0 ? (
        <Text
          style={[styles.tokenText, { color: colors.textTertiary }]}
          accessibilityLabel={t('agent.chat.cache_read', '缓存读取')}
        >
          {t('agent.chat.cache_label', '缓存：')}
          {formatCompactTokenCount(message.cacheReadInputTokens ?? 0)}
        </Text>
      ) : null}
      {(message.cacheWriteInputTokens ?? 0) > 0 ? (
        <Text
          style={[styles.tokenText, { color: colors.textTertiary }]}
          accessibilityLabel={t('agent.chat.cache_write', '缓存写入')}
        >
          {t('agent.chat.cache_label', '缓存：')}
          {formatCompactTokenCount(message.cacheWriteInputTokens ?? 0)}
        </Text>
      ) : null}
    </View>
  )
}
