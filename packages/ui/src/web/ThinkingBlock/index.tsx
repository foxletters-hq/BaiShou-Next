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
    // CJK/CJK标点 之间去空格
    .replace(new RegExp(`([${cjk}${punct}])\\s+([${cjk}${punct}])`, 'g'), '$1$2')
    // CJK 与数字之间去空格
    .replace(new RegExp(`([${cjk}])\\s+(\\d)`, 'g'), '$1$2')
    .replace(new RegExp(`(\\d)\\s+([${cjk}])`, 'g'), '$1$2')
    // 数字之间去空格
    .replace(/(\d)\s+(\d)/g, '$1$2')
    // CJK 与 ASCII 字母之间去空格
    .replace(new RegExp(`([${cjk}])\\s+([a-zA-Z])`, 'g'), '$1$2')
    .replace(new RegExp(`([a-zA-Z])\\s+([${cjk}${punct}])`, 'g'), '$1$2')
    // 英文标点前去空格（, . ; : ! ? ） ] }）
    .replace(/\s+([,.;:!?)}\]])/g, '$1')
    // 英文标点后加空格（仅当后面跟字母/数字时）
    .replace(/([,.;:!?)}\]])([A-Za-z0-9])/g, '$1 $2')
    // 开括号前去空格
    .replace(/\s+([([\{])/g, '$1')
    // 开括号后去空格
    .replace(/([([\{])\s+/g, '$1')
    // 撇号周围去空格（'s, 're, 've 等）
    .replace(/\s+'/g, "'")
    .replace(/'\s+/g, "'")
    // 连字符周围去空格
    .replace(/\s*-\s*/g, '-');
}

/** 预览区域每行高度 */
const LINE_HEIGHT = 14;
/** 预览区域最多显示行数 */
const MAX_PREVIEW_LINES = 5;

export interface ThinkingBlockProps {
  /** 思考内容 */
  content: string;
  /** 是否正在思考中 */
  isThinking?: boolean;
  /** 思思考耗时（毫秒），流式时为 0，完成后填入 */
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

  // 自动折叠逻辑
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

  // 获取预览行
  const previewLines = useMemo(() => {
    if (!content) return [];
    const normalized = normalizeCJKSpacing(content);
    const allLines = normalized.split('\n');
    // 思考中时去掉最后一行（可能正在输入，不完整）
    const lines = isThinking ? allLines.slice(0, -1) : allLines;
    // 过滤空行
    return lines.filter((line) => line.trim() !== '');
  }, [content, isThinking]);

  // 动态计算预览容器高度
  const previewHeight = useMemo(() => {
    if (previewLines.length < 1) return 38;
    return Math.min(75, Math.max(previewLines.length + 1, 2) * LINE_HEIGHT + 25);
  }, [previewLines.length]);

  // 规范化后的完整内容
  const normalizedContent = useMemo(() => normalizeCJKSpacing(content), [content]);

  if (!content) return null;

  const handleToggle = () => setIsOpen(prev => !prev);

  // 判断是否显示预览（折叠态 + 思考中）
  const showCollapsedPreview = isThinking && !isOpen;

  return (
    <div
      className={`${styles.container} ${isThinking ? styles.isThinking : ''} ${isOpen ? styles.open : ''}`}
    >
      <div className={styles.header} onClick={handleToggle}>
        <div className={styles.headerIcon}>
          <span className={styles.sparkle}>✨</span>
        </div>

        <div className={styles.headerText}>
          <span className={styles.statusText}>{statusText}</span>
        </div>

        <div className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`}>
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

      <div className={styles.contentWrap}>
        <div className={styles.contentInner}>
          <div className={styles.content}>
            {showCollapsedPreview ? (
              // 折叠态：逐行动画滚动预览
              <div
                className={styles.previewContainer}
                style={{ height: previewHeight }}
              >
                <div className={styles.previewContent}>
                  <motion.div
                    className={styles.previewMessages}
                    style={{ height: previewLines.length * LINE_HEIGHT }}
                    animate={{ y: -previewLines.length * LINE_HEIGHT - 2 }}
                    transition={{ duration: 0.15, ease: 'linear' }}
                  >
                    {previewLines.map((line, index) => {
                      if (index < previewLines.length - MAX_PREVIEW_LINES) return null;
                      return (
                        <div key={index} className={styles.previewLine}>
                          {line}
                        </div>
                      );
                    })}
                  </motion.div>
                </div>
              </div>
            ) : (
              // 展开态/思考完成：纯文本渲染，跳过 remarkCjkFriendly 避免 CJK-ASCII 空格干扰
              <MarkdownRenderer content={normalizedContent} plainText />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingBlock;
