import React, { useMemo, useState } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { useNativeTheme } from '../../native/theme'
import { Input } from '../Input/Input'
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer'
import { ThinkingBlock } from '../ThinkingBlock/ThinkingBlock'
import { ToolResultGroupCard } from '../ToolResultGroupCard/ToolResultGroupCard'
import type { ChatBubbleProps } from './chat-bubble.types'
import { chatBubbleStyles as styles } from './chat-bubble.styles'
import { useNativeChatBubbleEdit } from './useNativeChatBubbleEdit'
import {
  NativeChatBubbleActionsRow,
  NativeChatBubbleEditActions,
  NativeChatBubbleTokenRow
} from './NativeChatBubbleActionsRow'
import { NativeChatBubbleActionSheet } from './NativeChatBubbleActionSheet'
import { ChatBubbleAvatar } from './ChatBubbleAvatar'

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  message,
  userProfile,
  aiProfile,
  onRegenerate,
  onResend,
  onCopy,
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
  const displayName = isUser
    ? userProfile?.nickname || t('agent.chat.you_label', '你')
    : aiProfile?.name || t('agent.chat.ai_label', 'AI')

  const { cleanContent, cleanReasoning } = useMemo(
    () => parseRedactedThinking(message.content || '', message.reasoning || ''),
    [message.content, message.reasoning]
  )

  const toolInvocations = (message.toolInvocations || []) as Array<{
    toolCallId: string
    toolName: string
    result: unknown
  }>

  return (
    <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
      {isAssistant && aiProfile ? (
        <ChatBubbleAvatar
          variant="assistant"
          emoji={aiProfile.emoji}
          avatarPath={aiProfile.avatarPath}
          style={{ marginRight: 8 }}
        />
      ) : null}

      <View style={[styles.bubbleWrapper, isUser && styles.bubbleWrapperUser]}>
        <Text
          style={[
            styles.nameLabel,
            { color: colors.textSecondary },
            isUser ? styles.nameLabelUser : styles.nameLabelAssistant
          ]}
        >
          {displayName}
        </Text>

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
            {isAssistant && cleanReasoning ? (
              <View style={{ marginBottom: cleanContent || toolInvocations.length ? 8 : 0 }}>
                <ThinkingBlock
                  content={cleanReasoning}
                  isThinking={false}
                  defaultOpen={false}
                  autoCollapse
                />
              </View>
            ) : null}

            {isAssistant && toolInvocations.length > 0 ? (
              <View style={{ marginBottom: cleanContent ? 8 : 0 }}>
                <ToolResultGroupCard invocations={toolInvocations} />
              </View>
            ) : null}

            {edit.isEditing ? (
              <Input
                ref={edit.editInputRef}
                style={[
                  styles.editInput,
                  { color: isUser ? colors.textOnPrimary : colors.textPrimary }
                ]}
                value={edit.editContent}
                onChangeText={edit.setEditContent}
                multiline
                autoFocus
              />
            ) : isAssistant && cleanContent ? (
              <MarkdownRenderer content={cleanContent} variant="chat" />
            ) : !isAssistant ? (
              <Text
                style={[styles.text, { color: isUser ? colors.textOnPrimary : colors.textPrimary }]}
              >
                {message.content}
              </Text>
            ) : null}
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
            message={message}
            isTtsPlaying={Boolean(isTtsPlaying)}
            onCopy={onCopy ?? (() => {})}
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

      {isUser ? (
        <ChatBubbleAvatar
          variant="user"
          nickname={userProfile?.nickname}
          avatarPath={userProfile?.avatarPath}
          style={{ marginLeft: 8 }}
        />
      ) : null}

      <NativeChatBubbleActionSheet
        visible={showActions}
        isUser={isUser}
        isAssistant={isAssistant}
        message={message}
        onClose={() => setShowActions(false)}
        onStartEdit={() => {
          edit.handleStartEdit()
          setShowActions(false)
        }}
        onCopy={onCopy}
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
