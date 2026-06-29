import { useTranslation } from 'react-i18next'
import React, { useMemo } from 'react'
import styles from './StreamingBubble.module.css'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { AgentMarkdownRenderer, AgentThinkSection } from '../AgentMarkdown'
import { AgentToolChainSection } from '../AgentToolChain'
import { AssistantAvatar } from '../AssistantAvatar'

export interface ToolExecution {
  name: string
  durationMs: number
}

export interface StreamingBubbleProps {
  text: string
  reasoning?: string
  isReasoning?: boolean
  /** 正文是否仍在流式输出（桥接态应为 false，以便 XMarkdown 刷新未完成语法） */
  isTextStreaming?: boolean
  activeToolName?: string | null
  completedTools?: ToolExecution[]
  aiProfile?: {
    name: string
    avatarPath?: string | null
    emoji?: string | null
  }
  error?: string | null
  onRetry?: () => void
  onStop?: () => void
}

export const StreamingBubble: React.FC<StreamingBubbleProps> = ({
  text,
  reasoning = '',
  isReasoning = false,
  isTextStreaming = true,
  activeToolName = null,
  completedTools = [],
  aiProfile = { name: 'AI' },
  error = null,
  onRetry,
  onStop
}) => {
  const { t } = useTranslation()
  const hasTools = completedTools.length > 0 || !!activeToolName
  const aiName = aiProfile.name || t('agent.chat.ai_label')

  // 零副作用过滤提取 think 标签，并脱壳误泄漏的 message 元数据
  const { cleanContent: cleanText, cleanReasoning } = useMemo(
    () => parseRedactedThinking(text, reasoning),
    [text, reasoning]
  )

  const hasReasoning = cleanReasoning.length > 0 || isReasoning
  const hasText = cleanText.length > 0

  return (
    <div className={styles.container}>
      <div className={styles.avatarWrap}>
        <AssistantAvatar avatarPath={aiProfile.avatarPath} size={36} borderRadius="50%" />
      </div>
      <div className={styles.messageCol}>
        <div className={styles.nameLabel}>{aiName}</div>

        {error ? (
          <div className={styles.errorBox}>
            <span className={styles.errorText}>⚠ {error}</span>
            {onRetry && (
              <button className={styles.retryBtn} onClick={onRetry}>
                {t('common.retry', '重试')}
              </button>
            )}
          </div>
        ) : (
          <>
            {hasText || hasTools || hasReasoning ? (
              <div className={styles.bubbleCard}>
                {/* Reasoning 块 - 移到 bubbleCard 内部 */}
                {hasReasoning && (
                  <AgentThinkSection content={cleanReasoning} isStreaming={isReasoning} />
                )}

                {/* 工具调用 */}
                {hasTools && (
                  <AgentToolChainSection
                    completedTools={completedTools}
                    activeToolName={activeToolName}
                    isStreaming
                  />
                )}

                {hasText && (
                  <AgentMarkdownRenderer content={cleanText} isStreaming={isTextStreaming} />
                )}
              </div>
            ) : (
              <div className={styles.dotsWrap}>
                <BouncingDotsIndicator />
              </div>
            )}

            {onStop && (
              <div className={styles.stopBtnWrap}>
                <button className={styles.stopBtn} onClick={onStop}>
                  🛑 {t('common.stop_generate', '停止生成')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

const BouncingDotsIndicator: React.FC = () => {
  return (
    <div className={styles.bouncingDots}>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
      <div className={styles.dot}></div>
    </div>
  )
}
