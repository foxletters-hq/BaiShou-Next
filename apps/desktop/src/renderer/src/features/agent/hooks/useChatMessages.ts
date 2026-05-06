import { useState, useRef, useEffect, useCallback } from 'react';

export interface PendingAssistantMsg {
  id: string;
  content: string;
  reasoning?: string;
  toolInvocations?: any[];
}

export interface UseChatMessagesParams {
  sessionId: string | undefined;
  isStreaming: boolean;
  streamingText: string;
  streamingReasoning: string;
}

export interface UseChatMessagesResult {
  messages: any[];
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  hasMore: boolean;
  pendingAssistantMsg: PendingAssistantMsg | null;
  loadMore: () => Promise<void>;
  refreshMessages: (retryCount?: number) => Promise<boolean>;
  optimisticAdd: (text: string, attachments?: any[]) => string;
  optimisticRemove: (optimisticId: string) => void;
  markOptimisticSession: (id: string) => void;
  setStreamSessionId: (id: string | null) => void;
}

/**
 * 消息生命周期管理 Hook
 *
 * 职责：
 * 1. 会话切换时加载历史消息
 * 2. 流式结束时同步 DB 消息（带重试）
 * 3. 乐观 UI 增删
 * 4. 分页加载
 * 5. 跟踪当前流所属会话（streamSessionIdRef）
 *
 * 修复：将会话切换和流结束拆成两个独立 useEffect，消除竞态条件。
 * 原因：旧实现在 isNewSession 分支中调用 resetStream() 导致 isStreaming 被过早
 * 重置为 false，使得真正的流结束事件无法触发消息重新加载。
 */
export function useChatMessages(params: UseChatMessagesParams): UseChatMessagesResult {
  const { sessionId, isStreaming, streamingText, streamingReasoning } = params;

  const [messages, setMessages] = useState<any[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [pendingAssistantMsg, setPendingAssistantMsg] = useState<PendingAssistantMsg | null>(null);
  const currentSessionIdRef = useRef<string | null>(null);
  const optimisticSessionIdRef = useRef<string | null>(null);
  const streamSessionIdRef = useRef<string | null>(null);

  // ── 带重试的 DB 同步 ──
  const refreshMessages = useCallback(async (retryCount = 1): Promise<boolean> => {
    if (!sessionId) return false;
    for (let attempt = 0; attempt < retryCount; attempt++) {
      try {
        const currentCount = Math.max(20, messages.length);
        const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, currentCount, 0);
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setHasMore(msgs.length === currentCount);
          return true;
        }
      } catch (e) {
        console.warn('[useChatMessages] refreshMessages attempt', attempt + 1, 'failed:', e);
      }
      if (attempt < retryCount - 1) {
        await new Promise(r => setTimeout(r, 150 * (attempt + 1)));
      }
    }
    return false;
  }, [sessionId, messages.length]);

  // ── Effect 1: 会话切换 → 加载消息（不碰流状态）──
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setHasMore(false);
      currentSessionIdRef.current = null;
      setPendingAssistantMsg(null);
      return;
    }

    const isNewSession = currentSessionIdRef.current !== sessionId;
    currentSessionIdRef.current = sessionId;

    if (isNewSession) {
      setPendingAssistantMsg(null);
      window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 20, 0).then(msgs => {
        if (msgs && msgs.length > 0) {
          setMessages(msgs);
          setHasMore(msgs.length === 20);
        } else {
          if (optimisticSessionIdRef.current !== sessionId) {
            setMessages([]);
          }
          setHasMore(false);
        }
      }).catch(() => {
        setMessages([]);
        setHasMore(false);
      });
    }
  }, [sessionId]);

  // ── Effect 2: 流结束 → 同步 DB 消息（独立于会话切换）──
  const prevStreamingRef = useRef(isStreaming);
  useEffect(() => {
    // 仅在 isStreaming 从 true→false 的转换瞬间触发
    if (prevStreamingRef.current && !isStreaming && sessionId) {
      // 构造 pending 过渡气泡（仅当流属于当前会话）
      if (streamSessionIdRef.current === sessionId && (streamingText || streamingReasoning)) {
        setPendingAssistantMsg({
          id: `pending-${Date.now()}`,
          content: streamingText,
          reasoning: streamingReasoning || undefined,
        });
      }
      // 带重试的 DB 同步
      refreshMessages(3).then(success => {
        if (success) {
          setPendingAssistantMsg(null);
        }
      });
    }
    prevStreamingRef.current = isStreaming;
  }, [isStreaming, sessionId]);

  // ── 分页加载 ──
  const loadMore = useCallback(async () => {
    if (!sessionId) return;
    try {
      const msgs = await window.electron.ipcRenderer.invoke('agent:get-messages', sessionId, 20, messages.length);
      if (msgs && msgs.length > 0) {
        setMessages(prev => [...msgs, ...prev]);
        setHasMore(msgs.length === 20);
      } else {
        setHasMore(false);
      }
    } catch {
      // 静默失败
    }
  }, [sessionId, messages.length]);

  // ── 乐观 UI ──
  const optimisticAdd = useCallback((text: string, attachments?: any[]): string => {
    const optimisticId = Date.now().toString();
    setMessages(prev => [...prev, {
      id: optimisticId,
      role: 'user',
      content: text,
      attachments,
      createdAt: new Date(),
    }]);
    return optimisticId;
  }, []);

  const optimisticRemove = useCallback((optimisticId: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== optimisticId));
  }, []);

  // 标记乐观会话（创建新会话后调用，防止 DB 空结果覆盖乐观 UI）
  const markOptimisticSession = useCallback((id: string) => {
    optimisticSessionIdRef.current = id;
  }, []);

  // 设置当前流所属会话 ID
  const setStreamSessionId = useCallback((id: string | null) => {
    streamSessionIdRef.current = id;
  }, []);

  return {
    messages,
    setMessages,
    hasMore,
    pendingAssistantMsg,
    loadMore,
    refreshMessages,
    optimisticAdd,
    optimisticRemove,
    markOptimisticSession,
    setStreamSessionId,
  };
}
