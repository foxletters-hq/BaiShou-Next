import React, { useMemo } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNativeTheme } from '../theme'
import { MarkdownRenderer } from '../MarkdownRenderer'
import type { NativeStreamingBubbleProps } from './streaming-bubble.types'
import { createStreamingBubbleStyles } from './streaming-bubble.styles'
import { StreamingBubbleAvatar } from './StreamingBubbleAvatar'
import { StreamingBubbleToolExecution } from './StreamingBubbleToolExecution'

export type { ToolExecution, NativeStreamingBubbleProps } from './streaming-bubble.types'

export const StreamingBubble: React.FC<NativeStreamingBubbleProps> = ({
  text,
  reasoning = '',
  isReasoning = false,
  activeToolName = null,
  completedTools = [],
  aiProfile = { name: 'AI' },
  error = null,
  onRetry,
  onStop
}) => {
  const { t } = useTranslation()
  const { colors, tokens } = useNativeTheme()
  const styles = useMemo(() => createStreamingBubbleStyles(colors, tokens), [colors, tokens])

  const aiName = aiProfile.name || t('agent.chat.ai_label', 'AI')
  const hasReasoning = reasoning.length > 0
  const hasText = text.length > 0
  const hasTools = completedTools.length > 0 || !!activeToolName

  const renderBouncingDots = () => (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.dot} />
      ))}
    </View>
  )

  return (
    <View style={styles.row}>
      <StreamingBubbleAvatar emoji={aiProfile.emoji} styles={styles} />

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
        ) : (
          <>
            {hasText || hasReasoning || hasTools ? (
              <View style={styles.bubble}>
                {hasReasoning && (
                  <View style={styles.reasoningBox}>
                    <Text style={styles.reasoningTitle}>
                      {isReasoning
                        ? t('agent.chat.thinking', '💭 思考中...')
                        : t('agent.chat.thought_process_prefix', '💭 思考过程')}
                    </Text>
                    <Text style={styles.reasoningText}>{reasoning}</Text>
                  </View>
                )}

                <StreamingBubbleToolExecution
                  completedTools={completedTools}
                  activeToolName={activeToolName}
                  colors={colors}
                  tokens={tokens}
                />

                {hasText && <MarkdownRenderer content={text} />}
              </View>
            ) : (
              renderBouncingDots()
            )}

            {onStop && (
              <View style={{ marginTop: tokens.spacing.sm, alignItems: 'center' }}>
                <Pressable
                  onPress={onStop}
                  style={({ pressed }) => ({
                    opacity: pressed ? 0.7 : 1,
                    backgroundColor: colors.errorContainer,
                    borderRadius: tokens.radius.full,
                    paddingHorizontal: tokens.spacing.md,
                    paddingVertical: tokens.spacing.sm,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: tokens.spacing.xs
                  })}
                >
                  <Text style={{ fontSize: 16 }}>🛑</Text>
                  <Text
                    style={{
                      fontSize: 14,
                      color: colors.onErrorContainer,
                      fontWeight: '600'
                    }}
                  >
                    {t('common.stop_generate', '停止生成')}
                  </Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  )
}
