import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseChatScrollParams {
  messages: any[];
  streamingText: string;
  streamingReasoning: string;
  isStreaming: boolean;
  activeTool: { name: string; args: any } | null;
}

export interface UseChatScrollResult {
  scrollRef: React.RefObject<HTMLDivElement | null>;
  showScrollButton: boolean;
  scrollToBottom: (force?: boolean) => void;
}

/**
 * 聊天滚动管理 Hook
 *
 * 职责：
 * 1. 自动滚动到底部（新消息/流式输出时）
 * 2. 用户手动上翻时暂停自动滚动
 * 3. 显示"回到底部"按钮
 */
export function useChatScroll(params: UseChatScrollParams): UseChatScrollResult {
  const { messages, streamingText, streamingReasoning, isStreaming, activeTool } = params;

  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrollingRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      if (!scrollRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
      isUserScrollingRef.current = !isAtBottom;
      setShowScrollButton(!isAtBottom);
    };
    const el = scrollRef.current;
    if (el) el.addEventListener('scroll', handleScroll);
    return () => {
      if (el) el.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const scrollToBottom = useCallback((force = false) => {
    if (scrollRef.current && (!isUserScrollingRef.current || force)) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      if (force) {
        setShowScrollButton(false);
        isUserScrollingRef.current = false;
      }
    }
  }, []);

  const prevNewestIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newestMsg = messages[messages.length - 1];
    const isNewMessageAdded = newestMsg?.id && newestMsg.id !== prevNewestIdRef.current;

    if (isNewMessageAdded || isStreaming || streamingText || activeTool) {
      scrollToBottom();
    }
    prevNewestIdRef.current = newestMsg?.id || null;
  }, [messages, streamingText, streamingReasoning, isStreaming, activeTool, scrollToBottom]);

  return { scrollRef, showScrollButton, scrollToBottom };
}
