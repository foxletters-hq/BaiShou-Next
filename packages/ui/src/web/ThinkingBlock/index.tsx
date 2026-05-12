import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { MarkdownRenderer } from '../MarkdownRenderer';
import styles from './ThinkingBlock.module.css';

/**
 * 规范化文本中的多余空白。
 * 处理 CJK 字符之间、英文标点周围的多余空格。
 */
export function normalizeCJKSpacing(text: string): string {
  const cjk = '\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff';
  const punct = '\u3000-\u303f\uff00-\uffef';

  return text
    .replace(new RegExp(`([${cjk}${punct}])\\s+([${cjk}${punct}])`, 'g'), '$1$2')
    .replace(new RegExp(`([${cjk}])\\s+(\\d)`, 'g'), '$1$2')
    .replace(new RegExp(`(\\d)\\s+([${cjk}])`, 'g'), '$1$2')
    .replace(/(\d)\s+(\d)/g, '$1$2')
    .replace(new RegExp(`([${cjk}])\\s+([a-zA-Z])`, 'g'), '$1$2')
    .replace(new RegExp(`([a-zA-Z])\\s+([${cjk}${punct}])`, 'g'), '$1$2')
    .replace(/\s+([,.;:!?)}\]])/g, '$1')
    .replace(/([,.;:!?)}\]])([A-Za-z0-9])/g, '$1 $2')
    .replace(/\s+([([\{])/g, '$1')
    .replace(/([([\{])\s+/g, '$1')
    .replace(/\s+'/g, "'")
    .replace(/'\s+/g, "'")
    .replace(/\s*-\s*/g, '-');
}

const LINE_HEIGHT = 14;
const MAX_PREVIEW_LINES = 5;

export interface ThinkingBlockProps {
  /** 思考内容 */
  content: string;
  /** 是否正在思考中 */
  isThinking?: boolean;
  /** 思考耗时（毫秒），流式时为 0，完成后填入 */
  thinkingTimeMs?: number;
  /** 是否默认展开，默认 false（折叠） */
  defaultOpen?: boolean;
  /** 流式时是否自动折叠，默认 true */
  autoCollapse?: boolean;
}

export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  isThinking = false,
  thinkingTimeMs = 0,
  defaultOpen = false,
  autoCollapse = true,
}) => {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayTime, setDisplayTime] = useState(thinkingTimeMs);

  // 思考开始时记录时间
  useEffect(() => {
    if (isThinking) {
      startTimeRef.current = Date.now();
      setDisplayTime(0);

      timerRef.current = setInterval(() => {
        setDisplayTime(Date.now() - startTimeRef.current);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (thinkingTimeMs > 0) {
        setDisplayTime(thinkingTimeMs);
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isThinking, thinkingTimeMs]);

  // 自动折叠逻辑：思考中时强制折叠
  useEffect(() => {
    if (autoCollapse && isThinking) {
      setIsOpen(false);
    }
  }, [autoCollapse, isThinking]);

  // 格式化时间
  const timeText = useMemo(() => {
    const seconds = displayTime / 1000;
    if (seconds < 1) return `${(displayTime / 100).toFixed(0)}00ms`;
    return `${seconds.toFixed(1)}s`;
  }, [displayTime]);

  // 状态文本
  const statusText = useMemo(() => {
    if (isThinking) {
      return t('agent.chat.thinking_time', '思考中 {{time}}', { time: timeText });
    }
    if (displayTime > 0) {
      return t('agent.chat.thought_time', '思考耗时 {{time}}', { time: timeText });
    }
    return t('agent.chat.thought_process', '思考过程');
  }, [isThinking, displayTime, timeText, t]);

  const messages = useMemo(() => {
    if (!content) return [];
    const normalized = normalizeCJKSpacing(content);
    const allLines = normalized.split('\n');
    // 思考中时去掉最后一行（可能正在输入，不完整）
    const lines = isThinking ? allLines.slice(0, -1) : allLines;
    return lines.filter((line) => line.trim() !== '');
  }, [content, isThinking]);

  // 是否显示预览（折叠态 + 思考中）
  const showCollapsedPreview = isThinking && !isOpen;

  // 折叠态容器高度
  const previewContainerHeight = useMemo(() => {
    if (!showCollapsedPreview || messages.length < 1) return 38;
    return Math.min(75, Math.max(messages.length + 1, 2) * LINE_HEIGHT + 25);
  }, [showCollapsedPreview, messages.length]);

  // 规范化后的完整内容
  const normalizedContent = useMemo(() => normalizeCJKSpacing(content), [content]);

  if (!content) return null;

  const handleToggle = () => setIsOpen((prev) => !prev);

  return (
    <div
      className={`${styles.container} ${isThinking ? styles.isThinking : ''} ${isOpen ? styles.open : ''}`}
    >
      {/* Header */}
      <div className={styles.header} onClick={handleToggle}>
        <div className={styles.headerLeft}>
          <motion.span
            className={styles.bulb}
            animate={isThinking ? 'active' : 'idle'}
            variants={{
              active: { opacity: [1, 0.2, 1], transition: { duration: 1.2, ease: 'easeInOut', repeat: Infinity } },
              idle: { opacity: 1, transition: { duration: 0.3 } },
            }}
          >
            💡
          </motion.span>
        </div>

        <div className={styles.headerCenter}>
          <span
            className={`${styles.statusText} ${!showCollapsedPreview || messages.length === 0 ? styles.statusOnly : ''}`}
          >
            {statusText}
          </span>

          {showCollapsedPreview && messages.length > 0 && (
            <div className={styles.previewWrap}>
              <div className={styles.previewMask}>
                <motion.div
                  className={styles.previewScroll}
                  style={{ height: messages.length * LINE_HEIGHT }}
                  initial={false}
                  animate={{ y: -messages.length * LINE_HEIGHT }}
                  transition={{ duration: 0.15, ease: 'linear' }}
                >
                  {messages.map((msg, index) => {
                    if (index < messages.length - MAX_PREVIEW_LINES) return null;
                    return (
                      <div key={index} className={styles.previewLine}>
                        {msg}
                      </div>
                    );
                  })}
                </motion.div>
              </div>
            </div>
          )}
        </div>

        <div className={`${styles.headerRight} ${isOpen ? styles.arrowOpen : ''}`}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </div>
      </div>

      {/* 可展开内容区 */}
      <div className={styles.contentWrap}>
        <div className={styles.contentInner}>
          <div className={styles.content}>
            <MarkdownRenderer content={normalizedContent} plainText />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingBlock;
