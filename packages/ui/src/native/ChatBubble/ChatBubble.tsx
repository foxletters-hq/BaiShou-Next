import React, { useState } from 'react'
import { View, Text, TouchableOpacity, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../../native/theme'
import type { ChatBubbleProps } from './chat-bubble.types'
import { chatBubbleStyles as styles } from './chat-bubble.styles'
import { useNativeChatBubbleEdit } from './useNativeChatBubbleEdit'
import {
  NativeChatBubbleActionsRow,
  NativeChatBubbleEditActions,
  NativeChatBubbleTokenRow
} from './NativeChatBubbleActionsRow'
import { NativeChatBubbleActionSheet } from './NativeChatBubbleActionSheet'

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  aiProfile,
  onEdit,
  onRegenerate,
  onResend,
  onDelete,
  onBranch,
  onSaveEdit,
  onResendEdit,
  onShowContext,
  onReadAloud,
  isTtsPlaying
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [showActions, setShowActions] = useState(false)
  const edit = useNativeChatBubbleEdit(message.content, onSaveEdit, onResendEdit)

  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const hasContext = Boolean(message.contextMessages?.length)

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
      {isAssistant && aiProfile && (
        <View style={[styles.avatar, { backgroundColor: colors.bgSurfaceHighest }]}>
          <Text style={styles.avatarText}>{aiProfile.emoji || '🤖'}</Text>
        </View>
      )}

      <View style={styles.bubbleWrapper}>
        <TouchableOpacity
          onLongPress={() => setShowActions(true)}
          delayLongPress={500}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.bubble,
              isUser
                ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                : { backgroundColor: colors.bgSurface, borderBottomLeftRadius: 4 }
            ]}
          >
            {isAssistant && message.isReasoning && message.reasoning && (
              <View style={[styles.reasoningBlock, { borderColor: colors.borderSubtle }]}>
                <Text style={[styles.reasoningLabel, { color: colors.textTertiary }]}>
                  {t('agent.chat.reasoning', '思考中...')}
                </Text>
                <Text style={[styles.reasoningText, { color: colors.textSecondary }]}>
                  {message.reasoning}
                </Text>
              </View>
            )}

            {edit.isEditing ? (
              <TextInput
                ref={edit.editInputRef}
                style={[
                  styles.editInput,
                  { color: isUser ? colors.textOnPrimary : colors.textPrimary }
                ]}
                value={edit.editContent}
                onChangeText={edit.setEditContent}
                multiline
                autoFocus
                textAlignVertical="top"
              />
            ) : (
              <Text
                style={[styles.text, { color: isUser ? colors.textOnPrimary : colors.textPrimary }]}
              >
                {message.content}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {edit.isEditing ? (
          <NativeChatBubbleEditActions
            colors={colors}
            isUser={isUser}
            isAssistant={isAssistant}
            onCancel={edit.handleCancelEdit}
            onResendEdit={onResendEdit ? edit.handleResendEdit : undefined}
            onSaveEdit={onSaveEdit ? edit.handleSaveEdit : undefined}
          />
        ) : (
          <NativeChatBubbleActionsRow
            colors={colors}
            isUser={isUser}
            isAssistant={isAssistant}
            hasContext={hasContext}
            message={message}
            isTtsPlaying={Boolean(isTtsPlaying)}
            onEdit={onEdit}
            onStartEdit={edit.handleStartEdit}
            onResend={onResend}
            onReadAloud={onReadAloud}
            onShowContext={onShowContext}
            onRegenerate={onRegenerate}
            onBranch={onBranch}
            onSaveEdit={onSaveEdit}
            onDelete={onDelete}
          />
        )}

        {isAssistant && <NativeChatBubbleTokenRow colors={colors} message={message} />}
      </View>

      <NativeChatBubbleActionSheet
        visible={showActions}
        colors={colors}
        isUser={isUser}
        isAssistant={isAssistant}
        hasContext={hasContext}
        message={message}
        onClose={() => setShowActions(false)}
        onStartEdit={() => {
          edit.handleStartEdit()
          setShowActions(false)
        }}
        onResend={onResend}
        onReadAloud={onReadAloud}
        onShowContext={onShowContext}
        onRegenerate={onRegenerate}
        onBranch={onBranch}
        onDelete={onDelete}
      />
    </View>
  )
}
