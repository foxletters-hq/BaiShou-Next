import React from 'react'
import { View, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ThinkingBlock } from '../ThinkingBlock'

export interface NativeCompressionActivityBarProps {
  phase?: 'auto' | 'manual'
  summary?: string
  reasoning?: string
  /** @deprecated 使用 summary */
  content?: string
  isActive?: boolean
  thoughtDurationMs?: number
  summaryDurationMs?: number
}

/** 对齐 web CompressionActivityBar：压缩思考 + 摘要两段流式展示 */
export const CompressionActivityBar: React.FC<NativeCompressionActivityBarProps> = ({
  phase = 'auto',
  summary = '',
  reasoning = '',
  content = '',
  isActive = true,
  thoughtDurationMs,
  summaryDurationMs
}) => {
  const { t } = useTranslation()

  const summaryText = summary || content
  const reasoningText = reasoning

  const hasReasoning = Boolean(reasoningText.trim())
  const hasSummary = Boolean(summaryText.trim())
  const summaryStreaming = isActive && hasSummary
  const reasoningStreaming = isActive && hasReasoning && !hasSummary

  const activeStatusLabel =
    phase === 'manual'
      ? t('agent.chat.recompress_running', '压缩中…')
      : t('agent.chat.compressing_context', '正在压缩对话…')

  if (!isActive && !hasReasoning && !hasSummary) {
    return null
  }

  return (
    <View style={styles.wrap} accessibilityLiveRegion={isActive ? 'polite' : 'none'}>
      {(hasReasoning || reasoningStreaming) && (
        <ThinkingBlock
          content={reasoningText}
          isThinking={reasoningStreaming}
          forceVisible={reasoningStreaming}
          headerIcon="✨"
          activeStatusLabel={t('agent.chat.compression_thinking', '压缩思考中…')}
          completedStatusLabel={t('agent.chat.compression_thought_time', '总结思考耗时 {{time}}', {
            time: '{{time}}'
          })}
          thinkingTimeMs={thoughtDurationMs}
          defaultOpen={false}
          autoCollapse
        />
      )}

      {(hasSummary || isActive) && (
        <ThinkingBlock
          content={summaryText}
          isThinking={summaryStreaming}
          forceVisible={isActive && !hasSummary}
          headerIcon="💕"
          activeStatusLabel={activeStatusLabel}
          completedStatusLabel={t('agent.chat.compression_summary_time', '生成摘要耗时 {{time}}', {
            time: '{{time}}'
          })}
          thinkingTimeMs={summaryDurationMs}
          defaultOpen={false}
          autoCollapse={isActive}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 12
  }
})
