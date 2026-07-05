import React, { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { AgentMarkdownRenderer } from '../AgentMarkdown'
import shared from '../shared/CollapsibleAncillaryBlock.module.css'
import styles from './ThinkingBlock.module.css'

/**
 * 规范化文本中的多余空白。
 * 处理 CJK 字符之间、英文标点周围的多余空格。
 */
export function normalizeCJKSpacing(text: string): string {
  const cjk = '\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff'
  const punct = '\u3000-\u303f\uff00-\uffef'

  return (
    text
      // CJK/CJK标点 之间去空格
      .replace(new RegExp(`([${cjk}${punct}])[ \\t]+([${cjk}${punct}])`, 'g'), '$1$2')
      // CJK 与数字之间去空格
      .replace(new RegExp(`([${cjk}])[ \\t]+(\\d)`, 'g'), '$1$2')
      .replace(new RegExp(`(\\d)[ \\t]+([${cjk}])`, 'g'), '$1$2')
      // 数字之间去空格
      .replace(/(\d)[ \\t]+(\d)/g, '$1$2')
      // CJK 与 ASCII 字母之间去空格
      .replace(new RegExp(`([${cjk}])[ \\t]+([a-zA-Z])`, 'g'), '$1$2')
      .replace(new RegExp(`([a-zA-Z])[ \\t]+([${cjk}${punct}])`, 'g'), '$1$2')
      // 英文标点前去空格（, . ; : ! ? ） ] }）
      .replace(/[ \\t]+([,.;:!?)}\]])/g, '$1')
      // 英文标点后加空格（仅当后面跟字母/数字时）
      .replace(/([,.;:!?)}\]])([A-Za-z0-9])/g, '$1 $2')
      // 开括号前去空格
      .replace(/[ \\t]+([([\{])/g, '$1')
      // 开括号后去空格
      .replace(/([([\{])[ \\t]+/g, '$1')
      // 撇号周围去空格（'s, 're, 've 等）
      .replace(/[ \t]+'/g, "'")
      .replace(/'[ \t]+/g, "'")
  )
}

/** 预览区域每行高度 */
const LINE_HEIGHT = 14
/** 预览区域默认最多显示行数 */
const DEFAULT_MAX_PREVIEW_LINES = 3

export interface ThinkingBlockProps {
  /** 思考内容 */
  content: string
  /** 是否正在思考中 */
  isThinking?: boolean
  /** 思思考耗时（毫秒），流式时为 0，完成后填入 */
  thinkingTimeMs?: number
  /** 是否默认展开，默认 false（折叠） */
  defaultOpen?: boolean
  /** 流式时是否自动折叠，默认 true */
  autoCollapse?: boolean
  /** 标题左侧图标，默认 ✨ */
  headerIcon?: string
  /** 进行中且尚无正文时仍显示（用于压缩等流式场景） */
  forceVisible?: boolean
  /** 进行中标题文案；不传则使用思考相关 i18n */
  activeStatusLabel?: string
  /** 完成后标题文案；不传则使用思考相关 i18n */
  completedStatusLabel?: string
  /** 流式进行中、尚无正文时的占位提示 */
  streamingPlaceholder?: string
  /** 折叠预览最多显示行数（流式思考建议 2） */
  maxPreviewLines?: number
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isThinking = false,
  thinkingTimeMs = 0,
  defaultOpen = false,
  autoCollapse = true,
  headerIcon = '✨',
  forceVisible = false,
  activeStatusLabel,
  completedStatusLabel,
  streamingPlaceholder,
  maxPreviewLines = DEFAULT_MAX_PREVIEW_LINES
}) => {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const startTimeRef = useRef<number>(Date.now())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [displayTime, setDisplayTime] = useState(thinkingTimeMs)

  // 思考开始时记录时间
  useEffect(() => {
    if (isThinking) {
      startTimeRef.current = Date.now()
      setDisplayTime(0)

      timerRef.current = setInterval(() => {
        setDisplayTime(Date.now() - startTimeRef.current)
      }, 100)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (thinkingTimeMs > 0) {
        setDisplayTime(thinkingTimeMs)
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [isThinking, thinkingTimeMs])

  // 自动折叠逻辑
  useEffect(() => {
    if (autoCollapse && isThinking) {
      setIsOpen(false)
    }
  }, [autoCollapse, isThinking])

  // 格式化时间
  const timeText = useMemo(() => {
    const seconds = displayTime / 1000
    if (seconds < 1) return `${(displayTime / 100).toFixed(0)}00ms`
    return `${seconds.toFixed(1)}s`
  }, [displayTime])

  // 状态文本
  const statusText = useMemo(() => {
    if (isThinking) {
      if (activeStatusLabel) {
        return `${activeStatusLabel} · ${timeText}`
      }
      return t('agent.chat.thinking_time', '思考中 {{time}}', {
        time: timeText
      })
    }
    if (displayTime > 0) {
      if (completedStatusLabel) {
        if (completedStatusLabel.includes('{{time}}')) {
          return completedStatusLabel.replace('{{time}}', timeText)
        }
        return `${completedStatusLabel} · ${timeText}`
      }
      return t('agent.chat.thought_time', '思考耗时 {{time}}', {
        time: timeText
      })
    }
    if (completedStatusLabel) {
      if (completedStatusLabel.includes('{{time}}')) {
        return completedStatusLabel
          .replace('{{time}}', '')
          .replace(/ ·\s*$/, '')
          .trim()
      }
      return completedStatusLabel
    }
    return t('agent.chat.thought_process', '思考过程')
  }, [isThinking, displayTime, timeText, t, activeStatusLabel, completedStatusLabel])

  const previewText = useMemo(() => {
    if (!content) return ''
    const normalized = normalizeCJKSpacing(content)
    // 折叠预览：合并源换行，连续排版；仅容器宽度不足时自然折行
    return normalized.replace(/\s*\n+\s*/g, ' ').trim()
  }, [content])

  const previewHeight = maxPreviewLines * LINE_HEIGHT
  const showTopFade = previewText.length > maxPreviewLines * 20

  // 规范化后的完整内容
  const normalizedContent = useMemo(() => normalizeCJKSpacing(content), [content])

  if (!content && !(forceVisible && isThinking)) return null

  const handleToggle = () => setIsOpen((prev) => !prev)

  const hasBody = Boolean(content) || (forceVisible && isThinking)
  const showCollapsedPreview =
    isThinking && !isOpen && (previewText.length > 0 || Boolean(streamingPlaceholder))

  return (
    <div
      className={`${shared.shell} ${styles.thinkingShell} ${isThinking ? styles.isThinking : ''} ${isOpen ? shared.open : ''}`}
    >
      <div className={shared.header} onClick={handleToggle}>
        <div className={shared.headerIcon}>
          <span className={styles.sparkle}>{headerIcon}</span>
        </div>

        <span className={shared.headerTitle}>{statusText}</span>

        <div className={`${shared.headerChevron} ${isOpen ? shared.headerChevronOpen : ''}`}>
          <ChevronDown size={14} strokeWidth={2} />
        </div>
      </div>

      {showCollapsedPreview ? (
        <div className={styles.previewBody}>
          {!content && streamingPlaceholder ? (
            <div className={styles.previewContainer} style={{ height: 38 }}>
              <div className={`${styles.previewScroll} ${styles.previewWaiting}`}>
                {streamingPlaceholder}
              </div>
            </div>
          ) : (
            <div className={styles.previewContainer} style={{ height: previewHeight }}>
              <div className={styles.previewTail}>{previewText}</div>
              {showTopFade ? <div className={styles.previewFade} aria-hidden /> : null}
            </div>
          )}
        </div>
      ) : null}

      {hasBody ? (
        <div className={shared.contentWrap}>
          <div className={shared.contentInner}>
            <div className={styles.content}>
              <AgentMarkdownRenderer
                content={normalizedContent}
                isStreaming={isThinking}
                variant="ancillary"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default ThinkingBlock
