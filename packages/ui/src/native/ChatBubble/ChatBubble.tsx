import React, { useCallback, useMemo, useState } from 'react'
import { View, Text } from 'react-native'
import { useTranslation } from 'react-i18next'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { useNativeTheme } from '../../native/theme'
import { NativeChatBubbleInlineEditor } from './NativeChatBubbleInlineEditor'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { AgentThinkSection } from '../AgentThinkSection'
import { NativeImagePreviewModal } from '../DiaryEditor/NativeImagePreviewModal'
import { ToolResultGroupCard } from '../ToolResultGroupCard/ToolResultGroupCard'
import { AgentProcessSection } from '../AgentProcessSection'
import {
  collectKnowledgeCitationsFromInvocations,
  decorateKnowledgeCitedTexts,
  composerExtraPlain,
  type AgentStreamTimelineItem,
  type MockChatAttachment
} from '@baishou/shared'
import { KnowledgeCitationBlock } from '../KnowledgeCitationBlock'
import { AssistantDisplayTimeline } from '../AssistantDisplayTimeline/AssistantDisplayTimeline'
import type { ChatBubbleProps } from './chat-bubble.types'
import { useNativeAssistantTimeline } from './useNativeAssistantTimeline'
import { chatBubbleStyles as styles } from './chat-bubble.styles'
import { nativeSkillCiteStyles } from './native-skill-cite.styles'
import { NativeChatBubbleAttachments } from './NativeChatBubbleAttachments'
import { NativeSkillCiteChip } from './NativeSkillCiteChip'
import { SkillCitePreviewDialog } from './SkillCitePreviewDialog'
import { useNativeChatBubbleEdit } from './useNativeChatBubbleEdit'
import {
  NativeChatBubbleActionsRow,
  NativeChatBubbleEditActions
} from './NativeChatBubbleActionsRow'
import { ChatBubbleAvatar } from './ChatBubbleAvatar'
import { formatRelativeTime } from '../../shared/chat-bubble/format-relative-time.util'
import {
  getChatBubbleOverBackgroundStyle,
  getChatOverBackgroundMetaTextStyle
} from '../../shared/chat-over-background-meta.style'
import { sharedTokens } from '../../theme/tokens'

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
  hasChatBackground = false,
  retryDisabled = false,
  showReasoning = true,
  liveStream,
  deferAssistantChrome = false,
  error = null
}) => {
  const { t } = useTranslation()
  const { colors, tokens, isDark } = useNativeTheme()
  const hasBackground = Boolean(hasChatBackground || invertMetaOverBackground)
  const metaTone = invertMetaOverBackground || (hasBackground ? 'dark' : false)
  const metaStyle = getChatOverBackgroundMetaTextStyle(metaTone)
  const displayError = error ?? liveStream?.error ?? null
  const [previewImageUri, setPreviewImageUri] = useState<string | null>(null)
  const handleImagePress = useCallback((_src: string, resolvedUri: string) => {
    setPreviewImageUri(resolvedUri)
  }, [])
  const [previewSkill, setPreviewSkill] = useState<{ command: string; content: string } | null>(
    null
  )
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'

  const sourceContent = liveStream?.content ?? message.content ?? ''
  const sourceReasoning = liveStream?.reasoning ?? message.reasoning ?? ''

  const liveTimeline = useMemo(() => liveStream?.timeline ?? [], [liveStream?.timeline])
  const liveGateParts = useMemo(() => liveStream?.gateParts ?? [], [liveStream?.gateParts])
  /** live 行流式覆盖：重生成时消息已落库，仍须走 stream 态（转圈 / 工具 / 正文） */
  const liveStreamOverlay = Boolean(
    liveStream &&
    (liveStream.isThinkLoading ||
      liveStream.isThinkStreaming ||
      liveStream.isTextStreaming ||
      liveStream.activeToolName ||
      (liveStream.completedTools?.length ?? 0) > 0 ||
      liveTimeline.length > 0)
  )
  const parseContent = liveStreamOverlay ? sourceContent : (message.content ?? '')
  const parseReasoning = liveStreamOverlay ? sourceReasoning : (message.reasoning ?? '')

  const { cleanContent, cleanReasoning } = useMemo(
    () => parseRedactedThinking(parseContent, parseReasoning),
    [parseContent, parseReasoning]
  )

  const markdownStreaming = Boolean(liveStream?.isTextStreaming)
  const thinkLoading = Boolean(liveStream?.isThinkLoading)
  const showThinkSection = isAssistant && showReasoning && (cleanReasoning || thinkLoading)
  const userCompanionText = useMemo(
    () =>
      isAssistant
        ? ''
        : composerExtraPlain(
            message.content || '',
            message.skillRefs ?? [],
            message.fileRefs ?? []
          ),
    [isAssistant, message.content, message.fileRefs, message.skillRefs]
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

  const toolInvocations = useMemo(
    () =>
      (message.toolInvocations || []) as Array<{
        toolCallId: string
        toolName: string
        result: unknown
      }>,
    [message.toolInvocations]
  )
  const knowledgeCitations = useMemo(() => {
    if (liveStreamOverlay && liveTimeline.length > 0) {
      return collectKnowledgeCitationsFromInvocations(
        liveTimeline
          .filter(
            (item): item is Extract<AgentStreamTimelineItem, { kind: 'tool' }> =>
              item.kind === 'tool'
          )
          .map((item) => ({ toolName: item.name, result: item.result }))
      )
    }
    return collectKnowledgeCitationsFromInvocations(toolInvocations)
  }, [liveStreamOverlay, liveTimeline, toolInvocations])
  const { items: timelineItems, useTimeline: hasTimelineItems } = useNativeAssistantTimeline({
    liveTimeline,
    gateParts: liveGateParts,
    parts: message.parts,
    preferLive: liveStreamOverlay
  })
  const useTimeline = isAssistant && hasTimelineItems && !edit.isEditing
  const citedContent = useMemo(() => {
    if (!isAssistant || knowledgeCitations.length === 0) return cleanContent
    return (
      decorateKnowledgeCitedTexts([cleanContent], knowledgeCitations.length, message.id || 'turn', {
        appendWhenMissing: true,
        citations: knowledgeCitations
      })[0] ?? cleanContent
    )
  }, [cleanContent, isAssistant, knowledgeCitations, message.id])
  const attachments = useMemo(() => {
    const persisted = (message.attachments || []) as MockChatAttachment[]
    if (persisted.length > 0) return persisted
    return (liveStream?.attachments || []) as MockChatAttachment[]
  }, [message.attachments, liveStream?.attachments])

  const streamingCompletedTools = liveStream?.completedTools ?? []
  const streamingActiveToolName = liveStream?.activeToolName ?? null
  const showStreamingTools =
    isAssistant &&
    liveStream &&
    (streamingCompletedTools.length > 0 || Boolean(streamingActiveToolName))
  const showPersistedTools = isAssistant && !showStreamingTools && toolInvocations.length > 0
  // 与 StreamingBubble 一致：助手气泡始终占满 maxWidth，避免流式→落盘时宽度跳变
  const useFullWidthAssistantBubble = isAssistant

  const nameLabelStyle = [
    styles.nameLabel,
    { color: colors.textSecondary },
    isUser ? styles.nameLabelUser : styles.nameLabelAssistant,
    metaStyle
  ]

  const timeLabelStyle = [styles.timeLabel, { color: colors.textTertiary }, metaStyle]

  return (
    <KnowledgeCitationBlock citations={knowledgeCitations} anchorKey={message.id || 'turn'}>
      <View style={[styles.container, isUser ? styles.containerUser : styles.containerAssistant]}>
        {isAssistant && aiProfile ? (
          <ChatBubbleAvatar
            variant="assistant"
            emoji={aiProfile.emoji}
            avatarPath={aiProfile.avatarPath}
            resolvedAvatarUri={aiProfile.resolvedAvatarUri}
            style={{ marginRight: sharedTokens.spacing.sm }}
          />
        ) : null}

        <View
          style={[
            styles.bubbleWrapper,
            isUser ? styles.bubbleWrapperUser : styles.bubbleWrapperAssistant,
            useFullWidthAssistantBubble ? styles.bubbleWrapperEditing : null
          ]}
        >
          {message.timestamp || displayName ? (
            <View
              collapsable={false}
              style={[
                styles.nameTimeRow,
                isUser ? styles.nameTimeRowUser : styles.nameTimeRowAssistant
              ]}
            >
              {isUser ? (
                <>
                  {message.timestamp ? (
                    <Text style={timeLabelStyle}>{formatRelativeTime(message.timestamp, t)}</Text>
                  ) : null}
                  <Text style={nameLabelStyle}>{displayName}</Text>
                </>
              ) : (
                <>
                  <Text style={nameLabelStyle}>{displayName}</Text>
                  {message.timestamp ? (
                    <Text style={timeLabelStyle}>{formatRelativeTime(message.timestamp, t)}</Text>
                  ) : null}
                </>
              )}
            </View>
          ) : null}

          <View
            collapsable={false}
            style={[
              styles.bubble,
              edit.isEditing || isAssistant ? styles.bubbleEditing : null,
              !edit.isEditing && isUser ? styles.bubbleUser : null,
              getChatBubbleOverBackgroundStyle(hasBackground, isDark, colors),
              isUser
                ? { borderBottomRightRadius: sharedTokens.radius.xs }
                : { borderBottomLeftRadius: sharedTokens.radius.xs }
            ]}
          >
            {useTimeline ? (
              <AssistantDisplayTimeline
                items={timelineItems}
                isStreaming={liveStreamOverlay && !displayError}
                isThinkLoading={thinkLoading && !displayError}
                isThinkStreaming={Boolean(liveStream?.isThinkStreaming) && !displayError}
                isTextStreaming={markdownStreaming && !displayError}
                error={displayError}
                knowledgeCitations={knowledgeCitations}
                citationAnchorKey={message.id || 'turn'}
                appendCitationMarkers={!liveStreamOverlay}
                onImagePress={handleImagePress}
              />
            ) : (
              <>
                {showThinkSection || showStreamingTools || showPersistedTools ? (
                  <View
                    style={{
                      marginBottom: cleanContent ? tokens.spacing.sm : 0,
                      alignSelf: 'stretch',
                      width: '100%'
                    }}
                  >
                    <AgentProcessSection
                      reasoningContent={showThinkSection ? cleanReasoning : undefined}
                      isReasoningLoading={thinkLoading}
                      isReasoningStreaming={Boolean(liveStream?.isThinkStreaming)}
                      invocations={toolInvocations}
                      streamingCompletedTools={streamingCompletedTools}
                      activeToolName={streamingActiveToolName}
                      isStreaming={Boolean(liveStreamOverlay && !displayError)}
                      hasAnswerText={Boolean(cleanContent)}
                    >
                      {showThinkSection ? (
                        <View
                          style={{
                            marginBottom:
                              showStreamingTools || showPersistedTools ? tokens.spacing.sm : 0,
                            alignSelf: 'stretch',
                            width: '100%'
                          }}
                        >
                          <AgentThinkSection
                            content={cleanReasoning}
                            isLoading={thinkLoading}
                            isMarkdownStreaming={Boolean(liveStream?.isThinkStreaming)}
                          />
                        </View>
                      ) : null}

                      {showStreamingTools ? (
                        <View
                          style={{
                            marginBottom: showPersistedTools ? tokens.spacing.sm : 0,
                            alignSelf: 'stretch',
                            width: '100%'
                          }}
                        >
                          <ToolResultGroupCard
                            completedTools={streamingCompletedTools}
                            activeToolName={streamingActiveToolName}
                          />
                        </View>
                      ) : null}

                      {showPersistedTools ? (
                        <View style={{ alignSelf: 'stretch', width: '100%' }}>
                          <ToolResultGroupCard invocations={toolInvocations} />
                        </View>
                      ) : null}
                    </AgentProcessSection>
                  </View>
                ) : null}
              </>
            )}

            {edit.isEditing ? (
              <View style={styles.editInputWrap}>
                <NativeChatBubbleInlineEditor
                  inputRef={edit.editInputRef}
                  value={edit.editContent}
                  onChangeText={edit.setEditContent}
                />
              </View>
            ) : (
              <View style={styles.bubblePressable}>
                {!isAssistant && attachments.length > 0 ? (
                  <NativeChatBubbleAttachments attachments={attachments} isUserBubble />
                ) : null}
                {isAssistant && cleanContent && !useTimeline ? (
                  <View style={styles.markdownSlot}>
                    <AgentMarkdownRenderer
                      content={citedContent}
                      variant="chat"
                      isStreaming={markdownStreaming}
                      onImagePress={handleImagePress}
                    />
                  </View>
                ) : !isAssistant &&
                  (message.content || message.skillRefs?.length || message.fileRefs?.length) ? (
                  <View>
                    {message.skillRefs?.length ? (
                      <View style={nativeSkillCiteStyles.row}>
                        {message.skillRefs.map((ref) => (
                          <NativeSkillCiteChip
                            key={ref.command}
                            command={ref.command}
                            onPress={() => setPreviewSkill(ref)}
                          />
                        ))}
                      </View>
                    ) : null}
                    {message.fileRefs?.length ? (
                      <View
                        style={{
                          flexDirection: 'row',
                          flexWrap: 'wrap',
                          gap: sharedTokens.spacing.xsPlus,
                          marginBottom: sharedTokens.spacing.xsPlus
                        }}
                      >
                        {message.fileRefs.map((ref) => (
                          <Text key={ref.relativePath} style={{ color: colors.textSecondary }}>
                            @{ref.relativePath}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                    {userCompanionText ? (
                      <Text style={[styles.text, { color: colors.textPrimary }]} selectable>
                        {userCompanionText}
                      </Text>
                    ) : null}
                  </View>
                ) : null}
                {isAssistant && attachments.length > 0 && !markdownStreaming ? (
                  <NativeChatBubbleAttachments
                    attachments={attachments}
                    display="sticker"
                    placement="after"
                  />
                ) : null}
              </View>
            )}
          </View>
          {isAssistant && displayError ? (
            <View
              style={{
                marginTop: tokens.spacing.sm,
                paddingHorizontal: tokens.spacing.md,
                paddingVertical: tokens.spacing.sm,
                backgroundColor: colors.errorContainer,
                borderRadius: tokens.radius.md,
                borderWidth: 1,
                borderColor: colors.error,
                alignSelf: 'stretch'
              }}
            >
              <Text style={{ color: colors.error }}>⚠ {displayError}</Text>
            </View>
          ) : null}

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
            <View
              collapsable={false}
              pointerEvents={isAssistant && deferAssistantChrome ? 'none' : 'auto'}
              style={isAssistant && deferAssistantChrome ? styles.deferredChromeHidden : null}
            >
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
                invertMetaOverBackground={metaTone}
                retryDisabled={retryDisabled}
              />
            </View>
          )}
        </View>

        {isUser ? (
          <ChatBubbleAvatar
            variant="user"
            nickname={userProfile?.nickname}
            avatarPath={userProfile?.avatarPath}
            resolvedAvatarUri={userProfile?.resolvedAvatarUri}
            style={{ marginLeft: sharedTokens.spacing.sm }}
          />
        ) : null}

        <NativeImagePreviewModal uri={previewImageUri} onClose={() => setPreviewImageUri(null)} />
        <SkillCitePreviewDialog
          visible={Boolean(previewSkill)}
          command={previewSkill?.command ?? ''}
          content={previewSkill?.content ?? ''}
          onClose={() => setPreviewSkill(null)}
        />
      </View>
    </KnowledgeCitationBlock>
  )
}
