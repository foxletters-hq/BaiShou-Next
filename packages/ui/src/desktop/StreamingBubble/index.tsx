import { useTranslation } from 'react-i18next'
import React, { useMemo } from 'react'
import {
  assistantStreamTimelineSignature,
  groupStreamTimelineForDisplay,
  type AgentStreamTimelineItem,
  type MockChatAttachment
} from '@baishou/shared'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { AgentMarkdownRenderer, AgentThinkSection } from '../AgentMarkdown'
import { AgentToolChainSection } from '../AgentToolChain'
import { AssistantAvatar } from '../AssistantAvatar'
import { AssistantDisplayTimeline } from '../AssistantDisplayTimeline/AssistantDisplayTimeline'
import { ChatBubbleAttachments } from '../ChatBubble/ChatBubbleAttachments'
import styles from './StreamingBubble.module.css'

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
  /** 按发生顺序展开思考 / 工具 / 正文；有值时优先于压扁字段 */
  timeline?: AgentStreamTimelineItem[]
  aiProfile?: {
    name: string
    avatarPath?: string | null
    emoji?: string | null
  }
  attachments?: MockChatAttachment[]
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
  timeline,
  aiProfile = { name: 'AI' },
  attachments = [],
  error = null,
  onRetry,
  onStop
}) => {
  const { t } = useTranslation()
  const liveTimeline = timeline ?? []
  const timelineKey = assistantStreamTimelineSignature(liveTimeline)
  const timelineItems = useMemo(
    () => groupStreamTimelineForDisplay(liveTimeline),
    [liveTimeline, timelineKey]
  )
  const useTimeline = timelineItems.length > 0
  const hasTools = completedTools.length > 0 || !!activeToolName
  const hasAttachments = attachments.length > 0
  const showStickerAttachments = hasAttachments && !isTextStreaming
  const aiName = aiProfile.name || t('agent.chat.ai_label')

  const { cleanContent: cleanText, cleanReasoning } = useMemo(
    () => parseRedactedThinking(text, reasoning),
    [text, reasoning]
  )

  const hasReasoning = cleanReasoning.length > 0 || isReasoning
  const hasText = cleanText.length > 0
  const hasBody = useTimeline || hasText || hasTools || hasReasoning || showStickerAttachments

  return (
    <div className={styles.container}>
      <div className={styles.avatarWrap}>
        <AssistantAvatar avatarPath={aiProfile.avatarPath} size={36} borderRadius="50%" />
      </div>
      <div className={styles.messageCol}>
        {hasBody ? (
          <>
            <div className={styles.nameTimeRow}>
              <span className={styles.nameLabel}>{aiName}</span>
            </div>
            <div className={styles.bubbleCard}>
              {useTimeline ? (
                <AssistantDisplayTimeline
                  items={timelineItems}
                  isStreaming={!error}
                  isTextStreaming={isTextStreaming && !error}
                  error={error}
                />
              ) : (
                <>
                  {hasReasoning && (
                    <AgentThinkSection content={cleanReasoning} isStreaming={isReasoning} />
                  )}

                  {hasTools && (
                    <AgentToolChainSection
                      completedTools={completedTools}
                      activeToolName={activeToolName}
                      isStreaming={!error}
                    />
                  )}

                  {hasText && (
                    <AgentMarkdownRenderer
                      content={cleanText}
                      isStreaming={isTextStreaming && !error}
                    />
                  )}
                </>
              )}
              {showStickerAttachments ? (
                <ChatBubbleAttachments
                  attachments={attachments}
                  display="sticker"
                  placement="after"
                />
              ) : null}
            </div>
            {isTextStreaming && !error && !hasText && !isReasoning && !activeToolName ? (
              <div className={styles.dotsWrap}>
                <BouncingDotsIndicator />
              </div>
            ) : null}
          </>
        ) : error ? null : (
          <div className={styles.dotsWrap}>
            <BouncingDotsIndicator />
          </div>
        )}

        {error ? (
          <div className={styles.errorBox} role="alert">
            <span className={styles.errorText}>⚠ {error}</span>
            {onRetry && (
              <button className={styles.retryBtn} onClick={onRetry}>
                {t('common.retry', '重试')}
              </button>
            )}
          </div>
        ) : onStop ? (
          <div className={styles.stopBtnWrap}>
            <button className={styles.stopBtn} onClick={onStop}>
              🛑 {t('common.stop_generate', '停止生成')}
            </button>
          </div>
        ) : null}
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
