import { useTranslation } from 'react-i18next'
import React, { useMemo } from 'react'
import { ChevronDown, CheckCircle2, Loader2 } from 'lucide-react'
import shared from '../shared/CollapsibleAncillaryBlock.module.css'
import styles from './StreamingBubble.module.css'
import { MarkdownRenderer } from '../MarkdownRenderer'
import { ThinkingBlock } from '../ThinkingBlock'
import { AssistantAvatar } from '../AssistantAvatar'
import { parseRedactedThinking } from '../../shared/chat-bubble/redacted-thinking'
import { motion } from 'framer-motion'

export interface ToolExecution {
  name: string
  durationMs: number
}

export interface StreamingBubbleProps {
  text: string
  reasoning?: string
  isReasoning?: boolean
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

  const hasReasoning = cleanReasoning.length > 0
  const hasText = cleanText.length > 0

  return (
    <motion.div
      className={styles.container}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 20, stiffness: 300 }}
    >
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
                  <ThinkingBlock
                    content={cleanReasoning}
                    isThinking={isReasoning && !hasText}
                    defaultOpen={true}
                    autoCollapse={false}
                  />
                )}

                {/* 工具调用 */}
                {hasTools && (
                  <ToolExecutionGroup
                    completedTools={completedTools}
                    activeToolName={activeToolName}
                  />
                )}

                {/* 正文内容 */}
                {hasText && <MarkdownRenderer content={cleanText} isStreaming={true} />}
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
    </motion.div>
  )
}

const ToolExecutionGroup: React.FC<{
  completedTools: ToolExecution[]
  activeToolName?: string | null
}> = ({ completedTools, activeToolName }) => {
  const { t } = useTranslation()
  const totalTools = completedTools.length + (activeToolName ? 1 : 0)

  const title =
    activeToolName && completedTools.length === 0
      ? t('agent.tools.tool_call', '工具调用')
      : t('agent.tools.tool_call_results', '工具调用 · {{count}} 个结果', {
          count: totalTools
        })

  return (
    <div className={shared.shell}>
      <div className={shared.header}>
        <div className={shared.headerIcon}>🎧</div>
        <span className={shared.headerTitle}>{title}</span>
        <div className={`${shared.headerChevron} ${shared.headerChevronOpen}`}>
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      <div className={styles.toolList}>
        {completedTools.map((tool, idx) => {
          const durationText =
            tool.durationMs < 1000
              ? `${tool.durationMs}ms`
              : `${(tool.durationMs / 1000).toFixed(1)}s`
          return (
            <div key={idx} className={styles.toolItem}>
              <span className={styles.toolStatusIcon}>
                <CheckCircle2 size={14} />
              </span>
              <span className={styles.toolItemName}>
                {t(`agent.tools.${tool.name}`, tool.name)}
              </span>
              <span className={styles.toolItemDuration}>{durationText}</span>
            </div>
          )
        })}

        {activeToolName && <ActiveToolItem name={activeToolName} />}
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

const ActiveToolItem: React.FC<{ name: string }> = ({ name }) => {
  const { t } = useTranslation()
  const [dots, setDots] = React.useState('.')

  React.useEffect(() => {
    const timer = setInterval(() => {
      setDots((prev) => {
        if (prev === '...') return '.'
        if (prev === '..') return '...'
        return '..'
      })
    }, 600)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={`${styles.toolItem} ${styles.pulsing}`}>
      <Loader2 size={14} className={styles.toolStatusSpinner} />
      <span className={styles.activeToolName}>
        {t(`agent.tools.${name}`, name)} {dots}
      </span>
    </div>
  )
}
