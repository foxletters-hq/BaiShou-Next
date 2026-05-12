import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MarkdownRenderer } from '../MarkdownRenderer';
import styles from './ThinkingBlock.module.css';

/**
 * 规范化 CJK 文本中的多余空白。
 * DeepSeek 等模型的推理输出有时会在中日韩字符之间插入空格，
 * 这是模型基于 token 分词的自然产物，但在渲染时需要清理掉。
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
    // CJK 与 ASCII 字母之间去空格（处理 "我是 An son" -> "我是Anson"）
    .replace(new RegExp(`([${cjk}])\\s+([a-zA-Z])`, 'g'), '$1$2')
    .replace(new RegExp(`([a-zA-Z])\\s+([${cjk}${punct}])`, 'g'), '$1$2');
}

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
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [displayTime, setDisplayTime] = useState(thinkingTimeMs);

  // 思考开始时记录时间
  useEffect(() => {
    if (isThinking) {
      startTimeRef.current = Date.now();
      setDisplayTime(0);

      // 启动计时器
      timerRef.current = setInterval(() => {
        setDisplayTime(Date.now() - startTimeRef.current);
      }, 100);
    } else {
      // 思考结束
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

  // 获取预览文本（最后几行）— 先做 CJK 空白规范化
  const previewText = useMemo(() => {
    if (!content) return '';
    const normalized = normalizeCJKSpacing(content);
    const lines = normalized.split('\n').filter(l => l.trim());
    return lines.slice(-3).join('\n');
  }, [content]);

  // 规范化后的完整内容
  const normalizedContent = useMemo(() => normalizeCJKSpacing(content), [content]);

  if (!content) return null;

  const handleToggle = () => setIsOpen(prev => !prev);

  return (
    <div
      className={`${styles.container} ${isThinking ? styles.isThinking : ''} ${isOpen ? styles.open : ''}`}
    >
      <div className={styles.header} onClick={handleToggle}>
        <div className={styles.headerIcon}>
          <span className={styles.sparkle}>✨</span>
        </div>

        <div className={styles.headerText}>
          <span>{statusText}</span>
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
            {isThinking ? (
              <div className={styles.previewContainer}>
                <div className={styles.previewText}>
                  {previewText}
                  <span className={styles.cursor} />
                </div>
              </div>
            ) : (
              <MarkdownRenderer content={normalizedContent} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingBlock;
