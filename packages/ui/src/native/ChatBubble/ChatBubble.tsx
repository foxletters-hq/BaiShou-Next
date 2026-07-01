import React, { useMemo, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { useNativeTheme } from '../../native/theme'
import { NativeChatBubbleInlineEditor } from './NativeChatBubbleInlineEditor'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { AgentThinkSection } from '../AgentThinkSection'
import { NativeImagePreviewModal } from '../DiaryEditor/NativeImagePreviewModal'
import { ToolResultGroupCard } from '../ToolResultGroupCard/ToolResultGroupCard'
import type { MockChatAttachment } from '@baishou/shared'
import type { ChatBubbleProps } from './chat-bubble.types'
import { chatBubbleStyles as styles } from './chat-bubble.styles'
import { NativeChatBubbleAttachments } from './NativeChatBubbleAttachments'
import { useNativeChatBubbleEdit } from './useNativeChatBubbleEdit'
import {
  NativeChatBubbleActionsRow,
  NativeChatBubbleEditActions
} from './NativeChatBubbleActionsRow'
import { NativeChatBubbleActionSheet } from './NativeChatBubbleActionSheet'
import { ChatBubbleAvatar } from './ChatBubbleAvatar'
import { chatOverBackgroundMetaTextStyle } from '../../shared/chat-over-background-meta.style'

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
  onEditingChange,
  invertMetaOverBackground = false,
  retryDisabled = false,
  showReasoning = true,
  liveStream,
  deferAssistantChrome = false
}) => {
  const { t } = useTranslation()
  const { colors } = useNativeTheme()
  const [showActions, setShowActions] = useState(false)
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null)
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const sourceContent = liveStream?.content ?? message.content ?? ''
  const sourceReasoning = liveStream?.reasoning ?? message.reasoning ?? ''

  const { cleanContent, cleanReasoning } = useMemo(
    () => parseRedactedThinking(sourceContent, sourceReasoning),
    [sourceContent, sourceReasoning]
  )

  const markdownStreaming = Boolean(liveStream?.isTextStreaming)
  const thinkStreaming = Boolean(liveStream?.isThinkStreaming)

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
  const attachments = (message.attachments || []) as MockChatAttachment[]

  const streamingCompletedTools = liveStream?.completedTools ?? []
  const streamingActiveToolName = liveStream?.activeToolName ?? null
  const showStreamingTools =
    isAssistant &&
    liveStream &&
    (streamingCompletedTools.length > 0 || Boolean(streamingActiveToolName))
  const showPersistedTools = isAssistant && !showStreamingTools && toolInvocations.length > 0

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
            isUser ? styles.nameLabelUser : styles.nameLabelAssistant,
            invertMetaOverBackground ? chatOverBackgroundMetaTextStyle : null
          ]}
        >
          {displayName}
        </Text>

        <View
          collapsable={false}
          style={[
            styles.bubble,
            edit.isEditing ? styles.bubbleEditing : null,
            !edit.isEditing && isUser ? styles.bubbleUser : null,
            edit.isEditing
              ? isUser
                ? {
                    backgroundColor: colors.bgSurface,
                    borderBottomRightRadius: 4
                  }
                : {
                    backgroundColor: colors.bgSurface,
                    borderBottomLeftRadius: 4
                  }
              : isUser
                ? {
                    backgroundColor: colors.bgSurface,
                    borderBottomRightRadius: 4
                  }
                : {
                    backgroundColor: colors.bgSurface,
                    borderBottomLeftRadius: 4
                  }
          ]}
        >
          {isAssistant && showReasoning && cleanReasoning ? (
            <View
              style={{
                marginBottom: cleanContent || showStreamingTools || showPersistedTools ? 8 : 0,
                alignSelf: 'stretch',
                width: '100%'
              }}
            >
              <AgentThinkSection
                content={cleanReasoning}
                isStreaming={thinkStreaming}
                isMarkdownStreaming={thinkStreaming}
              />
            </View>
          ) : null}

          {showStreamingTools ? (
            <View style={{ marginBottom: cleanContent ? 8 : 0 }}>
              <ToolResultGroupCard
                completedTools={streamingCompletedTools}
                activeToolName={streamingActiveToolName}
                defaultExpanded
              />
            </View>
          ) : null}

          {showPersistedTools ? (
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
            <Pressable
              style={styles.bubblePressable}
              onLongPress={() => setShowActions(true)}
              delayLongPress={500}
            >
              {attachments.length > 0 ? (
                <NativeChatBubbleAttachments attachments={attachments} isUserBubble={isUser} />
              ) : null}
              {isAssistant && cleanContent ? (
                <View style={styles.markdownSlot}>
                  <AgentMarkdownRenderer
                    content={cleanContent}
                    variant="chat"
                    isStreaming={markdownStreaming}
                    onImagePress={(_src, resolvedUri) => setPreviewImageUri(resolvedUri)}
                  />
                </View>
              ) : !isAssistant && message.content ? (
                <Text style={[styles.text, { color: colors.textPrimary }]}>{message.content}</Text>
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
        ) : isAssistant && deferAssistantChrome ? (
          <View style={styles.deferredChromeSpacer} />
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
            invertMetaOverBackground={invertMetaOverBackground}
            retryDisabled={retryDisabled}
          />
        )}
      </View>

      {isUser ? (
        <ChatBubbleAvatar
          variant="user"
          nickname={userProfile?.nickname}
          avatarPath={userProfile?.avatarPath}
          resolvedAvatarUri={userProfile?.resolvedAvatarUri}
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

      <NativeImagePreviewModal uri={previewImageUri} onClose={() => setPreviewImageUri(null)} />
    </View>
  )
}
