import React from 'react'
import { useTranslation } from 'react-i18next'
import { ThinkingBlock } from '../ThinkingBlock'
import styles from './CompressionActivityBar.module.css'

export interface CompressionActivityBarProps {
  /** manual = 用户触发的重新压缩 */
  phase?: 'auto' | 'manual'
  embedded?: boolean
  /** 压缩摘要正文（不含思考） */
  summary?: string
  /** 压缩模型思考过程 */
  reasoning?: string
  /** @deprecated 使用 summary */
  content?: string
  isActive?: boolean
  thoughtDurationMs?: number
  summaryDurationMs?: number
}

export const CompressionActivityBar: React.FC<CompressionActivityBarProps> = ({
  phase = 'auto',
  embedded = false,
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

  const completedStatusLabel =
    phase === 'manual'
      ? t('agent.chat.recompress_completed', '重新压缩完成')
      : t('agent.chat.compression_completed', '对话压缩完成')

  if (!isActive && !hasReasoning && !hasSummary) {
    return null
  }

  return (
    <div
      className={embedded ? `${styles.wrap} ${styles.embedded}` : styles.wrap}
      role="status"
      aria-live={isActive ? 'polite' : 'off'}
    >
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
          streamingPlaceholder={t('agent.chat.compression_thinking_waiting', '等待压缩模型思考…')}
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
          streamingPlaceholder={t('agent.chat.compression_stream_waiting', '等待摘要输出…')}
          defaultOpen={false}
          autoCollapse={isActive}
        />
      )}
    </div>
  )
}
