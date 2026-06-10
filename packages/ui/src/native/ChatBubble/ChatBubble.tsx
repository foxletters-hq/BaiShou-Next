import React, { useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { useNativeTheme } from '../../native/theme'
import { NativeChatBubbleInlineEditor } from './NativeChatBubbleInlineEditor'
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
  isTtsPlaying,
  onEditingChange
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [showActions, setShowActions] = useState(false)
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const { cleanContent, cleanReasoning } = useMemo(
    () => parseRedactedThinking(message.content || '', message.reasoning || ''),
    [message.content, message.reasoning]
  )

  const editableContent = isAssistant
    ? cleanContent || message.content || ''
    : message.content || ''
  const edit = useNativeChatBubbleEdit(
    editableContent,
    message.id,
    onSaveEdit,
    onResendEdit,
    onEditingChange
  )
  const displayName = isUser
    ? userProfile?.nickname || t('agent.chat.you_label', '你')
    : aiProfile?.name || t('agent.chat.ai_label', 'AI')

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
          resolvedAvatarUri={aiProfile.resolvedAvatarUri}
          style={{ marginRight: 8 }}
        />
      ) : null}

      <View
        style={[
          styles.bubbleWrapper,
          isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant,
          edit.isEditing ? styles.bubbleWrapperEditing : null
        ]}
      >
        <Text
          style={[
            styles.nameLabel,
            { color: colors.textSecondary },
            isUser ? styles.nameLabelUser : styles.nameLabelAssistant
          ]}
        >
          {displayName}
        </Text>

        <View
          style={[
            styles.bubble,
            edit.isEditing ? styles.bubbleEditing : null,
            edit.isEditing
              ? isUser
                ? { backgroundColor: colors.bgSurface, borderBottomRightRadius: 4 }
                : { backgroundColor: colors.bgSurface, borderBottomLeftRadius: 4 }
              : isUser
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
            <View style={styles.editInputWrap}>
              <NativeChatBubbleInlineEditor
                inputRef={edit.editInputRef}
                value={edit.editContent}
                onChangeText={edit.setEditContent}
              />
            </View>
          ) : (
            <Pressable onLongPress={() => setShowActions(true)} delayLongPress={500}>
              {isAssistant && cleanContent ? (
                <MarkdownRenderer content={cleanContent} variant="chat" />
              ) : !isAssistant ? (
                <Text
                  style={[
                    styles.text,
                    { color: isUser ? colors.textOnPrimary : colors.textPrimary }
                  ]}
                >
                  {message.content}
                </Text>
              ) : null}
            </Pressable>
          )}
        </View>

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
