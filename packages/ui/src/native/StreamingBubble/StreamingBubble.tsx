import React, { useMemo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { useNativeTheme } from '../theme'
import { ThinkingBlock } from '../ThinkingBlock/ThinkingBlock'
import type { NativeStreamingBubbleProps } from './streaming-bubble.types'
import { createStreamingBubbleStyles } from './streaming-bubble.styles'
import { ChatBubbleAvatar } from '../ChatBubble/ChatBubbleAvatar'
import { chatBubbleStyles } from '../ChatBubble/chat-bubble.styles'
import { chatOverBackgroundMetaTextStyle } from '../../shared/chat-over-background-meta.style'
import { ToolResultGroupCard } from '../ToolResultGroupCard/ToolResultGroupCard'
import { StreamingBubbleBouncingDots } from './StreamingBubbleBouncingDots'
import { AgentMarkdownRenderer } from '../AgentMarkdown'

export type { ToolExecution, NativeStreamingBubbleProps } from './streaming-bubble.types'

export const StreamingBubble: React.FC<NativeStreamingBubbleProps> = ({
  text,
  reasoning = '',
  isReasoning = false,
  isTextStreaming = true,
  activeToolName = null,
  completedTools = [],
  aiProfile = { name: 'AI' },
  error = null,
  onRetry,
  invertMetaOverBackground = false,
  reserveActionBarSpace = false
}) => {
  const { t } = useTranslation()
  const { colors, isDark, tokens } = useNativeTheme()
  const auxStyles = useMemo(() => createStreamingBubbleStyles(colors, tokens), [colors, tokens])

  const aiName = aiProfile.name || t('agent.chat.ai_label', 'AI')

  const { cleanContent: cleanText, cleanReasoning } = useMemo(
    () => parseRedactedThinking(text, reasoning),
    [text, reasoning]
  )

  const hasReasoning = cleanReasoning.length > 0
  const hasText = cleanText.length > 0
  const hasTools = completedTools.length > 0 || !!activeToolName

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
        ) : hasText || hasReasoning || hasTools ? (
          <View
            style={[
              chatBubbleStyles.bubble,
              chatBubbleStyles.bubbleEditing,
              {
                backgroundColor: isDark ? 'rgba(30, 30, 34, 0.4)' : 'rgba(255, 255, 255, 0.48)',
                borderBottomLeftRadius: 4
              }
            ]}
          >
            {hasReasoning && (
              <View
                style={{
                  marginBottom: hasText || hasTools ? 8 : 0,
                  alignSelf: 'stretch',
                  width: '100%'
                }}
              >
                <ThinkingBlock
                  content={cleanReasoning}
                  isThinking={isReasoning}
                  defaultOpen={false}
                  autoCollapse
                  maxPreviewLines={2}
                />
              </View>
            )}

            {hasTools ? (
              <View style={{ marginBottom: hasText ? 8 : 0, alignSelf: 'stretch', width: '100%' }}>
                <ToolResultGroupCard
                  invocations={completedTools.map((tool, idx) => ({
                    toolCallId: tool.toolCallId ?? `streaming-${tool.name}-${idx}`,
                    toolName: tool.name,
                    result: tool.result ?? null
                  }))}
                  activeToolName={activeToolName}
                  defaultExpanded
                />
              </View>
            ) : null}

            {hasText && (
              <AgentMarkdownRenderer
                content={cleanText}
                isStreaming={isTextStreaming}
                variant="chat"
              />
            )}
            {reserveActionBarSpace ? <View style={auxStyles.actionBarSpacer} /> : null}
          </View>
        ) : (
          <View style={auxStyles.dotsWrap}>
            <StreamingBubbleBouncingDots />
          </View>
        )}
      </View>
    </View>
  )
}
