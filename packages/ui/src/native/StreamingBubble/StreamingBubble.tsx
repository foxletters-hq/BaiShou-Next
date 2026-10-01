import React, { useMemo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  assistantStreamTimelineSignature,
  collectKnowledgeCitationsFromInvocations,
  groupStreamTimelineForDisplay,
  type AgentStreamTimelineItem
} from '@baishou/shared'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { useNativeTheme } from '../theme'
import { AgentThinkSection } from '../AgentThinkSection'
import type { NativeStreamingBubbleProps } from './streaming-bubble.types'
import { createStreamingBubbleStyles } from './streaming-bubble.styles'
import { ChatBubbleAvatar } from '../ChatBubble/ChatBubbleAvatar'
import { chatBubbleStyles } from '../ChatBubble/chat-bubble.styles'
import { chatOverBackgroundMetaTextStyle } from '../../shared/chat-over-background-meta.style'
import { ToolResultGroupCard } from '../ToolResultGroupCard/ToolResultGroupCard'
import { StreamingBubbleBouncingDots } from './StreamingBubbleBouncingDots'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import { NativeChatBubbleAttachments } from '../ChatBubble/NativeChatBubbleAttachments'
import { KnowledgeCitationBlock } from '../KnowledgeCitationBlock'
import { AssistantDisplayTimeline } from '../AssistantDisplayTimeline/AssistantDisplayTimeline'

export type { ToolExecution, NativeStreamingBubbleProps } from './streaming-bubble.types'

export const StreamingBubble = React.memo(function StreamingBubble({
  text,
  reasoning = '',
  isReasoning = false,
  isThinkStreaming = false,
  isTextStreaming = true,
  activeToolName = null,
  completedTools = [],
  timeline,
  gateParts = [],
  aiProfile = { name: 'AI' },
  error = null,
  onRetry,
  invertMetaOverBackground = false,
  reserveActionBarSpace = false,
  attachments = []
}: NativeStreamingBubbleProps) {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const auxStyles = useMemo(() => createStreamingBubbleStyles(colors, tokens), [colors, tokens])

  const aiName = aiProfile.name || t('agent.chat.ai_label', 'AI')
  const liveTimeline = timeline ?? []
  const timelineKey = assistantStreamTimelineSignature(liveTimeline)
  const timelineItems = useMemo(
    () => groupStreamTimelineForDisplay(liveTimeline, gateParts),
    // 用内容签名代替 timeline 引用，避免父组件每次传入新数组打穿分组
    // eslint-disable-next-line react-hooks/exhaustive-deps -- timelineKey 已覆盖内容
    [gateParts, timelineKey]
  )
  const useTimeline = timelineItems.length > 0
  const knowledgeCitations = collectKnowledgeCitationsFromInvocations(
    liveTimeline
      .filter(
        (item): item is Extract<AgentStreamTimelineItem, { kind: 'tool' }> => item.kind === 'tool'
      )
      .map((item) => ({ toolName: item.name, result: item.result }))
  )

  const { cleanContent: cleanText, cleanReasoning } = useMemo(
    () => parseRedactedThinking(text, reasoning),
    [text, reasoning]
  )

  const hasReasoning = cleanReasoning.length > 0 || isReasoning || isThinkStreaming
  const hasText = cleanText.length > 0
  const hasTools = completedTools.length > 0 || !!activeToolName
  const hasAttachments = attachments.length > 0
  const showStickerAttachments = hasAttachments && !isTextStreaming
  const hasBody = useTimeline || hasText || hasReasoning || hasTools || showStickerAttachments

  return (
    <View style={[chatBubbleStyles.container, chatBubbleStyles.containerAssistant]}>
      <ChatBubbleAvatar
        variant="assistant"
        emoji={aiProfile.emoji}
        avatarPath={aiProfile.avatarPath}
        resolvedAvatarUri={aiProfile.resolvedAvatarUri}
        style={{ marginRight: 8 }}
      />

      <View
        style={[
          chatBubbleStyles.bubbleWrapper,
          chatBubbleStyles.bubbleWrapperAssistant,
          chatBubbleStyles.bubbleWrapperEditing
        ]}
      >
        {hasBody ? (
          <>
            <View style={[chatBubbleStyles.nameTimeRow, chatBubbleStyles.nameTimeRowAssistant]}>
              <Text
                style={[
                  chatBubbleStyles.nameLabel,
                  chatBubbleStyles.nameLabelAssistant,
                  { color: colors.textSecondary },
                  invertMetaOverBackground ? chatOverBackgroundMetaTextStyle : null
                ]}
              >
                {aiName}
              </Text>
            </View>
            <View
              collapsable={false}
              style={[
                chatBubbleStyles.bubble,
                chatBubbleStyles.bubbleEditing,
                {
                  backgroundColor: colors.bgSurface,
                  borderBottomLeftRadius: 4
                }
              ]}
            >
              <KnowledgeCitationBlock citations={knowledgeCitations} anchorKey="streaming">
                {useTimeline ? (
                  <AssistantDisplayTimeline
                    items={timelineItems}
                    isStreaming={!error}
                    isThinkStreaming={(isThinkStreaming || isReasoning) && !error}
                    isTextStreaming={isTextStreaming && !error}
                    error={error}
                    knowledgeCitations={knowledgeCitations}
                    citationAnchorKey="streaming"
                  />
                ) : (
                  <>
                    {hasReasoning && (
                      <View
                        style={{
                          marginBottom: hasText || hasTools ? tokens.spacing.sm : 0,
                          alignSelf: 'stretch',
                          width: '100%'
                        }}
                      >
                        <AgentThinkSection
                          content={cleanReasoning}
                          isLoading={isReasoning || isThinkStreaming}
                          isMarkdownStreaming={isThinkStreaming || isReasoning}
                        />
                      </View>
                    )}

                    {hasTools ? (
                      <View
                        style={{
                          marginBottom: hasText ? tokens.spacing.sm : 0,
                          alignSelf: 'stretch',
                          width: '100%'
                        }}
                      >
                        <ToolResultGroupCard
                          completedTools={completedTools.map((tool, idx) => ({
                            name: tool.name,
                            durationMs: tool.durationMs ?? 0,
                            toolCallId: tool.toolCallId ?? `streaming-${tool.name}-${idx}`,
                            startTime: tool.toolCallId ?? idx,
                            result: tool.result,
                            args: tool.args
                          }))}
                          activeToolName={error ? null : activeToolName}
                        />
                      </View>
                    ) : null}

                    {hasText && (
                      <View style={chatBubbleStyles.markdownSlot}>
                        <AgentMarkdownRenderer
                          content={cleanText}
                          isStreaming={isTextStreaming && !error}
                          variant="chat"
                        />
                      </View>
                    )}
                  </>
                )}
                {showStickerAttachments ? (
                  <NativeChatBubbleAttachments
                    attachments={attachments}
                    display="sticker"
                    placement="after"
                  />
                ) : null}
              </KnowledgeCitationBlock>
              {reserveActionBarSpace ? <View style={auxStyles.actionBarSpacer} /> : null}
            </View>
          </>
        ) : error ? null : (
          <View style={auxStyles.dotsWrap}>
            <StreamingBubbleBouncingDots />
          </View>
        )}
        {error ? (
          <View style={auxStyles.errorBox}>
            <Text style={auxStyles.errorText}>⚠ {error}</Text>
            {onRetry && (
              <Pressable
                onPress={onRetry}
                style={({ pressed }) => ({
                  opacity: pressed ? 0.7 : 1,
                  backgroundColor: colors.error,
                  borderRadius: tokens.radius.full,
                  paddingHorizontal: tokens.spacing.md,
                  paddingVertical: tokens.spacing.xs,
                  alignSelf: 'flex-start'
                })}
              >
                <Text style={{ fontSize: 14, color: colors.onError, fontWeight: '600' }}>
                  {t('common.retry', '重试')}
                </Text>
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </View>
  )
})
