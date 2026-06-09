import React, { useMemo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { useNativeTheme } from '../theme'
import { MarkdownRenderer } from '../MarkdownRenderer/MarkdownRenderer'
import { ThinkingBlock } from '../ThinkingBlock/ThinkingBlock'
import type { NativeStreamingBubbleProps } from './streaming-bubble.types'
import { createStreamingBubbleStyles } from './streaming-bubble.styles'
import { StreamingBubbleAvatar } from './StreamingBubbleAvatar'
import { StreamingBubbleToolExecution } from './StreamingBubbleToolExecution'
import { StreamingBubbleBouncingDots } from './StreamingBubbleBouncingDots'

export type { ToolExecution, NativeStreamingBubbleProps } from './streaming-bubble.types'

export const StreamingBubble: React.FC<NativeStreamingBubbleProps> = ({
  text,
  reasoning = '',
  isReasoning = false,
  activeToolName = null,
  completedTools = [],
  aiProfile = { name: 'AI' },
  error = null,
  onRetry
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const styles = useMemo(() => createStreamingBubbleStyles(colors, tokens), [colors, tokens])

  const aiName = aiProfile.name || t('agent.chat.ai_label', 'AI')

  const { cleanContent: cleanText, cleanReasoning } = useMemo(
    () => parseRedactedThinking(text, reasoning),
    [text, reasoning]
  )

  const hasReasoning = cleanReasoning.length > 0
  const hasText = cleanText.length > 0
  const hasTools = completedTools.length > 0 || !!activeToolName

  return (
    <View style={styles.row}>
      <StreamingBubbleAvatar
        emoji={aiProfile.emoji}
        avatarPath={aiProfile.avatarPath}
        resolvedAvatarUri={aiProfile.resolvedAvatarUri}
        styles={styles}
      />

      <View style={styles.content}>
        <Text style={styles.aiName}>{aiName}</Text>

        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>⚠ {error}</Text>
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
          <View style={styles.bubbleCard}>
            {hasReasoning && (
              <ThinkingBlock
                content={cleanReasoning}
                isThinking={isReasoning && !hasText}
                defaultOpen
                autoCollapse={false}
              />
            )}

            <StreamingBubbleToolExecution
              completedTools={completedTools}
              activeToolName={activeToolName}
            />

            {hasText && <MarkdownRenderer content={cleanText} variant="chat" />}
          </View>
        ) : (
          <View style={styles.dotsWrap}>
            <StreamingBubbleBouncingDots />
          </View>
        )}
      </View>
    </View>
  )
}
